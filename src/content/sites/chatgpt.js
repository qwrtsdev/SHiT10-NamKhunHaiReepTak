// The model switcher has no documented selector, so try the usual candidates. While a reply streams,
// the submit button becomes data-testid="stop-button", which must not count.
if (location.hostname === 'chatgpt.com' || location.hostname === 'chat.openai.com') {
  chatSite({
    rates: RATES.chatgpt,
    box: 'form',
    composer: 'form[data-chatgpt-composer] [contenteditable="true"], #prompt-textarea',
    send: '[data-testid="send-button"], #composer-submit-button:not([data-testid="stop-button"])',
    model: [
      '[data-testid="model-switcher-dropdown-button"]',
      'header[data-app-shell-titlebar] button[aria-haspopup="menu"]',
      'form:has(#prompt-textarea) button[aria-pressed="true"]', // the "Think" toggle, only while it's on
      'form[data-chatgpt-composer] .__composer-pill', // older UI: the "Think" pill
    ],
    // In the chat box, between "Think" and the mic. aria-labels follow the UI language (English here),
    // so the older data-testids stay as fallbacks.
    badgeAt: {
      at: [
        'form:has(#prompt-textarea) button[aria-label="Dictate"]',
        'form:has(#prompt-textarea) button[aria-label="Start Voice"]',
        '[data-testid="composer-speech-button"]', '#composer-submit-button', '[data-testid="send-button"]',
      ],
      where: 'before',
    },
  });
}
