// Palette loading, editing, and inventory-constrained color matching.

const Palette = (() => {
  let colors = []; // { id, legoName, regularName, hex, count }

  async function load() {
    const res = await fetch('./data/palette.json');
    const json = await res.json();
    colors = json.colors.map((c) => ({ ...c }));
    return colors;
  }

  function getColors() {
    return colors;
  }

  function setColors(newColors) {
    colors = newColors;
  }

  function totalSupply() {
    return colors.reduce((sum, c) => sum + Math.max(0, c.count | 0), 0);
  }

  // Greedy confidence-ordered assignment respecting inventory counts.
  // pixels: Uint8ClampedArray-like flat RGBA buffer, length = w*h*4
  // Returns { assignment: Int32Array(w*h) of palette index or -1, usedCounts }
  function matchPixels(pixels, w, h) {
    const n = w * h;
    const candidates = colors
      .map((c, idx) => ({ idx, lab: ColorSpace.rgbToLab(...ColorSpace.hexToRgb(c.hex)), stock: Math.max(0, c.count | 0) }))
      .filter((c) => c.stock > 0);

    const assignment = new Int32Array(n).fill(-1);

    if (candidates.length === 0) {
      return { assignment, usedCounts: {} };
    }

    // Very dark source pixels (e.g. a flattened transparent background, or
    // dark image content) may only ever be matched to these two darkest
    // palette colors — never any other color, even if both run out of stock.
    const DARK_IDS = new Set(['black', 'dark_blue']);
    const darkCandidates = candidates.filter((c) => DARK_IDS.has(colors[c.idx].id));
    const PIXEL_DARK_L_THRESHOLD = 35;

    // Precompute pixel Lab + which candidate pool applies + best/second-best
    // distances within that pool, for confidence ordering.
    const pixelLabs = new Array(n);
    const pixelPools = new Array(n);
    const order = [];
    for (let i = 0; i < n; i++) {
      const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2];
      const lab = ColorSpace.rgbToLab(r, g, b);
      pixelLabs[i] = lab;

      const isDarkPixel = lab[0] < PIXEL_DARK_L_THRESHOLD && darkCandidates.length > 0;
      const pool = isDarkPixel ? darkCandidates : candidates;
      pixelPools[i] = pool;

      let best = Infinity, second = Infinity;
      for (const c of pool) {
        const d = ColorSpace.labDistance(lab, c.lab);
        if (d < best) {
          second = best;
          best = d;
        } else if (d < second) {
          second = d;
        }
      }
      const confidence = second - best; // larger = more confident (clear-cut)
      order.push({ i, confidence });
    }

    order.sort((a, b) => b.confidence - a.confidence);

    // Working stock copy, keyed by candidate idx.
    const stock = new Map(candidates.map((c) => [c.idx, c.stock]));

    for (const { i } of order) {
      const lab = pixelLabs[i];
      const pool = pixelPools[i];

      let bestIdx = -1, bestDist = Infinity;
      for (const c of pool) {
        const remaining = stock.get(c.idx);
        if (remaining <= 0) continue;
        const d = ColorSpace.labDistance(lab, c.lab);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = c.idx;
        }
      }
      // Dark pixels never fall back to any other color once black/dark-blue
      // stock runs out; the most confidently-dark pixels are processed first
      // (via the confidence ordering above) so any that go unfilled are the
      // least clear-cut ones, and the tile's black background shows through.
      if (bestIdx !== -1) {
        assignment[i] = bestIdx;
        stock.set(bestIdx, stock.get(bestIdx) - 1);
      }
    }

    const usedCounts = {};
    for (const c of candidates) {
      usedCounts[c.idx] = c.stock - stock.get(c.idx);
    }

    return { assignment, usedCounts };
  }

  return { load, getColors, setColors, totalSupply, matchPixels };
})();

window.Palette = Palette;
