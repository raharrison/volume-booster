(() => {
  new class {
    constructor() {
      this.gainValueInput = document.querySelector('#volume-slider');
      this.volumeCurrent = document.querySelector('#volume-current');
      this.tabsTitle = document.querySelector('.tabs__title');
      this.tabsList = document.querySelector('.tabs__list');
      this.currentTabId = null;
      this.storage = null;
      this.handleDocumentKeyPress = this.handleDocumentKeyPress.bind(this);

      chrome.tabs.onRemoved.addListener((tabId) => {
        this.getStoredPopupId(tabId)
          .then((windowId) => this.getWindowId(windowId))
          .then((windowId) => chrome.windows.remove(windowId));
      });

      this.run();
    }

    run() {
      return this.getCurrentTabId()
        .then(() => this.initAudioContext())
        .then(() => this.setVolumeValue(100))
        .then(() => this.initListeners())
        .then(() => this.showPlayingTabs())
        .then(() => this.initStorage());
    }

    getStoredPopupId(tabId) {
      return new Promise((resolve) => {
        chrome.storage.local.get([`popup_${tabId}`], (result) => {
          resolve(result[`popup_${tabId}`]);
        });
      });
    }

    getWindowId(windowId) {
      return new Promise((resolve) => {
        chrome.windows.get(windowId, (win) => resolve(win.id));
      });
    }

    getCurrentTabId() {
      return new Promise((resolve) => {
        chrome.tabs.query({ active: true }, (tabs) => {
          if (chrome.runtime.lastError) return;
          this.currentTabId = tabs[0].id;
          this.currentTab = tabs[0];
          resolve(this.currentTabId);
        });
      });
    }

    async initAudioContext() {
      const popupTab = await chrome.tabs.getCurrent();
      chrome.tabCapture.getMediaStreamId(
        { consumerTabId: popupTab?.id, targetTabId: this.currentTabId },
        (streamId) => {
          this.getMediaStream(streamId).then((stream) => {
            const ctx = new AudioContext();
            const source = ctx.createMediaStreamSource(stream);
            this.gainNode = ctx.createGain();
            source.connect(this.gainNode);
            this.gainNode.connect(ctx.destination);
          });
        }
      );
    }

    getMediaStream(streamId) {
      return navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId,
          },
        },
      });
    }

    setVolumeValue(value) {
      this.gainValueInput.value = value;
      this.volumeCurrent.textContent = value;
    }

    showPlayingTabs() {
      chrome.tabs.query({ audible: true, currentWindow: false, windowType: 'normal' }, (tabs) => {
        tabs.sort((a, b) => b.id - a.id);
        this.tabsTitle.textContent = tabs.length
          ? 'Tabs playing audio right now'
          : 'No tabs playing audio right now';

        const template = document.querySelector('#template-tab');
        tabs.forEach((tab) => {
          if (!tab.favIconUrl || !tab.title) return;
          const node = template.content.cloneNode(true);
          node.querySelector('.tab').dataset.tabId = tab.id;
          node.querySelector('.tab__icon-image').src = tab.favIconUrl;
          node.querySelector('.tab__title').textContent = tab.title;
          this.tabsList.appendChild(node);
        });
      });
    }

    initStorage() {
      return new Promise((resolve) => {
        chrome.storage.local.get({ usedIds: [], installationDate: null }, (data) => {
          if (data.installationDate) {
            this.storage = data;
            this.storage.installationDate = JSON.parse(data.installationDate);
          } else {
            data.installationDate = new Date();
            this.storage = data;
            this.saveToStorage({ installationDate: JSON.stringify(data.installationDate) });
          }
          resolve();
        });
      });
    }

    initListeners() {
      this.gainValueInput.addEventListener('input', (e) => this.handleGainChange(e));
      document.getElementById('insite-controller').addEventListener('click', (e) => this.handleGainChangeButton(e));
      this.tabsList.addEventListener('click', (e) => this.handleTabListClick(e));
      document.documentElement.addEventListener('keypress', this.handleDocumentKeyPress);
    }

    handleDocumentKeyPress(e) {
      e.preventDefault();
      const key = e.key.toLowerCase();
      const num = +key;

      if (!isNaN(num)) {
        const volume = num * 100;
        const min = +this.gainValueInput.min;
        const max = +this.gainValueInput.max;
        if (volume < min || volume > max) return;

        this.gainValueInput.value = volume;
        this.volumeCurrent.textContent = volume;
        this.gainNode.gain.value = volume / 100;
        this.updateBadge(this.currentTabId, volume);
        chrome.tabs.sendMessage(this.currentTabId, { action: 'showGain', volume });
        return;
      }

      if (key === 'r') window.location.reload();
    }

    handleGainChange(e) {
      const volume = parseInt(e.target.value);
      this.volumeCurrent.textContent = volume;
      this.gainNode.gain.value = volume / 100;
      this.updateBadge(this.currentTabId, volume);
      chrome.tabs.sendMessage(this.currentTabId, { action: 'showGain', volume });
    }

    handleGainChangeButton(e) {
      const slider = this.gainValueInput;
      slider.disabled = !slider.disabled;
      this.setVolumeValue(100);
      this.gainNode.gain.value = 1;
      this.updateBadge(this.currentTabId, 100);
      chrome.tabs.sendMessage(this.currentTabId, { action: 'showGain', volume: 100 });
    }

    updateBadge(tabId, volume) {
      chrome.action.setBadgeText({ text: String(volume), tabId });
    }

    handleTabListClick(e) {
      e.preventDefault();
      const tab = e.target.closest('.tab');
      if (!tab) return;
      const tabId = parseInt(tab.dataset.tabId, 10);
      chrome.tabs.update(tabId, { active: true }, (updatedTab) => {
        chrome.windows.update(updatedTab.windowId, { focused: true });
      });
    }

    saveToStorage(data, callback = () => {}) {
      chrome.storage.local.set(data, callback);
    }
  };
})();
