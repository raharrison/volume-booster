const POPUP_WIDTH_WINDOWS = 341;
const POPUP_WIDTH_OTHER = 327;
const POPUP_HEIGHT = 430;
const POPUP_RIGHT_MARGIN = 235;
const POPUP_TOP = 100;

new class {
  constructor() {
    this.displayBounds = null;
    this.run();
  }

  run() {
    chrome.action.onClicked.addListener(async (tab) => {
      if (!tab.id) return;
      await this.openOrFocusPopup(tab.id);
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      chrome.storage.local.remove([`popup_${tabId}`, `volume_${tabId}`]);
    });
  }

  async getDisplayBounds() {
    if (this.displayBounds) return this.displayBounds;
    return new Promise((resolve) => {
      chrome.system.display.getInfo(null, (displays) => {
        this.displayBounds = displays[0].bounds;
        resolve(this.displayBounds);
      });
    });
  }

  async openOrFocusPopup(tabId) {
    const existingWindowId = await this.getStoredPopupId(tabId);

    if (existingWindowId) {
      const win = await this.getWindow(existingWindowId);
      if (win) {
        chrome.windows.update(existingWindowId, { focused: true });
        return;
      }
    }

    const bounds = await this.getDisplayBounds();
    const popupWidth = navigator.platform.includes('Win') ? POPUP_WIDTH_WINDOWS : POPUP_WIDTH_OTHER;
    const left = bounds.width - popupWidth - POPUP_RIGHT_MARGIN;

    const newWindowId = await new Promise((resolve) => {
      chrome.windows.create({
        type: 'popup',
        url: '/app.html?tabId=' + tabId,
        focused: true,
        height: POPUP_HEIGHT,
        width: popupWidth,
        left,
        top: POPUP_TOP,
      }, (win) => resolve(win.id));
    });

    await this.storePopupId(tabId, newWindowId);
  }

  getStoredPopupId(tabId) {
    return new Promise((resolve) => {
      chrome.storage.local.get([`popup_${tabId}`], (result) => {
        resolve(result[`popup_${tabId}`]);
      });
    });
  }

  storePopupId(tabId, windowId) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [`popup_${tabId}`]: windowId }, resolve);
    });
  }

  getWindow(windowId) {
    return new Promise((resolve) => {
      chrome.windows.get(windowId, (win) => {
        resolve(chrome.runtime.lastError ? null : win);
      });
    });
  }
};
