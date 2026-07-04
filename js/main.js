// App orchestration and event wiring.

(async function () {
  // ---------- Theme toggle ----------
  const themeToggle = document.getElementById('themeToggle');
  const THEME_KEY = 'lego-pixel-art-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  }

  const storedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(storedTheme || (prefersDark ? 'dark' : 'light'));

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  });

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

  // ---------- Step 1: Home ----------
  document.getElementById('startBtn').addEventListener('click', () => goToStep(2));

  // ---------- Step 2: Upload ----------
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

    // Downscale if huge; keep transparency intact (no background flatten) so
    // transparent regions can be left as unfilled pips later, rather than
    // matched to any color.
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
    ctx.drawImage(bitmap, 0, 0, w, h);

    Cropper.setImage(canvas, w, h);
    goToStep(3);
  }

  // ---------- Step 3: Crop ----------
  Cropper.init(document.getElementById('cropContainer'));
  document.getElementById('backTo2').addEventListener('click', () => goToStep(2));
  document.getElementById('confirmCrop').addEventListener('click', () => {
    state.croppedCanvas = Cropper.getCroppedCanvas();
    pixelateAndMatch();
    renderPreview();
    goToStep(4);
  });

  // ---------- Palette (fixed, read-only, loaded from data/palette.json) ----------
  const supplyWarning = document.getElementById('supplyWarning');
  const GRID_TOTAL = Pixelate.GRID_SIZE * Pixelate.GRID_SIZE;

  await Palette.load();

  function checkSupply() {
    const total = Palette.totalSupply();
    if (total < GRID_TOTAL) {
      supplyWarning.hidden = false;
      supplyWarning.textContent = `Warning: total available pieces (${total}) is less than the ${GRID_TOTAL} needed to fill the full 48x48 grid. Some cells may be left unfilled.`;
    } else {
      supplyWarning.hidden = true;
    }
  }
  checkSupply();

  // ---------- Step 4: Generate Preview ----------
  const poolingMethodSelect = document.getElementById('poolingMethod');
  const colorDistanceSelect = document.getElementById('colorDistance');
  const previewContainer = document.getElementById('previewContainer');

  document.getElementById('backTo3').addEventListener('click', () => goToStep(3));

  const transparencyNoteText = 'This image has a transparent background: any circle without a number code in the diagrams below means leave that space empty.';
  const previewTransparencyNote = document.getElementById('previewTransparencyNote');
  const instructionsTransparencyNote = document.getElementById('instructionsTransparencyNote');
  previewTransparencyNote.textContent = transparencyNoteText;
  instructionsTransparencyNote.textContent = transparencyNoteText;

  function pixelateAndMatch() {
    if (!state.croppedCanvas) return;
    const poolingMethod = poolingMethodSelect.value;
    const distanceMethod = colorDistanceSelect.value;
    const imgData = Pixelate.toGridImageData(state.croppedCanvas, poolingMethod);
    const { assignment, hasTransparency } = Palette.matchPixels(imgData.data, Pixelate.GRID_SIZE, Pixelate.GRID_SIZE, distanceMethod);

    state.lastAssignment = assignment;
    state.lastColors = Palette.getColors();
    state.hasTransparency = hasTransparency;
    previewTransparencyNote.hidden = !hasTransparency;
    instructionsTransparencyNote.hidden = !hasTransparency;
  }

  function renderPreview() {
    previewContainer.innerHTML = '';
    const canvas = Render.renderFullPreview(state.lastAssignment, Pixelate.GRID_SIZE, state.lastColors, 14);
    previewContainer.appendChild(canvas);
    state.previewCanvas = canvas;
  }

  function regenerate() {
    pixelateAndMatch();
    renderPreview();
  }

  poolingMethodSelect.addEventListener('change', regenerate);
  colorDistanceSelect.addEventListener('change', regenerate);

  document.getElementById('downloadPreview').addEventListener('click', () => {
    Render.downloadCanvas(state.previewCanvas, 'lego-pixel-art-preview.png');
  });
  document.getElementById('goToInstructions').addEventListener('click', () => {
    renderInstructions();
    goToStep(5);
  });

  // ---------- Step 5: Instructions ----------
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

      tilesContainer.appendChild(card);
    });
  }

  document.getElementById('backTo4').addEventListener('click', () => goToStep(4));
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
