/** Automatic-activation tabs. Keyboard navigation stays inside the tab list. */
export function tabDestination(key: string, index: number, count: number): number | undefined {
  if (count < 1) return undefined;
  switch (key) {
    case 'ArrowRight': return (index + 1) % count;
    case 'ArrowLeft': return (index - 1 + count) % count;
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return undefined;
  }
}

export function mountSettingsTabs(root: HTMLElement) {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const activate = (index: number, focus = false) => {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls')!);
      if (panel) panel.hidden = !selected;
    });
    if (focus) tabs[index].focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(index));
    tab.addEventListener('keydown', event => {
      const destination = tabDestination(event.key, index, tabs.length);
      if (destination === undefined) return;
      event.preventDefault();
      activate(destination, true);
    });
  });
  activate(0);
}
