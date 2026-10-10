// claude.ai
if (location.hostname === 'claude.ai') {
  chatSite({
    rates: RATES.claude,
    composer: '[data-testid="chat-input"]',
    send: '[data-testid="chat-input-send"]',
    model: ['[data-testid="model-selector-dropdown"]'],
  });
}
