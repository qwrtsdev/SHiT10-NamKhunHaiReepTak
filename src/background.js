// Clicking the extension icon drains the water on every tab.
chrome.action.onClicked.addListener(() => chrome.storage.local.set({ target: 0 }));
