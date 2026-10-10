// gemini.google.com (Angular). Custom element tags are the stable hooks; class names like ng-tns-…
// and aria-labels (localized) are avoided. The send button gets a "stop" class while a reply streams.
if (location.hostname === 'gemini.google.com') {
  chatSite({
    rates: RATES.gemini,
    composer: 'rich-textarea .ql-editor[contenteditable="true"]',
    send: 'button.send-button:not(.stop), [data-test-id="send-button"]',
    model: ['[data-test-id="bard-mode-menu-button"]'],
  });
}
