// claude.ai only: 💧 speed badge on the model selector, and flood() on every prompt sent.

const MODEL_SELECTOR = '[data-testid="model-selector-dropdown"]';

const speedBadge = document.createElement('span');
speedBadge.title = 'Water rise speed for this model';
speedBadge.style.cssText = 'align-self:center;margin:0 6px;font-size:12px;white-space:nowrap;opacity:.8;pointer-events:none';

function modelMultiplier() {
  const label = document.querySelector(MODEL_SELECTOR)?.textContent.toLowerCase() ?? '';
  const pick = (table) => Object.entries(table).find(([k]) => label.includes(k))?.[1] ?? 1;
  return pick(MODELS) * pick(EFFORTS);
}

// Keep the badge next to the model selector; React re-renders it, so re-check on DOM changes.
function placeBadge() {
  const btn = document.querySelector(MODEL_SELECTOR);
  if (!btn) return;
  if (btn.nextElementSibling !== speedBadge) btn.after(speedBadge);
  const text = `💧 ×${modelMultiplier().toFixed(2).replace(/\.?0+$/, '')}`;
  if (speedBadge.textContent !== text) speedBadge.textContent = text; // only write when changed → no loop
}

if (location.hostname === 'claude.ai') {
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; placeBadge(); });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  placeBadge();

  // Capture phase: runs before ProseMirror/React clear the input.
  document.addEventListener('keydown', (e) => {
    const input = e.target.closest?.('[data-testid="chat-input"]');
    if (input && e.key === 'Enter' && !e.shiftKey && !e.isComposing && input.textContent.trim()) flood(modelMultiplier());
  }, true);

  document.addEventListener('click', (e) => {
    const send = e.target.closest?.('[data-testid="chat-input-send"]');
    if (send && !send.disabled) flood(modelMultiplier());
  }, true);
}
