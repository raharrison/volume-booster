(() => {
  new class {
    constructor() {
      this.gainValueInput = document.querySelector('#volume-slider');
      this.volumeCurrent = document.querySelector('#volume-current');
      this.tabsTitle = document.querySelector('.tabs__title');
      this.tabsList = document.querySelector('.tabs__list');
      this.currentTabId = null;
      this.handleDocumentKeyPress = this.handleDocumentKeyPress.bind(this);

      chrome.tabs.onRemoved.addListener((tabId) => {
        this.getStoredPopupId(tabId).then((windowId) => {
          if (windowId) chrome.windows.remove(windowId);
        });
        this.showPlayingTabs();
      });

      chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if ('audible' in changeInfo) this.showPlayingTabs();
      });

      this.run();
    }

    initSwitcher() {
      const checkbox = document.getElementById('insite-controller');
      checkbox.style.display = 'none';
      const switcher = document.createElement('div');
      switcher.className = 'ui-switcher';
      switcher.setAttribute('aria-checked', checkbox.checked);
      checkbox.parentNode.insertBefore(switcher, checkbox.nextSibling);
      switcher.addEventListener('click', () => {
        checkbox.checked = !checkbox.checked;
        switcher.setAttribute('aria-checked', checkbox.checked);
        checkbox.dispatchEvent(new Event('click'));
      });
    }

    run() {
      this.initSwitcher();
      return this.getCurrentTabId()
        .then(() => this.initAudioContext())
        .then(() => this.getSavedVolume())
        .then((volume) => {
          this.setVolumeValue(volume);
          this.gainNode.gain.value = volume / 100;
        })
        .then(() => this.initListeners())
        .then(() => this.showPlayingTabs());
    }

    getSavedVolume() {
      return new Promise((resolve) => {
        chrome.storage.local.get([`volume_${this.currentTabId}`], (result) => {
          resolve(result[`volume_${this.currentTabId}`] ?? 100);
        });
      });
    }

    saveVolume(volume) {
      chrome.storage.local.set({ [`volume_${this.currentTabId}`]: volume });
    }

    getStoredPopupId(tabId) {
      return new Promise((resolve) => {
        chrome.storage.local.get([`popup_${tabId}`], (result) => {
          resolve(result[`popup_${tabId}`]);
        });
      });
    }

    getCurrentTabId() {
      const tabId = parseInt(new URLSearchParams(window.location.search).get('tabId'), 10);
      this.currentTabId = tabId;
      return Promise.resolve(tabId);
    }

    async initAudioContext() {
      const popupTab = await chrome.tabs.getCurrent();
      return new Promise((resolve) => {
        chrome.tabCapture.getMediaStreamId(
          { consumerTabId: popupTab?.id, targetTabId: this.currentTabId },
          (streamId) => {
            this.getMediaStream(streamId).then((stream) => {
              const ctx = new AudioContext();
              const source = ctx.createMediaStreamSource(stream);
              this.gainNode = ctx.createGain();
              source.connect(this.gainNode);
              this.gainNode.connect(ctx.destination);
              resolve();
            });
          }
        );
      });
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

        this.tabsList.innerHTML = '';
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

    initListeners() {
      this.gainValueInput.addEventListener('input', (e) => this.handleGainChange(e));
      document.getElementById('insite-controller').addEventListener('click', () => this.handleGainChangeButton());
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
        this.saveVolume(volume);
        return;
      }

      if (key === 'r') window.location.reload();
    }

    handleGainChange(e) {
      const volume = parseInt(e.target.value);
      this.volumeCurrent.textContent = volume;
      this.gainNode.gain.value = volume / 100;
      this.updateBadge(this.currentTabId, volume);
      this.saveVolume(volume);
    }

    handleGainChangeButton() {
      const slider = this.gainValueInput;
      slider.disabled = !slider.disabled;
      this.setVolumeValue(100);
      this.gainNode.gain.value = 1;
      this.updateBadge(this.currentTabId, 100);
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
        if (!updatedTab) return;
        chrome.windows.update(updatedTab.windowId, { focused: true });
      });
    }
  };
})();
