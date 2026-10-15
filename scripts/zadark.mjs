#!/usr/bin/env node
// Applies or removes the ZaDark dark theme on an application directory.
// ZaDark is MPL-2.0 (see pc-dist/zadark/PROVENANCE.md). The assets live in
// pc-dist/zadark; this script only edits the HTML entry points and bootstrap.js.
// Privacy: the Content-Security-Policy is deliberately NOT widened for
// api.zadark.com or Google Fonts, so ZaDark's translate feature and remote
// fonts stay blocked and nothing leaves the machine through it.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ZADARK_VERSION='26.2.1';
const BODY_CLASSES=['zadark','zadark-pc','zadark-linux'];
// Zalo's own startup code removes <link>/<script> tags whose path starts with "zadark"
// (bundle: default-login-main-startup-shared-worker-znotification, function p). A
// leading "./" keeps the same files but does not match that prefix filter.
const link=name=>`<link rel="stylesheet" href="./zadark/css/${name}.min.css">`;
const script=file=>`<script src="./zadark/${file}.min.js"></script>`;
const LIBS=['jquery','popper','tippy','hotkeys-js','toastify','webfont','introjs','localforage'].map(n=>script(`libs/zadark-${n}`));
// ZaDark entries inside Zalo's Settings (native-looking); loaded after the ZaDark scripts.
const SETTINGS_TAG='<script src="./linux-extras/zadark-settings.js"></script>';
const PAGES={
  'pc-dist/index.html':{
    head:['zadark-fonts','zadark','zadark-popup'].map(link),
    body:[...LIBS,...['shared','translate','zconv','reaction'].map(n=>script(`js/zadark-${n}`)),script('js/zadark'),SETTINGS_TAG],
    html:true
  },
  'pc-dist/znotification.html':{
    head:[link('zadark-znotification')],
    body:[script('libs/zadark-webfont'),script('js/zadark-znotification')]
  },
  'pc-dist/popup-viewer.html':{head:[],body:[script('js/zadark-popup-viewer')]}
};
const THEME_LOCK='<script src="./linux-extras/theme-lock.js"></script>';
const THEME_LOCK_PAGES=new Set(['pc-dist/index.html','pc-dist/znotification.html']);
// Zalo's theme switch always resolves to "light" (theme_setting 0) so ZaDark styles the right base.
const LIGHT_SRC='updateThemeSetting(e) {';
const LIGHT_PATCHED='updateThemeSetting(e) { e = 0; /* light-only */';
const MAIN_LINE="require('./pc-dist/zadark/js/zadark-main.min');";
const MAIN_ANCHOR="return require('./main-dist/main');";

