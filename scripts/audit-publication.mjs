#!/usr/bin/env node
// Bounded, value-redacting audit for the tracked publication tree. This is a
// high-confidence local guard, not a replacement for GitHub secret scanning or
// a full history review. Findings print only path, line and rule name.
import {readFileSync,lstatSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const staged=process.argv.slice(2).includes('--staged');
if(process.argv.length>(staged?3:2) || process.argv.slice(2).some(arg=>arg!=='--staged')) {
  console.error('Usage: node scripts/audit-publication.mjs [--staged]');
  process.exit(2);
}
const gitArgs=staged?['diff','--cached','--name-only','--diff-filter=ACMR','-z']:['ls-files','-z'];
const listed=spawnSync('git',gitArgs,{cwd:root,encoding:'buffer',maxBuffer:16*1024*1024});
if(listed.error || listed.status!==0) {
  console.error('Unable to enumerate publication files');process.exit(2);
}
const files=listed.stdout.toString().split('\0').filter(Boolean).sort();
if(staged && files.length===0) {
  console.error('No staged publication files to audit');process.exit(2);
}
const forbiddenNames=new Set(['.env','.npmrc','.netrc','credentials','credentials.json',
  'cookies','cookies.json','id_rsa','id_ed25519','login data','local state']);
const rules=[
  ['private-key',/-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g],
  ['github-token',/(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{50,255})/g],
  ['gitlab-token',/glpat-[A-Za-z0-9_-]{20,255}/g],
  ['aws-access-key',/(?:AKIA|ASIA)[0-9A-Z]{16}/g],
  ['google-api-key',/AIza[0-9A-Za-z_-]{35}/g],
  ['slack-token',/xox[baprs]-[0-9A-Za-z-]{20,255}/g],
  ['stripe-live-key',/(?:sk|rk)_live_[0-9A-Za-z]{20,255}/g],
  ['literal-session-secret',/(?:zpw_sek|access[_-]?token|refresh[_-]?token|session[_-]?key)\s*[:=]\s*["'][0-9A-Za-z+/=_-]{20,}["']/gi],
  ['developer-home-path',/\/home\/rurimeiko\//g],
  ['codex-session-path',/\.codex\/sessions\//g],
  ['bluetooth-hardware-address',/bluez_(?:input|output)\.[0-9A-Fa-f]{2}(?:[:_][0-9A-Fa-f]{2}){5}/g],
  ['usb-device-serial',/alsa_(?:input|output)\.usb-[^\s"']*_[0-9A-Fa-f]{8,}-/g],
];
const ruleNames=new Set(rules.map(([name])=>name));
const validPath=relative=>typeof relative==='string' && relative && !path.isAbsolute(relative) &&
  !/[\0\r\n]/.test(relative) && relative.split('/').every(part=>part && part!=='.' && part!=='..');
function indexBlob(relative,maxBuffer=65*1024*1024) {
  const result=spawnSync('git',['show',`:${relative}`],{cwd:root,encoding:'buffer',maxBuffer});
  if(result.error || result.status!==0)throw new Error('index blob unavailable');
  return result.stdout;
}
function indexMode(relative) {
  const result=spawnSync('git',['ls-files','--stage','-z','--',relative],
    {cwd:root,encoding:'buffer',maxBuffer:1024*1024});
  if(result.error || result.status!==0)throw new Error('index metadata unavailable');
  const records=result.stdout.toString().split('\0').filter(Boolean);
  if(records.length!==1)throw new Error('ambiguous index metadata');
  const match=/^(\d{6}) [0-9a-f]+ 0\t/.exec(records[0]);
  if(!match)throw new Error('unmerged index entry');
  return match[1];
}
let allowDocument;
try {
  const bytes=staged?indexBlob('PUBLICATION-AUDIT-ALLOWLIST.json',1024*1024):
    readFileSync(path.join(root,'PUBLICATION-AUDIT-ALLOWLIST.json'));
  allowDocument=JSON.parse(bytes.toString('utf8'));
}
catch {console.error('Invalid publication audit allowlist');process.exit(2);}
if(allowDocument?.schemaVersion!==1 || !Array.isArray(allowDocument.entries)) {
  console.error('Invalid publication audit allowlist');process.exit(2);
}
const allow=new Map();
for(const entry of allowDocument.entries) {
  if(!entry || Object.keys(entry).sort().join(',')!=='path,reason,rule,sha256' ||
    !validPath(entry.path) || (!staged && !files.includes(entry.path)) || !ruleNames.has(entry.rule) ||
    !/^[0-9a-f]{64}$/.test(entry.sha256) || typeof entry.reason!=='string' || entry.reason.length<20) {
    console.error('Invalid publication audit allowlist entry');process.exit(2);
  }
  const key=`${entry.path}\0${entry.rule}\0${entry.sha256}`;
  if(allow.has(key)) {console.error('Duplicate publication audit allowlist entry');process.exit(2);}
  allow.set(key,false);
}
const findings=[];
for(const relative of files) {
  if(!validPath(relative)) {findings.push({relative,line:0,rule:'unsafe-path'});continue;}
  const base=path.basename(relative).toLowerCase();
  if(forbiddenNames.has(base) || base.startsWith('.env.'))
    findings.push({relative,line:0,rule:'sensitive-filename'});
  let bytes;
  if(staged) {
    try {
      if(!['100644','100755'].includes(indexMode(relative))) {
        findings.push({relative,line:0,rule:'unsupported-file-type'});continue;
      }
      const sizeResult=spawnSync('git',['cat-file','-s',`:${relative}`],
        {cwd:root,encoding:'utf8',maxBuffer:1024});
      const size=Number(sizeResult.stdout?.trim());
      if(sizeResult.error || sizeResult.status!==0 || !Number.isSafeInteger(size) || size<0)
        throw new Error('index size unavailable');
      if(size>64*1024*1024) {
        findings.push({relative,line:0,rule:'unscanned-oversize-file'});continue;
      }
      bytes=indexBlob(relative);
    } catch {findings.push({relative,line:0,rule:'unreadable-file'});continue;}
  } else {
    const absolute=path.join(root,relative);
    let stat;
    try {stat=lstatSync(absolute);}catch {findings.push({relative,line:0,rule:'unreadable-file'});continue;}
    if(!stat.isFile()) {findings.push({relative,line:0,rule:'unsupported-file-type'});continue;}
    if(stat.size>64*1024*1024) {
      findings.push({relative,line:0,rule:'unscanned-oversize-file'});continue;
    }
    try {bytes=readFileSync(absolute);}
    catch {findings.push({relative,line:0,rule:'unreadable-file'});continue;}
  }
  const text=bytes.toString('latin1');
  for(const [rule,pattern] of rules) {
    pattern.lastIndex=0;let match;
    while((match=pattern.exec(text))) {
      const digest=createHash('sha256').update(match[0]).digest('hex');
      const key=`${relative}\0${rule}\0${digest}`;
      if(allow.has(key)){allow.set(key,true);continue;}
      findings.push({relative,line:1+text.slice(0,match.index).split('\n').length-1,rule});
    }
  }
}
if(!staged)for(const [key,used] of allow)if(!used)
  findings.push({relative:key.split('\0')[0],line:0,rule:'stale-audit-allowlist'});
if(findings.length) {
  for(const finding of findings)
    console.error(`${JSON.stringify(finding.relative)}${finding.line?`:${finding.line}`:''}: ${finding.rule}`);
  console.error(`FAIL publication audit: ${findings.length} redacted finding(s) in ${files.length} file(s)`);
  process.exit(1);
}
const reviewed=[...allow.values()].filter(Boolean).length;
console.log(`PASS publication audit: ${files.length} ${staged?'staged':'tracked'} files; ${reviewed} hash-reviewed match(es); values redacted`);
