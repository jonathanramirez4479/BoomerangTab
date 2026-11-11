const KEY = 'closedByWindow';
const load = async () => (await chrome.storage.session.get(KEY))[KEY] ?? {};

chrome.tabs.onRemoved.addListener(async (tabId, { isWindowClosing, windowId }) => {
  if (isWindowClosing) return; // whole-window closes are recorded as a window session

  await new Promise(r => setTimeout(r, 150)); // let Chrome register the session entry

  const [latest] = await chrome.sessions.getRecentlyClosed({ maxResults: 1 });
  if (!latest?.tab) return;
  const map = await load();

  if (!map[windowId])
    map[windowId] = [];

  map[windowId].push(latest.tab.sessionId);
  map[windowId] = map[windowId].slice(-25);

  await chrome.storage.session.set({ [KEY]: map });
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'reopen-window-tab') return;

  const windowId = tab?.windowId ?? (await chrome.windows.getLastFocused()).id;

  const map = await load();
  const stack = map[windowId] ?? [];

  while (stack.length) {
    const sessionId = stack.pop();
    await chrome.storage.session.set({ [KEY]: map });
    try {
      await chrome.sessions.restore(sessionId);
      return;
    }
    catch { } // entry expired from Chrome's list, try the next one
  }
})
