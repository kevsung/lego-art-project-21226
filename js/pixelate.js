// Downsample a square canvas to a GRID_SIZE x GRID_SIZE canvas.

const Pixelate = (() => {
  const GRID_SIZE = 48;

  function toGrid(sourceCanvas) {
    const grid = document.createElement('canvas');
    grid.width = GRID_SIZE;
    grid.height = GRID_SIZE;
    const ctx = grid.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, GRID_SIZE, GRID_SIZE);
    return grid;
  }

  function getPixelData(gridCanvas) {
    const ctx = gridCanvas.getContext('2d');
    return ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
  }

  return { GRID_SIZE, toGrid, getPixelData };
})();

window.Pixelate = Pixelate;
