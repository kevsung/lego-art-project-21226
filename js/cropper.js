// Square-crop UI: draggable/resizable square overlay over a displayed image.

const Cropper = (() => {
  let container, imgEl, box;
  let imgNatural = { w: 0, h: 0 };
  let displayScale = 1;
  let state = { x: 0, y: 0, size: 0 };
  let drag = null;

  function init(containerEl) {
    container = containerEl;
  }

  function setImage(bitmapOrImg, naturalW, naturalH) {
    container.innerHTML = '';
    imgNatural = { w: naturalW, h: naturalH };

    const canvas = document.createElement('canvas');
    canvas.width = naturalW;
    canvas.height = naturalH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmapOrImg, 0, 0, naturalW, naturalH);

    const wrap = document.createElement('div');
    wrap.className = 'crop-wrap';
    imgEl = canvas;
    imgEl.className = 'crop-image';
    wrap.appendChild(imgEl);

    box = document.createElement('div');
    box.className = 'crop-box';
    wrap.appendChild(box);

    container.appendChild(wrap);

    // Fit display to container width, capped.
    requestAnimationFrame(() => {
      const maxW = Math.min(container.clientWidth || 600, 600);
      displayScale = Math.min(1, maxW / naturalW);
      const dispW = naturalW * displayScale;
      const dispH = naturalH * displayScale;
      imgEl.style.width = dispW + 'px';
      imgEl.style.height = dispH + 'px';
      wrap.style.width = dispW + 'px';
      wrap.style.height = dispH + 'px';

      const size = Math.min(dispW, dispH);
      state = {
        x: (dispW - size) / 2,
        y: (dispH - size) / 2,
        size,
      };
      renderBox();
      attachHandlers(wrap, dispW, dispH);
    });
  }

  function renderBox() {
    box.style.left = state.x + 'px';
    box.style.top = state.y + 'px';
    box.style.width = state.size + 'px';
    box.style.height = state.size + 'px';
  }

  function attachHandlers(wrap, dispW, dispH) {
    const clamp = () => {
      state.size = Math.min(state.size, dispW, dispH);
      state.x = Math.max(0, Math.min(state.x, dispW - state.size));
      state.y = Math.max(0, Math.min(state.y, dispH - state.size));
    };

    const pointerDown = (e, mode) => {
      e.preventDefault();
      const start = getPoint(e);
      drag = { mode, startX: start.x, startY: start.y, orig: { ...state } };
    };

    const pointerMove = (e) => {
      if (!drag) return;
      const p = getPoint(e);
      const dx = p.x - drag.startX;
      const dy = p.y - drag.startY;
      if (drag.mode === 'move') {
        state.x = drag.orig.x + dx;
        state.y = drag.orig.y + dy;
      } else if (drag.mode === 'resize') {
        const delta = Math.max(dx, dy);
        state.size = Math.max(20, drag.orig.size + delta);
        state.x = drag.orig.x;
        state.y = drag.orig.y;
      }
      clamp();
      renderBox();
    };

    const pointerUp = () => {
      drag = null;
    };

    const getPoint = (e) => {
      const rect = wrap.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    };

    box.addEventListener('mousedown', (e) => pointerDown(e, 'move'));
    box.addEventListener('touchstart', (e) => pointerDown(e, 'move'), { passive: false });

    const handle = document.createElement('div');
    handle.className = 'crop-handle';
    box.appendChild(handle);
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      pointerDown(e, 'resize');
    });
    handle.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      pointerDown(e, 'resize');
    }, { passive: false });

    window.addEventListener('mousemove', pointerMove);
    window.addEventListener('touchmove', pointerMove, { passive: false });
    window.addEventListener('mouseup', pointerUp);
    window.addEventListener('touchend', pointerUp);
  }

  // Returns a canvas containing the cropped square, at native resolution.
  function getCroppedCanvas() {
    const sx = state.x / displayScale;
    const sy = state.y / displayScale;
    const ssize = state.size / displayScale;

    const out = document.createElement('canvas');
    const outSize = Math.round(ssize);
    out.width = outSize;
    out.height = outSize;
    const ctx = out.getContext('2d');
    ctx.drawImage(imgEl, sx, sy, ssize, ssize, 0, 0, outSize, outSize);
    return out;
  }

  return { init, setImage, getCroppedCanvas };
})();

window.Cropper = Cropper;
