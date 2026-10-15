import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {applyZaDark,removeZaDark,patchPage,patchBootstrap,ZADARK_VERSION} from './zadark.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['pc-dist/index.html','pc-dist/znotification.html','pc-dist/popup-viewer.html','bootstrap.js'];
const bundle='pc-dist/lazy/theme-fixture.js';
const bundleText='class T { getTheme() { return 1 }\n updateThemeSetting(e) {\n l.a.trackSwitchTheme({}) } }';
// zadark-settings.js: compiles, installs once, only talks to local DOM and the ZaDark button.
{
  const source=await readFile(path.join(root,'pc-dist/linux-extras/zadark-settings.js'),'utf8');
  new vm.Script(source);
  for(const needle of ['div_TabSetting_Setting','.setting-menu__item','.theme-item','js-zadark-popup','__zaDarkSettingsInstalled'])
    assert.ok(source.includes(needle),`zadark-settings.js uses ${needle}`);
  assert.ok(!/(fetch\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\/)/.test(source),'zadark-settings.js makes no network calls');
  const installed={__zaDarkSettingsInstalled:true,document:{get body(){throw new Error('must not touch the DOM when already installed');}}};
  installed.window=installed;
  vm.runInNewContext(source,installed);
}

// theme-lock.js: boot value, later writes and "follow system" all stay light.
{
  const store=new Map(),setItem=function(k,v){store.set(k,String(v));};
  class Storage {}Storage.prototype.setItem=setItem;
  store.set('za_theme',JSON.stringify({theme:'dark',theme_setting:1,has_used_dark_mode:true}));
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem(k,v){return Storage.prototype.setItem.call(this,k,v);}};
  const darkQuery={matches:true,media:'(prefers-color-scheme: dark)',addEventListener(){return 'listening';}};
  const sandbox={Storage,localStorage,Proxy,JSON,String,window:{matchMedia:q=>q.includes('dark')?darkQuery:{matches:true,media:q}}};
  vm.runInNewContext(await readFile(path.join(root,'pc-dist/linux-extras/theme-lock.js'),'utf8'),sandbox);
  assert.deepEqual(JSON.parse(store.get('za_theme')),{theme:'light',theme_setting:0,has_used_dark_mode:true},'stored dark value is reset at boot');
  localStorage.setItem('za_theme',JSON.stringify({theme:'dark',theme_setting:2,color:'#000'}));
  assert.equal(JSON.parse(store.get('za_theme')).theme,'light','later dark writes stay light');
  assert.equal(JSON.parse(store.get('za_theme')).color,'#000','other fields are kept');
  localStorage.setItem('other','x');assert.equal(store.get('other'),'x','other keys are untouched');
  assert.equal(sandbox.window.matchMedia('(prefers-color-scheme: dark)').matches,false,'system dark never matches');
  assert.equal(sandbox.window.matchMedia('(prefers-color-scheme: dark)').addEventListener(),'listening','media list methods still work');
  assert.equal(sandbox.window.matchMedia('(min-width: 1px)').matches,true,'other media queries are untouched');
}
const dir=await mkdtemp(path.join(tmpdir(),'zadark-test-'));
try {
  // Start from pristine copies: the repo may already be patched, so unpatch first.
  await mkdir(path.join(dir,'pc-dist'),{recursive:true});
  for(const f of files)await copyFile(path.join(root,f),path.join(dir,f));
  await mkdir(path.join(dir,'pc-dist/lazy'),{recursive:true});
  await writeFile(path.join(dir,bundle),bundleText);
  await removeZaDark(dir);
  const pristine=Object.fromEntries(await Promise.all(files.map(async f=>[f,await readFile(path.join(dir,f),'utf8')])));
  for(const f of files)assert.ok(!pristine[f].includes('zadark'),`${f} still mentions zadark after removal`);

  const changed=await applyZaDark(dir);
  assert.deepEqual(changed.sort(),[...files,bundle].sort());
  const index=await readFile(path.join(dir,'pc-dist/index.html'),'utf8');
  assert.match(index,new RegExp(`<html[^>]*data-zadark-version="${ZADARK_VERSION}"[^>]*data-zadark-os="Linux"`));
  assert.match(index,/<body class="[^"]*\bzadark zadark-pc zadark-linux"/);
  assert.ok(!/(?:href|src)="zadark\//.test(index),'tags must not start with the prefix Zalo filters');
  assert.ok(index.indexOf('zadark/libs/zadark-jquery.min.js')<index.indexOf('zadark/js/zadark.min.js'),'libraries load before zadark.min.js');
  assert.ok(index.indexOf('zadark/js/zadark.min.js')<index.indexOf('</body>'));
  assert.ok(index.indexOf('zadark/css/zadark.min.css')<index.indexOf('</head>'));
  assert.ok(index.indexOf('linux-extras/theme-lock.js')>index.indexOf('Content-Security-Policy') && index.indexOf('linux-extras/theme-lock.js')<index.indexOf('<body'),'theme lock loads in <head> after the CSP');
  const settingsTag='<script src="./linux-extras/zadark-settings.js"></script>';
  assert.ok(index.indexOf(settingsTag)>index.indexOf('zadark/js/zadark.min.js') && index.indexOf(settingsTag)<index.indexOf('</body>'),'ZaDark settings entries load after zadark.min.js');
  assert.equal(index.split(settingsTag).length,2,'settings script is added once');
  for(const f of ['pc-dist/znotification.html','pc-dist/popup-viewer.html'])
    assert.ok(!(await readFile(path.join(dir,f),'utf8')).includes('zadark-settings'),`${f} has no settings entries`);
  assert.match(await readFile(path.join(dir,'pc-dist/znotification.html'),'utf8'),/linux-extras\/theme-lock\.js/);
  assert.ok(!(await readFile(path.join(dir,'pc-dist/popup-viewer.html'),'utf8')).includes('theme-lock'),'popup viewer has no theme lock');
  assert.match(await readFile(path.join(dir,bundle),'utf8'),/updateThemeSetting\(e\) \{ e = 0;/,'theme switch forced to light');
  const popup=await readFile(path.join(dir,'pc-dist/popup-viewer.html'),'utf8');
  assert.match(popup,/zadark\/js\/zadark-popup-viewer\.min\.js/);
  assert.ok(popup.includes('linux-extras/loader.js'),'existing Linux viewer loader is kept');
  const boot=await readFile(path.join(dir,'bootstrap.js'),'utf8');
  assert.ok(boot.indexOf("zadark-main.min")<boot.indexOf("return require('./main-dist/main');"),'main hook runs before the return');

  // Privacy: ZaDark's remote hosts must not be allowed by the page policy.
  for(const f of files.slice(0,3)) {
    const text=await readFile(path.join(dir,f),'utf8');
    assert.ok(!text.includes('api.zadark.com') && !text.includes('fonts.googleapis.com'),`${f} must not allow ZaDark remote hosts`);
    assert.equal(text.match(/Content-Security-Policy[^>]*>/)?.[0],pristine[f].match(/Content-Security-Policy[^>]*>/)?.[0],`${f} CSP unchanged`);
  }

  assert.deepEqual(await applyZaDark(dir),[],'apply is idempotent');
  assert.equal(patchPage(patchPage(pristine['pc-dist/index.html'],{head:[],body:['<script src="zadark/js/x.min.js"></script>']}),{head:[],body:['<script src="zadark/js/x.min.js"></script>']}).split('zadark/js/x.min.js').length,2,'no duplicate tags');
  assert.equal(patchBootstrap(patchBootstrap(pristine['bootstrap.js'])),patchBootstrap(pristine['bootstrap.js']));

  assert.deepEqual((await removeZaDark(dir)).sort(),[...files,bundle].sort());
  assert.equal(await readFile(path.join(dir,bundle),'utf8'),bundleText,'bundle restored byte for byte');
  for(const f of files)assert.equal(await readFile(path.join(dir,f),'utf8'),pristine[f],`${f} restored byte for byte`);
  await writeFile(path.join(dir,'bootstrap.js'),'nothing here');
  await assert.rejects(()=>applyZaDark(dir),/entry point|Missing/);
  console.log('PASS zadark: apply/remove round trip, idempotent, load order, Linux markers, CSP and hosts unchanged, light-only theme lock');
} finally {await rm(dir,{recursive:true,force:true});}
