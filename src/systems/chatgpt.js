// chatgpt.com (React). Selectors from the 2026-10 DOM; the model switcher isn't documented there,
// so the badge tries the usual candidates. The submit button turns into a stop button while a reply
// streams (data-testid="stop-button"), which is not counted.
if (location.hostname === 'chatgpt.com' || location.hostname === 'chat.openai.com') {
  chatSite({
    rates: RATES.chatgpt,
    composer: 'form[data-chatgpt-composer] [contenteditable="true"], #prompt-textarea',
    send: '[data-testid="send-button"], #composer-submit-button:not([data-testid="stop-button"])',
    model: [
      '[data-testid="model-switcher-dropdown-button"]',
      'header[data-app-shell-titlebar] button[aria-haspopup="menu"]',
      'form[data-chatgpt-composer] .__composer-pill', // the "Think" pill
      '[data-testid="composer-trailing-actions"]',
    ],
    // In the chat box, just left of the right-hand buttons (Think / mic / send).
    badgeAt: {
      at: ['[data-testid="composer-trailing-actions"]', '[data-testid="composer-speech-button"]', '#composer-submit-button', '[data-testid="send-button"]'],
      where: 'before',
    },
  });
}
