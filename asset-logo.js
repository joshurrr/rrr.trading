'use strict';
// Shared card/modal identity assets and their existing text fallback.
window.AssetLogo = Object.freeze({
  create(symbol, imageClass, fallbackClass, size = 100) {
    const fallback = document.createElement('span'); fallback.className = fallbackClass;
    fallback.textContent = symbol.length > 6 ? symbol.slice(0, 4) + '…' : symbol;
    const image = document.createElement('img'); image.className = imageClass;
    image.alt = ''; image.width = image.height = size; image.loading = 'lazy'; image.decoding = 'async';
    image.src = `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;
    image.addEventListener('load', () => { fallback.hidden = true; });
    image.addEventListener('error', () => { image.hidden = true; fallback.hidden = false; });
    return { image, fallback };
  }
});
