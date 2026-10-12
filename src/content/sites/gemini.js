// Custom element tags are the stable hooks; ng-tns-… classes and localized aria-labels are avoided.
// The send button gets a "stop" class while a reply streams.
if (location.hostname === 'gemini.google.com') {
  // The thinking level only shows inside the mode menu, so remember the one last picked there.
  // Until then assume the lowest, Gemini's default.
  const EFFORT_KEY = 'waterGeminiEffort';
  let effort = localStorage.getItem(EFFORT_KEY) ?? 'ต่ำสุด';
  document.addEventListener('click', (e) => {
    const text = e.target.closest?.('[role^="menuitem"], .mat-mdc-menu-item')?.textContent ?? '';
    const hit = Object.keys(RATES.gemini.efforts).find((k) => text.includes(k));
    if (hit) localStorage.setItem(EFFORT_KEY, (effort = hit));
  }, true);

  chatSite({
    rates: RATES.gemini,
    box: 'input-area-v2, input-container',
    composer: 'rich-textarea .ql-editor[contenteditable="true"]',
    send: 'button.send-button:not(.stop), [data-test-id="send-button"]',
    model: ['[data-test-id="bard-mode-menu-button"]'],
    badgeAt: { at: ['[data-test-id="bard-mode-menu-button"]'], where: 'after' }, // left of "Flash ⌄", same row
    label: () => effort,
  });
}
