// Best-effort generic selectors, untested on the live sites; no model badge (×1).
const OTHER_CHAT_HOSTS = [
  'grok.com', 'chat.deepseek.com', 'www.perplexity.ai', 'perplexity.ai',
  'chat.mistral.ai', 'copilot.microsoft.com', 'chat.qwen.ai', 'www.meta.ai',
];
if (OTHER_CHAT_HOSTS.includes(location.hostname)) {
  chatSite({
    rates: RATES.other,
    composer: 'textarea, [contenteditable="true"]',
    send: 'button[type="submit"], button[aria-label*="send" i], button[data-testid*="send" i]',
  });
}