function strip(html) {
  return html.split(THEME_LOCK).join('').split(SETTINGS_TAG).join('').replace(/\n?[ \t]*<(?:link rel="stylesheet" href|script src)="(?:\.\/)?zadark\/[^"]*"(?:><\/script>|>)/g,'')
    .replace(/ data-zadark-(?:version|os)="[^"]*"/g,'')
    .replace(/<body\b[^>]*>/,body=>{
      let out=body.replace(/ class="([^"]*)"/,(_,c)=>{
        const rest=c.split(/\s+/).filter(x=>x && !BODY_CLASSES.includes(x)).join(' ');
        return rest?` class="${rest}"`:'\u0000';
      });
      return out.replace(/\u0000/g,'');
    });
}
function withBodyClasses(html) {
  return html.replace(/<body\b([^>]*)>/,(_,attrs)=>{
    if(/ class="/.test(attrs))return `<body${attrs.replace(/ class="([^"]*)"/,(_m,c)=>` class="${[...c.split(/\s+/).filter(Boolean),...BODY_CLASSES].join(' ')}"`)}>`;
    return `<body class="${BODY_CLASSES.join(' ')}"${attrs}>`;
  });
}
export function patchPage(html,page,{themeLock=false}={}) {
  let out=strip(html);
  if(themeLock) {
    const meta=out.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/);
    if(meta)out=out.replace(meta[0],meta[0]+THEME_LOCK);
    else if(out.includes('<head>'))out=out.replace('<head>','<head>'+THEME_LOCK);
    else throw new Error('Missing <head>');
  }
  if(page.head.length) {
    if(!out.includes('</head>'))throw new Error('Missing </head>');
    out=out.replace('</head>',`${page.head.join('')}</head>`);
  }
  if(!out.includes('</body>'))throw new Error('Missing </body>');
  out=out.replace(/<\/body>(?![\s\S]*<\/body>)/,`${page.body.join('')}</body>`);
  if(page.html) {
    if(!/<html\b/.test(out))throw new Error('Missing <html>');
    out=out.replace(/<html\b/,`<html data-zadark-version="${ZADARK_VERSION}" data-zadark-os="Linux"`);
  }
  return withBodyClasses(out);
}
export function patchBootstrap(text) {
  if(text.includes(MAIN_LINE))return text;
  if(!text.includes(MAIN_ANCHOR))throw new Error('bootstrap.js entry point not found');
  return text.replace(MAIN_ANCHOR,`${MAIN_LINE}\n    ${MAIN_ANCHOR}`);
}
export function unpatchBootstrap(text) {
  return text.replace(`${MAIN_LINE}\n    `,'');
}
async function bundleFiles(root) {
  const out=[];
  for(const dir of ['pc-dist','pc-dist/lazy']) {
    let names=[];
    try {names=await readdir(path.join(root,dir));} catch {continue;}
    for(const name of names)if(name.endsWith('.js'))out.push(path.join(root,dir,name));
  }
  return out;
}
export function lockLight(text) {return text.split(LIGHT_PATCHED).join(LIGHT_SRC).split(LIGHT_SRC).join(LIGHT_PATCHED);}
export function unlockLight(text) {return text.split(LIGHT_PATCHED).join(LIGHT_SRC);}
async function editBundles(root,fn) {
  const changed=[];
  for(const file of await bundleFiles(root)) {
    const before=await readFile(file,'utf8');
    if(!before.includes(LIGHT_SRC))continue;
    const after=fn(before);
    if(after!==before){await writeFile(file,after);changed.push(path.relative(root,file));}
  }
  return changed;
}
async function edit(file,fn) {
  const before=await readFile(file,'utf8'),after=fn(before);
  if(after!==before)await writeFile(file,after);
  return after!==before;
}
export async function applyZaDark(root) {
  const changed=[];
  for(const [rel,page] of Object.entries(PAGES))
    if(await edit(path.join(root,rel),html=>patchPage(html,page,{themeLock:THEME_LOCK_PAGES.has(rel)})))changed.push(rel);
  if(await edit(path.join(root,'bootstrap.js'),patchBootstrap))changed.push('bootstrap.js');
  changed.push(...await editBundles(root,lockLight));
  return changed;
}
export async function removeZaDark(root) {
  const changed=[];
  for(const rel of Object.keys(PAGES))
    if(await edit(path.join(root,rel),strip))changed.push(rel);
  if(await edit(path.join(root,'bootstrap.js'),unpatchBootstrap))changed.push('bootstrap.js');
  changed.push(...await editBundles(root,unlockLight));
  return changed;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const [action,dir]=process.argv.slice(2);
  const root=path.resolve(dir||path.join(path.dirname(fileURLToPath(import.meta.url)),'..'));
  if(!['apply','remove'].includes(action)){console.error('Usage: node scripts/zadark.mjs apply|remove [appDir]');process.exit(2);}
  const changed=await (action==='apply'?applyZaDark:removeZaDark)(root);
  console.log(`${action==='apply'?'Applied':'Removed'} ZaDark ${ZADARK_VERSION}: ${changed.length?changed.join(', '):'no change'}`);
}
