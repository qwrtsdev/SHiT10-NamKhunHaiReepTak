// Shared prompt detection for AI chat sites. Each file in systems/ calls chatSite() for its own host.
// Adds a "💧 ×N" speed badge after the model selector and calls flood(N) whenever a prompt is sent:
// Enter in the composer (when it has text) or a click on the send button.
//   rates:    a RATES entry from config.js
//   composer: selector for the typing box
//   send:     selector for the send button
//   model:    selectors for the model selector, tried in order (optional; without it N = 1, no badge)

function chatSite({ rates, composer, send, model = [] }) {
  const badge = document.createElement('span');
  badge.title = 'Water rise speed for this model';
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

  // Enter can also trigger a click on the send button; count one prompt either way.
  let lastSent = 0;
  function sent() {
    if (performance.now() - lastSent < 600) return;
    lastSent = performance.now();
    flood(multiplier());
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
    if ((input.value ?? input.textContent).trim()) sent();
  }, true);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.(send);
    if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') sent();
  }, true);
}
