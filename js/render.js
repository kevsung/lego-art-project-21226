// Canvas drawing helpers: full preview, tile instruction sheets, assembly diagram, PNG export.

const Render = (() => {
  // Renders the 48x48 assignment as a crisp upscaled canvas.
  function renderFullPreview(assignment, gridSize, colors, pipSize = 14) {
    const canvas = document.createElement('canvas');
    canvas.width = gridSize * pipSize;
    canvas.height = gridSize * pipSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const idx = assignment[r * gridSize + c];
        ctx.fillStyle = idx === -1 ? '#cccccc' : colors[idx].hex;
        ctx.fillRect(c * pipSize, r * pipSize, pipSize, pipSize);
      }
    }
    return canvas;
  }

  // Renders one tile's 16x16 instruction grid with color codes on each cell.
  function renderTileGrid(tile, colors, codes, cellSize = 28) {
    const size = Tiles.TILE;
    const canvas = document.createElement('canvas');
    canvas.width = size * cellSize;
    canvas.height = size * cellSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.font = `${Math.floor(cellSize * 0.32)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const idx = tile.cells[r * size + c];
        const x = c * cellSize, y = r * cellSize;
        if (idx === -1) {
          ctx.fillStyle = '#eeeeee';
          ctx.fillRect(x, y, cellSize, cellSize);
        } else {
          const color = colors[idx];
          ctx.fillStyle = color.hex;
          ctx.fillRect(x, y, cellSize, cellSize);
          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
          ctx.fillStyle = isLight(color.hex) ? '#000000' : '#ffffff';
          ctx.fillText(codes[idx], x + cellSize / 2, y + cellSize / 2 + 1);
        }
      }
    }
    // Outer border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    return canvas;
  }

  function isLight(hex) {
    const [r, g, b] = ColorSpace.hexToRgb(hex);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6;
  }

  // Draws the 3x3 assembly diagram showing tile numbers in position.
  function renderAssemblyDiagram(cellSize = 60) {
    const canvas = document.createElement('canvas');
    canvas.width = cellSize * 3;
    canvas.height = cellSize * 3;
    const ctx = canvas.getContext('2d');
    ctx.font = `${Math.floor(cellSize * 0.3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const t = r * 3 + c + 1;
        const x = c * cellSize, y = r * cellSize;
        ctx.fillStyle = '#f7f7f7';
        ctx.fillRect(x, y, cellSize, cellSize);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        ctx.fillStyle = '#222';
        ctx.fillText(`Tile ${t}`, x + cellSize / 2, y + cellSize / 2 - 8);
        ctx.font = `${Math.floor(cellSize * 0.22)}px sans-serif`;
        ctx.fillText(Tiles.TILE_LABELS[t - 1], x + cellSize / 2, y + cellSize / 2 + 14);
        ctx.font = `${Math.floor(cellSize * 0.3)}px sans-serif`;
      }
    }
    return canvas;
  }

  function downloadCanvas(canvas, filename) {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  return { renderFullPreview, renderTileGrid, renderAssemblyDiagram, downloadCanvas, isLight };
})();

window.Render = Render;
