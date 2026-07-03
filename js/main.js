// App orchestration and event wiring.

(async function () {
  const MAX_LONG_EDGE = 1600;

  const state = {
    lastAssignment: null,
    lastColors: null,
    lastTiles: null,
    lastCodes: null,
  };

  const panels = document.querySelectorAll('.step-panel');
  const stepItems = document.querySelectorAll('.steps li');

  function goToStep(n) {
    panels.forEach((p) => p.classList.toggle('active', p.id === `panel-${n}`));
    stepItems.forEach((li) => {
      const s = Number(li.dataset.step);
      li.classList.toggle('active', s === n);
      li.classList.toggle('done', s < n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Step 1: Upload ----------
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
  });

  async function handleFile(file) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      bitmap = await createImageBitmap(file);
    }

    // Flatten transparency onto white, downscale if huge.
    let w = bitmap.width, h = bitmap.height;
    const longEdge = Math.max(w, h);
    if (longEdge > MAX_LONG_EDGE) {
      const scale = MAX_LONG_EDGE / longEdge;
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);

    Cropper.setImage(canvas, w, h);
    goToStep(2);
  }

  // ---------- Step 2: Crop ----------
  Cropper.init(document.getElementById('cropContainer'));
  document.getElementById('backTo1').addEventListener('click', () => goToStep(1));
  document.getElementById('confirmCrop').addEventListener('click', () => {
    state.croppedCanvas = Cropper.getCroppedCanvas();
    renderPaletteTable();
    goToStep(3);
  });

  // ---------- Step 3: Palette ----------
  const paletteBody = document.getElementById('paletteBody');
  const supplyWarning = document.getElementById('supplyWarning');
  const GRID_TOTAL = Pixelate.GRID_SIZE * Pixelate.GRID_SIZE;

  await Palette.load();

  function renderPaletteTable() {
    const colors = Palette.getColors();
    paletteBody.innerHTML = '';
    colors.forEach((c, idx) => {
      const tr = document.createElement('tr');
      if ((c.count | 0) <= 0) tr.classList.add('out-of-stock');

      const swatchTd = document.createElement('td');
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = c.hex;
      swatchTd.appendChild(swatch);

      const legoTd = document.createElement('td');
      legoTd.textContent = c.legoName;

      const regularTd = document.createElement('td');
      regularTd.textContent = c.regularName;

      const hexTd = document.createElement('td');
      const hexInput = document.createElement('input');
      hexInput.type = 'text';
      hexInput.value = c.hex;
      hexInput.addEventListener('change', () => {
        c.hex = normalizeHex(hexInput.value) || c.hex;
        hexInput.value = c.hex;
        swatch.style.background = c.hex;
        checkSupply();
      });
      hexTd.appendChild(hexInput);

      const countTd = document.createElement('td');
      const countInput = document.createElement('input');
      countInput.type = 'number';
      countInput.min = '0';
      countInput.value = c.count;
      countInput.addEventListener('change', () => {
        c.count = Math.max(0, parseInt(countInput.value, 10) || 0);
        countInput.value = c.count;
        tr.classList.toggle('out-of-stock', c.count <= 0);
        checkSupply();
      });
      countTd.appendChild(countInput);

      tr.append(swatchTd, legoTd, regularTd, hexTd, countTd);
      paletteBody.appendChild(tr);
    });
    checkSupply();
  }

  function normalizeHex(v) {
    v = v.trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) return v.toUpperCase();
    if (/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) return ('#' + v).toUpperCase();
    return null;
  }

  function checkSupply() {
    const total = Palette.totalSupply();
    if (total < GRID_TOTAL) {
      supplyWarning.hidden = false;
      supplyWarning.textContent = `Warning: total available pieces (${total}) is less than the ${GRID_TOTAL} needed to fill the full 48x48 grid. Some cells may be left unfilled unless you increase counts.`;
    } else {
      supplyWarning.hidden = true;
    }
  }

  document.getElementById('backTo2').addEventListener('click', () => goToStep(2));
  document.getElementById('goToGenerate').addEventListener('click', () => goToStep(4));

  // ---------- Step 4: Generate ----------
  document.getElementById('backTo3').addEventListener('click', () => goToStep(3));
  document.getElementById('generateBtn').addEventListener('click', () => {
    const grid = Pixelate.toGrid(state.croppedCanvas);
    const imgData = Pixelate.getPixelData(grid);
    const { assignment } = Palette.matchPixels(imgData.data, Pixelate.GRID_SIZE, Pixelate.GRID_SIZE);

    state.lastAssignment = assignment;
    state.lastColors = Palette.getColors();

    renderPreview();
    goToStep(5);
  });

  // ---------- Step 5: Preview ----------
  const previewContainer = document.getElementById('previewContainer');

  function renderPreview() {
    previewContainer.innerHTML = '';
    const canvas = Render.renderFullPreview(state.lastAssignment, Pixelate.GRID_SIZE, state.lastColors, 14);
    previewContainer.appendChild(canvas);
    state.previewCanvas = canvas;
  }

  document.getElementById('backTo4').addEventListener('click', () => goToStep(4));
  document.getElementById('downloadPreview').addEventListener('click', () => {
    Render.downloadCanvas(state.previewCanvas, 'lego-pixel-art-preview.png');
  });
  document.getElementById('goToInstructions').addEventListener('click', () => {
    renderInstructions();
    goToStep(6);
  });

  // ---------- Step 6: Instructions ----------
  const assemblyContainer = document.getElementById('assemblyContainer');
  const tilesContainer = document.getElementById('tilesContainer');

  function renderInstructions() {
    const tiles = Tiles.splitIntoTiles(state.lastAssignment);
    const codes = Tiles.buildColorCodes(state.lastColors);
    state.lastTiles = tiles;
    state.lastCodes = codes;

    assemblyContainer.innerHTML = '';
    const assembly = Render.renderAssemblyDiagram(70);
    assemblyContainer.appendChild(assembly);
    state.assemblyCanvas = assembly;

    tilesContainer.innerHTML = '';
    state.tileCanvases = [];

    tiles.forEach((tile) => {
      const card = document.createElement('div');
      card.className = 'tile-card';

      const h4 = document.createElement('h4');
      h4.textContent = `Tile ${tile.index} of 9 — ${tile.label}`;
      card.appendChild(h4);

      const canvas = Render.renderTileGrid(tile, state.lastColors, codes, 26);
      card.appendChild(canvas);
      state.tileCanvases.push({ canvas, index: tile.index });

      const counts = Tiles.tileColorCounts(tile);
      const legend = document.createElement('table');
      legend.className = 'legend';
      legend.innerHTML = '<thead><tr><th></th><th>Code</th><th>Lego Color</th><th>Count</th></tr></thead>';
      const tbody = document.createElement('tbody');
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .forEach(([idx, count]) => {
          const color = state.lastColors[idx];
          const tr = document.createElement('tr');
          const swatchTd = document.createElement('td');
          const swatch = document.createElement('span');
          swatch.className = 'swatch';
          swatch.style.background = color.hex;
          swatchTd.appendChild(swatch);
          const codeTd = document.createElement('td');
          codeTd.textContent = codes[idx];
          const nameTd = document.createElement('td');
          nameTd.textContent = color.legoName;
          const countTd = document.createElement('td');
          countTd.textContent = count;
          tr.append(swatchTd, codeTd, nameTd, countTd);
          tbody.appendChild(tr);
        });
      legend.appendChild(tbody);
      card.appendChild(legend);

      tilesContainer.appendChild(card);
    });
  }

  document.getElementById('backTo5').addEventListener('click', () => goToStep(5));
  document.getElementById('printBtn').addEventListener('click', () => window.print());
  document.getElementById('downloadAll').addEventListener('click', () => {
    Render.downloadCanvas(state.previewCanvas, 'lego-pixel-art-preview.png');
    Render.downloadCanvas(state.assemblyCanvas, 'lego-assembly-diagram.png');
    state.tileCanvases.forEach(({ canvas, index }) => {
      Render.downloadCanvas(canvas, `lego-tile-${index}.png`);
    });
  });

  goToStep(1);
})();
