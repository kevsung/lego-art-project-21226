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

    // Precompute pixel Lab + best/second-best distances for confidence ordering.
    const pixelLabs = new Array(n);
    const order = [];
    for (let i = 0; i < n; i++) {
      const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2];
      const lab = ColorSpace.rgbToLab(r, g, b);
      pixelLabs[i] = lab;

      let best = Infinity, second = Infinity;
      for (const c of candidates) {
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
      let bestIdx = -1, bestDist = Infinity;
      for (const c of candidates) {
        const remaining = stock.get(c.idx);
        if (remaining <= 0) continue;
        const d = ColorSpace.labDistance(lab, c.lab);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = c.idx;
        }
      }
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
