// chatSite(): prompt detection, the 💧 ×N badge and the chat box lock for one AI chat site.
//   rates:    a RATES entry from config.js
//   composer: selector for the typing box
//   send:     selector for the send button
//   model:    selectors for the model selector, tried in order (optional; without it N = 1, no badge)
//   label:    () => extra text matched against the rate tables, for a setting not visible on the page
//   box:      selector for the whole input block around the composer (card + its buttons), matched with
//             composer.closest(box); locked as one piece from INPUT_LOCK_AT (falls back to the composer)

// badgeAt: where the badge goes, { at: selectors, where: 'before' | 'after' } (default: after the model picker).
function chatSite({ rates, composer, send, model = [], badgeAt = { at: model, where: 'after' }, box = 'form, fieldset', label: extraLabel = () => '' }) {
  // all:initial plus its own sizing, so the host's flex/grid layout can't stretch, wrap or squash it.
  const badge = document.createElement('span');
  badge.title = 'น้ำต่อข้อความ = จำนวนตัวอักษร × ตัวคูณนี้';
  badge.style.cssText = 'all:initial;display:inline-flex;align-items:center;gap:4px;flex:none;align-self:center;' +
    'margin:0 8px;font-family:inherit;font-size:13px;line-height:1;color:inherit;white-space:nowrap;pointer-events:none';
  const badgeText = document.createElement('span');
  badgeText.style.cssText = 'font-size:11px;opacity:.65';
  badge.append('💧', badgeText);

  const first = (selectors) => selectors.map((s) => document.querySelector(s)).find(Boolean);
  // every model/effort label found (ChatGPT splits them: model in the header, "Think" in the composer).
  const modelLabel = () => [...model.map((s) => document.querySelector(s)?.textContent ?? ''), extraLabel()].join(' ').toLowerCase();
  const multiplier = (label = modelLabel()) => {
    const pick = (table) => Object.entries(table).find(([k]) => label.includes(k))?.[1] ?? 1;
    return pick(rates.models) * pick(rates.efforts);
  };

  // Climb out of single-child wrappers to the element that sits in a horizontal row, so the badge lands
  // beside it instead of wrapping below (Gemini).
  function rowItem(el) {
    for (let i = 0; i < 4 && el.parentElement; i++, el = el.parentElement) {
      const p = el.parentElement, s = getComputedStyle(p);
      if (s.display.includes('flex') && !s.flexDirection.startsWith('column') && p.children.length > 1) return el;
    }
    return el;
  }

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function bounce() {
    if (reduceMotion.matches) return;
    badge.animate([
      { transform: 'none' },
      { transform: 'translateY(2px) scale(1.3, 0.7)', offset: 0.1 },
      { transform: 'translateY(-18px) scale(1.6) rotate(-8deg)', offset: 0.3 },
      { transform: 'translateY(0) scale(1.35, 0.75)', offset: 0.5 },
      { transform: 'translateY(-8px) scale(1.2) rotate(5deg)', offset: 0.65 },
      { transform: 'translateY(0) scale(1.1, 0.9)', offset: 0.8 },
      { transform: 'translateY(-3px) scale(1.05)', offset: 0.9 },
      { transform: 'none' },
    ], { duration: 900, easing: 'ease-out' });
    setTimeout(() => splashBadge(10, 28), 450);
    setTimeout(() => splashBadge(5, 14), 720);
  }

  // fixed on <body>, so the chat box can't clip the droplets.
  function splashBadge(count, power) {
    const r = badge.getBoundingClientRect();
    if (!r.width) return;
    for (let i = 0; i < count; i++) {
      const drop = document.createElement('span'), size = 3 + Math.random() * 4;
      drop.style.cssText = `all:initial;position:fixed;left:${r.left + r.width / 2}px;top:${r.bottom - 4}px;` +
        `width:${size}px;height:${size * 1.3}px;border-radius:50%;background:rgba(80,170,255,.9);pointer-events:none;z-index:2147483647`;
      document.body.append(drop);
      const angle = -Math.PI * (0.1 + 0.8 * Math.random()), dist = power * (0.6 + 0.6 * Math.random());
      const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist;
      drop.animate([
        { transform: 'translate(-50%, -50%)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx * 1.5}px), calc(-50% + 12px)) scale(.4)`, opacity: 0 },
      ], { duration: 550 + Math.random() * 200, easing: 'cubic-bezier(.2, .7, .4, 1)' }).onfinish = () => drop.remove();
    }
  }

  // keep the badge in place; the apps re-render, so re-check on DOM changes.
  let lastLabel = '';
  function placeBadge() {
    const anchor = first(badgeAt.at);
    if (!anchor) return;
    const item = rowItem(anchor);
    if (badgeAt.where === 'before' ? item.previousElementSibling !== badge : item.nextElementSibling !== badge) item[badgeAt.where](badge);
    const label = modelLabel();
    if (label !== lastLabel) {
      if (lastLabel) bounce(); // not on the first label the page shows
      lastLabel = label;
    }
    const text = `×${multiplier(label).toFixed(2).replace(/\.?0+$/, '')}`;
    if (badgeText.textContent !== text) badgeText.textContent = text; // only write when changed → no loop
  }

  const promptLength = (el) => [...(el?.value ?? el?.textContent ?? '').trim()].length;

  // enter can also trigger a click on the send button; count one prompt either way.
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

  // capture phase: runs before the app's editor (ProseMirror / Quill / React) clears the input.
  document.addEventListener('keydown', (e) => {
    const input = e.target.closest?.(composer);
    if (!input || e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    sent(promptLength(input));
  }, true);

  // found from the composer each time: the apps re-render it.
  const lockStyle = document.createElement('style');
  lockStyle.textContent = '[data-water-locked] { opacity: .4 !important; } ' +
    '[data-water-locked], [data-water-locked] * { cursor: not-allowed !important; }';
  const locked = () => water.level >= INPUT_LOCK_AT;
  const inputBox = () => {
    const c = document.querySelector(composer);
    return c?.closest(box) ?? c;
  };
  const inBox = (e) => locked() && inputBox()?.contains(e.target);
  let refusedAt = 0;
  function refuse() {
    if (performance.now() - refusedAt < 800) return; // one click can both land on the box and focus it
    refusedAt = performance.now();
    showAlert({ icon: '⌨️', text: 'น้ำเข้าแป้นพิมพ์หมดแล้ว พิมพ์ไม่ได้แล้ว!', danger: true });
  }
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'dblclick', 'contextmenu', 'beforeinput', 'paste', 'drop']) {
    document.addEventListener(type, (e) => {
      if (!inBox(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (type === 'pointerdown') refuse();
    }, true);
  }
  document.addEventListener('focusin', (e) => {
    if (!inBox(e)) return;
    e.target.blur();
    refuse();
  }, true);
  let lockedBox = null;
  effects.push(() => {
    const el = locked() ? inputBox() : null;
    if (el !== lockedBox) {
      lockedBox?.removeAttribute('data-water-locked');
      el?.setAttribute('data-water-locked', '');
      if (el?.contains(document.activeElement)) document.activeElement.blur();
      lockedBox = el;
    }
    if (!!el !== lockStyle.isConnected) el ? document.head.append(lockStyle) : lockStyle.remove();
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.(send);
    if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') sent(promptLength(document.querySelector(composer)));
  }, true);
}
