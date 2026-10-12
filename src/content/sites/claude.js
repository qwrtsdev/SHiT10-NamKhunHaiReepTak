if (location.hostname === 'claude.ai') {
  chatSite({
    rates: RATES.claude,
    composer: '[data-testid="chat-input"]',
    send: '[data-testid="chat-input-send"]',
    model: ['[data-testid="model-selector-dropdown"]'],
    // No stable tag around card + toolbar: the nearest div that also holds the model picker.
    box: 'div:has([data-testid="model-selector-dropdown"])',
  });
}
