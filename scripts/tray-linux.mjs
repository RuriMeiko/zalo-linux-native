#!/usr/bin/env node
// Adds "Kiểm tra cập nhật" to Zalo's tray menu on Linux.
//
// Where the menu comes from: main-dist/main.js builds a Menu template and calls
// Tray#setContextMenu. Electron 22 attaches setContextMenu to each Tray *instance*
// and exposes electron.Tray as a non-configurable getter, so wrapping the API from
// outside is impossible. The bundle template is the only reliable place, which is
// also how scripts/zadark.mjs already edits this build.
//
// Two templates exist: logged-in (with "Đổi trạng thái") and logged-out. Both get
// the entry directly after "Mở Zalo".
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const LABEL='Kiểm tra cập nhật';
const MARKER='label: "'+LABEL+'"';
const ANCHOR=[
'                                    label: "Mở Zalo",',
'                                    click: en',
'                                },'
].join("\n");

// Rendered into the template. Kept as a string so patchBundle stays a pure function.
export const ITEM="{\n    label: \"Kiểm tra cập nhật\",\n    click: () => {\n        try {\n            const cp = require(\"child_process\"),\n                fs = require(\"fs\"),\n                p = require(\"path\"),\n                root = p.join(__dirname, \"..\"),\n                script = p.join(root, \"scripts/update-native.mjs\"),\n                {Notification} = require(\"electron\");\n            const done = (body) => {\n                try { new Notification({title: \"Kiểm tra cập nhật\", body}).show(); }\n                catch (e) { console.log(\"[update] \" + body); }\n            };\n            // process.execPath here is Electron, not Node: running the updater\n            // with it re-launches Electron without --no-sandbox and aborts with\n            // a SUID sandbox error. launch-installed.sh pins the real Node path.\n            let node = null;\n            try {\n                const launcher = fs.readFileSync(p.join(root, \"launch-installed.sh\"), \"utf8\");\n                const match = launcher.match(/^ZALO_INSTALLED_NODE='([^']+)'/m);\n                if (match && fs.existsSync(match[1])) node = match[1];\n            } catch (_) {}\n            if (!node) {\n                done(\"Không tìm thấy Node.js của bản cài đặt; hãy cài lại Zalo.\");\n                return;\n            }\n            if (!fs.existsSync(script)) {\n                done(\"Bản chạy từ mã nguồn: hãy dùng git pull.\");\n                return;\n            }\n            done(\"Đang kiểm tra...\");\n            cp.execFile(node, [script, \"--check\", \"--app-dir\", root],\n                {timeout: 180000}, (error, stdout, stderr) => {\n                    if (error && error.code === 10)\n                        return done(\"Có bản mới. Thoát hẳn Zalo rồi mở lại để cập nhật.\");\n                    if (error && error.code === 3)\n                        return done(\"Có bản mới nhưng Zalo đang chạy. Thoát hẳn rồi mở lại.\");\n                    if (error)\n                        return done(\"Kiểm tra thất bại: \" + String(stderr || error.message || \"\").trim().split(\"\\n\").pop());\n                    done(\"Bạn đang dùng bản mới nhất.\");\n                });\n        } catch (error) {\n            console.log(\"[update] tray check failed: \" + (error && error.message));\n        }\n    }\n}";

export function patchBundle(text) {
  if(typeof text!=='string')throw new TypeError('Bundle text must be a string');
  if(text.includes(MARKER))return {text,changed:false};
  const count=text.split(ANCHOR).length-1;
  // Both templates must be present; any other count means the bundle changed shape.
  if(count!==2)throw new Error('Expected 2 "Mở Zalo" anchors, found '+count);
  return {text:text.split(ANCHOR).join(ANCHOR+' '+ITEM+','),changed:true};
}
export function unpatchBundle(text) {
  if(typeof text!=='string')throw new TypeError('Bundle text must be a string');
  if(!text.includes(MARKER))return {text,changed:false};
  const withItem=ANCHOR+' '+ITEM+',';
  const count=text.split(withItem).length-1;
  if(count!==2)throw new Error('Expected 2 patched anchors, found '+count);
  return {text:text.split(withItem).join(ANCHOR),changed:true};
}
// Keeps INSTALL-COMPLETE.json consistent with the edited bundle. Source checkouts
// have no manifest, so this is a no-op there.
async function refreshManifestHash(root,relative,content) {
  const marker=path.join(root,'INSTALL-COMPLETE.json');
  let raw;
  try {raw=await readFile(marker,'utf8');} catch {return;}
  const manifest=JSON.parse(raw);
  const entry=Array.isArray(manifest.files)?manifest.files.find(item=>item.file===relative):null;
  if(!entry)return;
  const sha256=createHash('sha256').update(content).digest('hex');
  if(entry.sha256===sha256)return;
  entry.sha256=sha256;
  await writeFile(marker,JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
}
async function main() {
  const [action,dir]=process.argv.slice(2);
  const root=path.resolve(dir||path.join(path.dirname(fileURLToPath(import.meta.url)),'..'));
  if(!['apply','remove','status'].includes(action)) {
    console.error('Usage: node scripts/tray-linux.mjs apply|remove|status [appDir]');
    process.exitCode=2;
    return;
  }
  const file=path.join(root,'main-dist/main.js');
  const before=await readFile(file,'utf8');
  if(action==='status') {
    console.log(before.includes(MARKER)?'tray update entry: present':'tray update entry: absent');
    return;
  }
  const result=action==='apply'?patchBundle(before):unpatchBundle(before);
  if(result.changed) {
    await writeFile(file,result.text);
    // The installed manifest hashes every payload file, so an edited bundle must
    // update its entry or verify-installation.mjs refuses to launch Zalo.
    await refreshManifestHash(root,'main-dist/main.js',result.text);
  }
  console.log((action==='apply'?'Added':'Removed')+' tray update entry: '+(result.changed?'changed':'no change'));
}
if(process.argv[1]===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error(error.message);process.exitCode=1;});