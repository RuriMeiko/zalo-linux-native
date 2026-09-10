// Run via agent-browser eval --stdin on viewer-extras-fixture.html only.
(async () => {
  if (!location.pathname.endsWith('/scripts/viewer-extras-fixture.html')) throw Error('Fixture required');
  const check = (ok, message) => {if (!ok) throw Error(message);};
  const wait = async (predicate, label = 'condition') => {
    window.fixtureStep = label;
    const deadline = performance.now() + 4000;
    while (!predicate()) {
      if (performance.now() > deadline) throw Error('Condition timeout: ' + label);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  };
  const button = title => [...document.querySelectorAll('button')].find(b => b.title === title || b.textContent === title);
  button('Open fixture image').click();
  await wait(() => button('Vẽ / chú thích'));
  check(window.fabric.version === '5.3.0', 'Dependency version');
  button('Vẽ / chú thích').click();
  await wait(() => button('Copy ảnh') && !button('Copy ảnh').disabled);
  const lower = document.querySelector('.lower-canvas'), upper = document.querySelector('.upper-canvas');
  const original = lower.toDataURL();
  const rect = upper.getBoundingClientRect();
  button('Khung (R)').click();
  const send = (target, type, x, y, buttons) => target.dispatchEvent(new MouseEvent(type, {
    bubbles: true, clientX: rect.left + x, clientY: rect.top + y, button: 0, buttons
  }));
  send(upper, 'mousedown', 50, 50, 1);
  send(document, 'mousemove', 240, 150, 1);
  send(document, 'mouseup', 240, 150, 0);
  await wait(() => lower.toDataURL() !== original);
  let annotated = lower.toDataURL();
  button('Hoàn tác (Ctrl+Z)').click();
  await wait(() => lower.toDataURL() === original);
  button('Làm lại (Ctrl+Y)').click();
  await wait(() => lower.toDataURL() === annotated);
  button('Chọn / di chuyển (V)').click();
  send(upper, 'mousedown', 100, 90, 1);
  send(document, 'mouseup', 100, 90, 0);
  button('#2d7dff').click();
  // Compare exported content, not Fabric's active-selection decoration.
  send(upper, 'mousedown', 500, 300, 1);
  send(document, 'mouseup', 500, 300, 0);
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await wait(() => lower.toDataURL() !== annotated, 'recolor changes pixels');
  const recolored = lower.toDataURL();
  button('Hoàn tác (Ctrl+Z)').click();
  await wait(() => lower.toDataURL() === annotated, 'undo recolor restores rectangle');
  button('Làm lại (Ctrl+Y)').click();
  await wait(() => lower.toDataURL() === recolored, 'redo recolor restores blue');
  annotated = recolored;
  button('In ảnh đã vẽ').click();
  await wait(() => document.querySelector('.zpf-page-img')?.complete);
  const preview = document.querySelector('.zpf-page-img');
  check(preview.naturalWidth === 640 && preview.naturalHeight === 400, 'Original-resolution annotated preview');
  check(preview.src === annotated, 'Preview must include the annotation');
  check(!button('In').disabled, 'Print is enabled after image load');
  // No actual clipboard write and no native printer job in this test.
  document.querySelector('#titleBar').classList.add('locked');
  await wait(() => !document.querySelector('.zpf-modal-backdrop, .zpf-veditor-backdrop'));
  button('Vẽ / chú thích').click();
  check(!document.querySelector('.zpf-veditor-backdrop'), 'Editor blocked while locked');
  document.querySelector('#titleBar').classList.remove('locked');
  check(window.fixtureErrors.length === 0, JSON.stringify(window.fixtureErrors));
  return {pass: true, tested: ['lazy loading', 'real Fabric rectangle', 'pixel-exact undo/redo', 'recolor undo/redo',
    'annotated original-resolution print preview', 'lock cleanup', 'locked open guard'],
    notTested: ['real Zalo account', 'OS clipboard', 'native printer dialog']};
})();
