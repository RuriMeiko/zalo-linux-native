import {spawn} from 'node:child_process';
// Use GTK window controls and explicit buttons. Never put account/session data
// in process arguments or interpret remote strings as markup.
export function callDialog(kind,{video=false,signal},launch=spawn) {
  if(!['consent','active'].includes(kind) || !signal || typeof signal.addEventListener!=='function')
    return Promise.reject(new Error('Invalid native call dialog'));
  if(signal.aborted)return Promise.reject(new Error('Call dialog canceled'));
  const args=kind==='consent'?['--question','--title=Zalo — Cuộc gọi đến','--no-markup',
    `--text=${video?'Cuộc gọi video đến':'Cuộc gọi thoại đến'}`,'--ok-label=Trả lời','--cancel-label=Bỏ qua']:
    ['--info','--title=Zalo — Cuộc gọi','--no-markup','--text=Đã trả lời. Bạn có thể kết thúc cuộc gọi tại đây.','--ok-label=Kết thúc'];
  return new Promise((resolve,reject)=>{
    let child,timer,failed=false;
    const abort=()=>{child?.kill('SIGTERM');timer??=setTimeout(()=>child?.kill('SIGKILL'),1000);};
    const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);};
    try {child=launch('zenity',args,{stdio:'ignore'});}catch {reject(new Error('Native call dialog unavailable'));return;}
    child.once('error',()=>{failed=true;});
    child.once('close',code=>{
      cleanup();
      if(signal.aborted)reject(new Error('Call dialog canceled'));
      else if(failed || ![0,1].includes(code))reject(new Error('Native call dialog unavailable'));
      else resolve(kind==='consent'?code===0:true);
    });
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  });
}
