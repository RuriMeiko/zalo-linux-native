(() => {
  const bar=document.querySelector('#titleBar'),buttons=[...bar.querySelectorAll('button')];
  const host=bar.closest('.media-viewer__title-bar'),viewer=!!host;
  const shell=bar.closest('.fixture'),rect=bar.getBoundingClientRect();
  const hostRect=(host||bar).getBoundingClientRect(),shellRect=shell.getBoundingClientRect();
  const shellLeft=shellRect.left+shell.clientLeft,shellRight=shellLeft+shell.clientWidth;
  if(rect.height!==32 || hostRect.height!==32 || (viewer && rect.width!==hostRect.width) ||
    rect.left!==shellLeft || rect.right!==shellRight || buttons.length!==(viewer?3:4))
    throw new Error('Unexpected unified image header layout');
  for(const button of buttons) {
    const bounds=button.getBoundingClientRect();
    if(bounds.width!==24 || bounds.height!==24 || bounds.top<rect.top || bounds.bottom>rect.bottom ||
      bounds.left<rect.left || bounds.right>rect.right)throw new Error('Window button escapes header');
    if(!button.querySelector('svg'))throw new Error('Missing SVG window symbol');
  }
  const title=bar.querySelector('.title-name');
  const titleStyle=getComputedStyle(title);
  if(titleStyle.color!=='rgb(246, 245, 244)' || titleStyle.fontSize!=='13px')
    throw new Error('Image title typography regressed');
  return `PASS rendered ${viewer?'image':'main'} header: shared 32px bar, contained 24px controls, 13px title`;
})();
