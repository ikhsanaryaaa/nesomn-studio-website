// Exercise shipped theme controls (Radix client, native admin), never storage shortcuts.
export async function selectTheme(evaluate, wait, mode) {
  const radix = await evaluate(`(() => {
    const visible = e => e.getBoundingClientRect().height > 0;
    const trigger = [...document.querySelectorAll('[data-theme-control]')].find(visible);
    if (trigger) {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: false, pointerType: 'mouse' }));
      return true;
    } else {
      const select = [...document.querySelectorAll('select.theme-select')].find(visible);
      if (!select) throw Error('Visible theme control missing');
      select.value = ${JSON.stringify(mode)};
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return false;
    }
  })()`);
  if (radix) {
    await wait(`document.querySelector('[data-theme-option="${mode}"]')`);
    await evaluate(`document.querySelector('[data-theme-option="${mode}"]').click()`);
  }
  await wait(`document.documentElement.dataset.theme===${JSON.stringify(mode)}`);
  if (await evaluate('!!document.querySelector(".nesomn-theme-root")'))
    await wait(
      `document.querySelector(".nesomn-theme-root").classList.contains(${JSON.stringify(mode)})`,
    );
}
