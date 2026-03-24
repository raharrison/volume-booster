(() => {
  new class {
    constructor() {
      this.maxVolume = 600;
      this.vizualizeContent = null;
      this.updateVolume = this.updateVolume.bind(this);
      this.run();
    }

    run() {
      this.initListeners();
      this.createHtml();
    }

    initListeners() {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'showGain') {
          this.updateVolume(message.volume);
        }
      });
    }

    createHtml() {
      if (this.vizualizeContent) return;

      const el = document.createElement('div');
      el.id = 'volume-booster-visusalizer';
      el.innerHTML = [
        '<div class="sound">',
        '  <div class="sound-icon"></div>',
        '  <div class="sound-wave sound-wave_one"></div>',
        '  <div class="sound-wave sound-wave_two"></div>',
        '  <div class="sound-wave sound-wave_three"></div>',
        '</div>',
        '<div class="segments-box">',
        '  <div data-range="1-20" class="segment"><span></span></div>',
        '  <div data-range="21-40" class="segment"><span></span></div>',
        '  <div data-range="41-60" class="segment"><span></span></div>',
        '  <div data-range="61-80" class="segment"><span></span></div>',
        '  <div data-range="81-100" class="segment"><span></span></div>',
        '</div>',
      ].join('\n');
      document.body.appendChild(el);
      this.vizualizeContent = el;
    }

    updateVolume(value) {
      const volume = +value;
      if (!Number.isInteger(volume)) return;

      const percent = Math.round((volume / this.maxVolume) * 100);

      this.vizualizeContent.style.display = 'flex';
      this.vizualizeContent.style.opacity = '1';

      clearInterval(this._fadeInterval);
      clearTimeout(this._fadeTimeout);

      this.updateSegments(percent);
      this.vizualizeContent.querySelector('.sound').classList.toggle('sound-mute', percent < 1);
      this.hideVisualizer();
    }

    updateSegments(percent) {
      this.vizualizeContent.querySelectorAll('.segment').forEach((segment) => {
        const [min, max] = segment.dataset.range.split('-').map(Number);
        const span = segment.querySelector('span');

        if (percent > max) {
          span.style.height = '100%';
        } else if (percent >= min && percent <= max) {
          span.style.height = (100 - (100 * (max - percent) / 20)) + '%';
        } else {
          span.style.height = '0';
        }
      });
    }

    hideVisualizer() {
      this._fadeTimeout = setTimeout(() => {
        this._fadeInterval = setInterval(() => {
          const opacity = parseFloat(this.vizualizeContent.style.opacity);
          if (opacity > 0) {
            this.vizualizeContent.style.opacity = String(Math.round((opacity - 0.01) * 100) / 100);
          } else {
            this.vizualizeContent.style.display = 'none';
            clearInterval(this._fadeInterval);
          }
        }, 10);
      }, 800);
    }
  };
})();
