// Shared prompt detection for AI chat sites. Each file in systems/ calls chatSite() for its own host.
// Adds a "💧 ×N" badge after the model selector and calls flood(prompt length, N) whenever a prompt is
// sent: Enter in the composer (when it has text) or a click on the send button.
//   rates:    a RATES entry from config.js
//   composer: selector for the typing box
//   send:     selector for the send button
//   model:    selectors for the model selector, tried in order (optional; without it N = 1, no badge)

function chatSite({ rates, composer, send, model = [] }) {
  const badge = document.createElement('span');
  badge.title = 'Water per prompt = characters × this multiplier';
  badge.style.cssText = 'align-self:center;margin:0 6px;font-size:12px;white-space:nowrap;opacity:.8;pointer-events:none';

  const selector = () => model.map((s) => document.querySelector(s)).find(Boolean);
  const multiplier = () => {
    const label = selector()?.textContent.toLowerCase() ?? '';
    const pick = (table) => Object.entries(table).find(([k]) => label.includes(k))?.[1] ?? 1;
    return pick(rates.models) * pick(rates.efforts);
  };

  // Keep the badge next to the model selector; the apps re-render it, so re-check on DOM changes.
  function placeBadge() {
    const btn = selector();
    if (!btn) return;
    if (btn.nextElementSibling !== badge) btn.after(badge);
    const text = `💧 ×${multiplier().toFixed(2).replace(/\.?0+$/, '')}`;
    if (badge.textContent !== text) badge.textContent = text; // only write when changed → no loop
  }

  const promptLength = (el) => [...(el?.value ?? el?.textContent ?? '').trim()].length;

  // Enter can also trigger a click on the send button; count one prompt either way.
  let lastSent = 0;
  function sent(chars) {
    if (!chars || performance.now() - lastSent < 600) return;
    lastSent = performance.now();
    flood(chars, multiplier());
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; placeBadge(); });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  placeBadge();

  // Capture phase: runs before the app's editor (ProseMirror / Quill / React) clears the input.
  document.addEventListener('keydown', (e) => {
    const input = e.target.closest?.(composer);
    if (!input || e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    sent(promptLength(input));
  }, true);

  // From INPUT_LOCK_AT the composer is greyed out and refuses clicks, focus and typing.
  const lockStyle = document.createElement('style');
  lockStyle.textContent = `${composer} { opacity: .4 !important; cursor: not-allowed !important; }`;
  const inComposer = (e) => water.level >= INPUT_LOCK_AT && e.target.closest?.(composer);
  for (const type of ['pointerdown', 'mousedown', 'click', 'beforeinput', 'paste', 'drop']) {
    document.addEventListener(type, (e) => {
      if (!inComposer(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  }
  document.addEventListener('focusin', (e) => inComposer(e) && e.target.blur(), true);
  effects.push(() => {
    const locked = water.level >= INPUT_LOCK_AT;
    if (locked === lockStyle.isConnected) return;
    if (!locked) return lockStyle.remove();
    document.head.append(lockStyle);
    if (document.activeElement?.closest?.(composer)) document.activeElement.blur();
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.(send);
    if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') sent(promptLength(document.querySelector(composer)));
  }, true);
}
