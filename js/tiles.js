// Split the 48x48 result into nine 16x16 tiles and generate build instructions.

const Tiles = (() => {
  const GRID = 48;
  const TILE = 16;
  const TILE_LABELS = [
    'Top-Left', 'Top-Center', 'Top-Right',
    'Middle-Left', 'Center', 'Middle-Right',
    'Bottom-Left', 'Bottom-Center', 'Bottom-Right',
  ];

  // assignment: Int32Array(48*48) of palette color index (-1 = unfilled)
  function splitIntoTiles(assignment) {
    const tiles = [];
    for (let t = 0; t < 9; t++) {
      const tileRow = Math.floor(t / 3);
      const tileCol = t % 3;
      const cells = new Int32Array(TILE * TILE);
      for (let r = 0; r < TILE; r++) {
        for (let c = 0; c < TILE; c++) {
          const gridRow = tileRow * TILE + r;
          const gridCol = tileCol * TILE + c;
          cells[r * TILE + c] = assignment[gridRow * GRID + gridCol];
        }
      }
      tiles.push({
        index: t + 1,
        label: TILE_LABELS[t],
        row: tileRow,
        col: tileCol,
        cells,
      });
    }
    return tiles;
  }

  // Build a short code per color id, e.g. first letters, deduped with numeric suffix if needed.
  function buildColorCodes(colors) {
    const used = new Set();
    const codes = {};
    colors.forEach((c, idx) => {
      let base = c.legoName
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 3);
      if (!base) base = 'C' + idx;
      let code = base;
      let n = 1;
      while (used.has(code)) {
        code = base + n;
        n++;
      }
      used.add(code);
      codes[idx] = code;
    });
    return codes;
  }

  function tileColorCounts(tile) {
    const counts = new Map();
    for (const idx of tile.cells) {
      if (idx === -1) continue;
      counts.set(idx, (counts.get(idx) || 0) + 1);
    }
    return counts;
  }

  return { GRID, TILE, TILE_LABELS, splitIntoTiles, buildColorCodes, tileColorCounts };
})();

window.Tiles = Tiles;
