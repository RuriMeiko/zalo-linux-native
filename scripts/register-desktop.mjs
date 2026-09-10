#!/usr/bin/env node
import {readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyInstallation} from './verify-installation.mjs';

export function desktopEntry(installation) {
  if(typeof installation!=='string' || !path.isAbsolute(installation) || path.normalize(installation)!==installation ||
    /[\x00-\x1f\x7f%=]/.test(installation))throw new Error('Unsupported desktop installation path');
  // Exec quoting, followed by desktop string escaping. No shell is invoked.
  const executable=path.join(installation,'launch-installed.sh');
  const quoted=executable.replace(/["`$\\]/g,character=>'\\'+character).replace(/\\/g,'\\\\');
  return `[Desktop Entry]\nType=Application\nVersion=1.0\nName=Zalo Linux Native\nComment=Independent Linux port of Zalo\nExec="${quoted}"\nIcon=internet-chat\nTerminal=false\nCategories=Network;InstantMessaging;\nStartupNotify=false\n`;
}
export async function registerDesktop(installation,{home=homedir(),check=false}={}) {
  const contents=desktopEntry(installation);
  const relative=path.relative(home,installation);
  if(!relative || relative==='..' || relative.startsWith('../') || path.isAbsolute(relative))throw new Error('Installation must be inside home');
  if(await realpath(installation)!==installation)throw new Error('Installation must not traverse symlinks');
  await verifyInstallation(installation,{requireGenerated:true});
  const directory=path.join(home,'.local/share/applications');
  if(await realpath(directory)!==directory)throw new Error('Applications directory must exist without symlink traversal');
  const target=path.join(directory,'zalo-linux-native.desktop');
  try {
    const info=await lstat(target);
    if(check && info.isFile() && await realpath(target)===target && await readFile(target,'utf8')===contents)return target;
    throw new Error('Menu entry already exists; preserve or remove it explicitly before registering');
  } catch(error){if(error.code!=='ENOENT')throw error;}
  if(!check)await writeFile(target,contents,{flag:'wx',mode:0o644});
  return target;
}
async function main() {
  const args=process.argv.slice(2),check=args.includes('--check'),pos=args.filter(a=>a!=='--check');
  if(pos.length!==1 || pos[0].startsWith('--') || args.length>(check?2:1))
    throw new Error('Usage: node scripts/register-desktop.mjs INSTALLED_HOME_DIRECTORY [--check]');
  const target=await registerDesktop(pos[0],{check});
  console.log(check?'PASS menu registration preflight; no files changed':`Registered ${target}; app not launched`);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
