(() => {
  const bar=document.querySelector('#titleBar'),buttons=[...bar.querySelectorAll('button')];
  const rect=bar.getBoundingClientRect();
  if(rect.height!==46 || buttons.length!==3)throw new Error('Unexpected image header layout');
  for(const button of buttons) {
    const bounds=button.getBoundingClientRect();
    if(bounds.width!==24 || bounds.height!==24 || bounds.top<rect.top || bounds.bottom>rect.bottom ||
      bounds.left<rect.left || bounds.right>rect.right)throw new Error('Window button escapes header');
    if(!button.querySelector('svg'))throw new Error('Missing SVG window symbol');
  }
  const title=bar.querySelector('.title-name');
  if(getComputedStyle(title).color!=='rgb(246, 245, 244)')throw new Error('Image title contrast regressed');
  return 'PASS rendered image header: 46px bar, contained 24px SVG controls, light title';
})();
