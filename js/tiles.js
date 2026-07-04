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

  // The color-key number is simply each color's 1-indexed position in the
  // palette array, matching the physical color-key card from the kit's
  // setup instructions. The array order must never be sorted/reordered.
  function buildColorCodes(colors) {
    const codes = {};
    colors.forEach((c, idx) => {
      codes[idx] = String(idx + 1);
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
