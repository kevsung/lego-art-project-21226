// Downsample a square canvas to a GRID_SIZE x GRID_SIZE canvas using manual
// per-channel block reduction (no canvas smoothing).

const Pixelate = (() => {
  const GRID_SIZE = 48;
  const METHODS = ['average', 'dualMinMax', 'min', 'max'];

  function reduceBlock(values, method) {
    switch (method) {
      case 'min': {
        let m = 255;
        for (const v of values) if (v < m) m = v;
        return m;
      }
      case 'max': {
        let m = 0;
        for (const v of values) if (v > m) m = v;
        return m;
      }
      case 'dualMinMax': {
        let mn = 255, mx = 0;
        for (const v of values) {
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
        return Math.round((mn + mx) / 2);
      }
      case 'average':
      default: {
        let sum = 0;
        for (const v of values) sum += v;
        return Math.round(sum / values.length);
      }
    }
  }

  function toGridImageData(sourceCanvas, method = 'average') {
    const srcCtx = sourceCanvas.getContext('2d');
    const size = sourceCanvas.width;
    const srcData = srcCtx.getImageData(0, 0, size, size).data;

    const out = new ImageData(GRID_SIZE, GRID_SIZE);
    const outData = out.data;

    const blockSize = size / GRID_SIZE;

    for (let gy = 0; gy < GRID_SIZE; gy++) {
      const y0 = Math.floor(gy * blockSize);
      const y1 = Math.max(y0 + 1, Math.floor((gy + 1) * blockSize));
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const x0 = Math.floor(gx * blockSize);
        const x1 = Math.max(x0 + 1, Math.floor((gx + 1) * blockSize));

        const rVals = [];
        const gVals = [];
        const bVals = [];
        const aVals = [];

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const idx = (y * size + x) * 4;
            rVals.push(srcData[idx]);
            gVals.push(srcData[idx + 1]);
            bVals.push(srcData[idx + 2]);
            aVals.push(srcData[idx + 3]);
          }
        }

        const outIdx = (gy * GRID_SIZE + gx) * 4;
        outData[outIdx] = reduceBlock(rVals, method);
        outData[outIdx + 1] = reduceBlock(gVals, method);
        outData[outIdx + 2] = reduceBlock(bVals, method);
        outData[outIdx + 3] = reduceBlock(aVals, 'average');
      }
    }

    return out;
  }

  function toGrid(sourceCanvas, method = 'average') {
    const imgData = toGridImageData(sourceCanvas, method);
    const grid = document.createElement('canvas');
    grid.width = GRID_SIZE;
    grid.height = GRID_SIZE;
    grid.getContext('2d').putImageData(imgData, 0, 0);
    return grid;
  }

  function getPixelData(gridCanvas) {
    const ctx = gridCanvas.getContext('2d');
    return ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
  }

  return { GRID_SIZE, METHODS, toGrid, toGridImageData, getPixelData };
})();

window.Pixelate = Pixelate;
