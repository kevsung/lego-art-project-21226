# Lego Pixel Art Generator — Build Spec

Hand this whole document to Claude Code as the task brief. It describes a static,
client-side web app (no backend) suitable for GitHub Pages.

## 1. Goal

A browser-based tool that:
1. Takes any user-uploaded image.
2. Lets the user crop it to a square.
3. Downsamples it to a **48×48 pixel grid** (this becomes nine 16×16 "build tiles"
   arranged 3×3).
4. Recolors each of the 2,304 pixels to the *closest available Lego color*,
   while respecting a **finite inventory** of pieces per color (a color can't be
   used more times than the user has pieces).
5. Renders the final 48×48 result as a single square pixelated preview image.
6. Splits that image into 9 tiles (16×16 each, reading order 1–9, left-to-right
   top-to-bottom) and generates **build instructions per tile**: a coordinate
   grid showing which color goes in each of the 256 cells, plus a legend.
7. Generates an **assembly diagram** showing how the 9 tiles fit into the 3×3
   final layout.

## 2. Tech stack

- Plain **HTML/CSS/JavaScript**, no framework, no bundler, no npm build step.
  This keeps deployment to GitHub Pages a matter of "push to `main`, enable
  Pages in repo settings, point it at `/` or `/docs`."
- Use the **Canvas API** for all image manipulation (crop, downsample,
  recolor, tiling, upscaled preview rendering).
- No external services, no API keys, nothing paid. Everything runs in the
  browser.
- Optional dev-only tooling (a local static server for testing) is fine but
  not required for the shipped product.

## 3. Repo structure

```
/
├── index.html
├── styles.css
├── /js
│   ├── main.js            # app orchestration / event wiring
│   ├── cropper.js          # square-crop UI logic
│   ├── palette.js          # color-matching + inventory logic
│   ├── pixelate.js         # downsample to 48x48
│   ├── tiles.js             # split into 9 tiles + instruction generation
│   ├── colorSpace.js       # RGB <-> Lab conversion helpers
│   └── render.js           # canvas drawing helpers, exports
├── /data
│   └── palette.json         # fixed color/count inventory, read-only at runtime (see below)
└── README.md
```

## 4. Palette data format

Load available colors from `data/palette.json` at startup. I've generated a
starter file for you from the user's existing inventory — see the attached
`palette.json`. Format:

```json
{
  "colors": [
    { "id": "black", "legoName": "Black", "regularName": "Black", "hex": "#151515", "count": 254 },
    { "id": "dark_blue", "legoName": "Dark Blue", "regularName": "Earth Blue", "hex": "#19325A", "count": 660 }
  ]
}
```

(Full 16-color file is the attached `palette.json` — this snippet just shows
the shape.)

**This palette is fixed, not user-editable in the app.** The colors and
counts represent exactly what's physically included in the user's base Lego
kit — there's no scenario where the app should let someone add colors,
increase counts, or otherwise deviate from `palette.json`. All color-matching
is constrained to exactly these 16 colors and these exact quantities, no
exceptions. If the palette ever needs to change, it's edited directly in the
JSON file, not through the UI.

**The array order in `palette.json` is meaningful and must be preserved.**
The kit's physical setup process has the user build a numbered color-key
card (1–16). The order of colors in `palette.json` is deliberately set to
match that card: index 1 = Black, ... index 16 = Bright Yellowish Green. Do
not sort, alphabetize, or otherwise reorder the `colors` array anywhere in
the code — its position order **is** the official color-key numbering used
throughout the instructions output (see 5h).

## 5. Feature-by-feature spec

### 5a. Homepage / intro copy
Before the upload step, show brief explanatory text (a few sentences is
enough) making clear to the user that:
- The output is generated using a **fixed set of 16 colors**, matching
  exactly what's included in their physical Lego kit.
- The **quantity of each color is limited** to what's in the kit — the tool
  will never assign more pips of a color than are actually available, even
  if the source image would otherwise call for more.
- Because of this, the final result is a **best-fit approximation** of the
  uploaded image within those constraints, not a pixel-perfect color match.

This sets expectations up front so the constrained/approximate nature of the
output doesn't feel like a bug later.

### 5b. Image intake
- File input + drag-and-drop zone, accepts standard image types
  (jpg/png/webp/gif/heic where the browser supports it).
- Read via `FileReader` → `<img>` → draw to an offscreen canvas.
- Respect EXIF orientation (some phone photos will appear rotated otherwise —
  use `createImageBitmap(file, { imageOrientation: 'from-image' })` if
  available, or strip/apply EXIF manually).
- Cap max working resolution (e.g., downscale anything above ~1600px on the
  long edge before cropping) purely for performance; final output only needs
  48×48 anyway.

### 5c. Square crop
- Show the uploaded image with a draggable/resizable square crop overlay
  (default: centered, sized to the shorter dimension).
- Support both mouse drag and touch (mobile-friendly).
- "Confirm crop" button commits the square region to a working canvas.

### 5d. Pixelate to 48×48
- Draw the cropped square canvas into a 48×48 canvas using
  `drawImage` with smoothing enabled (this gives an averaged/downsampled
  result rather than nearest-neighbor point-sampling, which looks much better
  for photo-like source images).
- Read back the 48×48 pixel buffer via `getImageData`.

### 5e. Palette matching with inventory constraints
This is the core algorithm. Naive "nearest color per pixel" will over-use
popular colors beyond what's in stock, so it needs to account for supply.

**Recommended approach (greedy, good enough for 2,304 pixels):**
1. Convert every pixel's RGB to **Lab color space** (perceptually uniform —
   makes distance comparisons match human color perception much better than
   raw RGB Euclidean distance). Write a small `rgbToLab()` helper; no need for
   an external library.
2. Convert every palette color to Lab once, up front.
3. Build a working copy of `count` per color (the "remaining stock").
4. For each pixel, compute a *confidence score* = distance to nearest
   available color vs. distance to second-nearest available color (pixels
   with a clear best match are more "confident").
5. Process pixels in order of confidence (most confident/clear-cut matches
   first). For each pixel, assign it to its nearest color **that still has
   remaining stock**, decrement that color's stock, then move on.
6. If a color's stock hits 0, remove it from candidates for all remaining
   pixels.

This ordering matters: assigning the "easy" pixels first (a very clearly red
pixel) before the "ambiguous" ones prevents an early ambiguous pixel from
grabbing a color that a later, more clearly-matching pixel actually needed.

**Note on total supply:** before running the algorithm, sum all `count`
values and compare to 2,304 (48×48). If total available pieces < 2,304, warn
the user up front (they'll run out before the grid is filled) and either let
them proceed anyway (some cells left unfilled/marked "N/A") or block until
they adjust counts. With this particular inventory the total is well over
2,304, so it shouldn't trigger in normal use — but the check should still
exist for arbitrary future palettes.

**Optional upgrade path (mention in README, not required for v1):** true
optimal assignment is a min-cost flow / transportation problem. If the greedy
result looks patchy on tricky images, this is the place to improve later —
not needed for a first working version.

### 5f. Final pixelated preview
- Render the 48×48 recolored grid back onto a canvas, scaled up with
  `imageSmoothingEnabled = false` (crisp blocky pixels, not blurred) — e.g.
  scale each pip to a 12–20px square for viewing/export.
- Offer a PNG download of this final square image.

### 5g. Split into 9 tiles
- The 48×48 grid divides evenly into nine 16×16 tiles: columns 0–15/16–31/32–47
  × rows 0–15/16–31/32–47.
- Label them 1–9 in reading order (left→right, top→bottom), or optionally
  A1–C3 (row letter, column number) — either is fine, just be consistent
  across the tile view and the assembly diagram.

### 5h. Build instructions per tile
For each of the 9 tiles, render:
- A 16×16 grid showing each cell's color swatch **and** its **numeric color
  key (1–16)**, matching the physical color-key card the user already builds
  as part of the kit's setup. The number for a color is simply its 1-indexed
  position in `palette.json`'s `colors` array (1 = Black, ..., 16 = Bright
  Yellowish Green) — do not invent a separate coding scheme. Showing the
  number (not just the swatch color) matters for colorblind users and for
  readability at small print size.
- A legend below/beside the grid: swatch → number → Lego color name → count
  used in this tile. (This is a per-tile "how many of each number you'll need
  for this tile" summary — helpful for pre-sorting pieces before starting a
  tile.)
- A tile header showing its position label (e.g. "Tile 5 of 9 — Center").

### 5i. Assembly diagram
- A simple 3×3 layout diagram showing tile numbers/labels in their final
  position, so the user knows how to arrange the nine finished 16×16 sections
  into the full image.

### 5j. Export
- "Download all" should produce, at minimum:
  - The full 48×48 preview image (PNG).
  - Each of the 9 tile instruction sheets (PNG, or combine into one printable
    page/PDF if you want to go further — plain PNGs are enough for v1).
- Nice-to-have: a printable HTML view (`window.print()`-friendly CSS) so the
  user can print instructions directly from the browser without needing PDF
  generation at all.

## 6. UI flow (suggested)

1. Homepage (intro/explanation copy) → 2. Upload → 3. Crop → 4. Generate
(runs pixelate + matching) → 5. Preview full image → 6. View/download tile
instructions + assembly diagram.

There is no palette review/edit step — the palette is fixed (see section 4)
and isn't part of the user-facing flow at all.

Keep each step on its own screen/section so state is easy to reason about,
with a persistent step indicator.

## 7. Edge cases to handle

- Very small source images (upscaling will look blocky even before
  pixelation — that's fine, just don't crash).
- Non-square, extreme aspect ratio images (crop UI needs to handle very wide
  or very tall sources gracefully).
- Total palette supply < 2,304 pieces (see 5e).
- A color with 0 count from the start (exclude from candidates entirely —
  since there's no palette editor, this would only happen if `palette.json`
  itself is edited to set a count to 0).
- Transparent PNGs (flatten onto a white or user-chosen background before
  processing).
- Large file uploads (multi-MB photos) — downscale early per 5b for
  performance.

## 8. Testing checklist

- Upload jpg, png, and a transparent PNG — confirm sane output for all three.
- Crop a very wide and a very tall image — confirm the square crop UI behaves.
- Set one color's count to 0 and confirm it never appears in output.
- Set total supply below 2,304 and confirm the warning fires.
- Confirm the 9 tiles reassemble (visually) into the full 48×48 preview.
- Test on mobile Safari/Chrome for crop drag via touch.

## 9. Deployment to GitHub Pages

1. Push all files to the repo (root-level `index.html` is simplest).
2. In repo **Settings → Pages**, set source to the `main` branch, root
   folder.
3. No build step needed since it's plain HTML/JS — GitHub Pages will serve it
   as-is.
4. Confirm all asset paths in the code are **relative** (`./js/main.js`, not
   `/js/main.js`), since GitHub Pages project sites are served from a
   subpath (`username.github.io/repo-name/`), not the domain root.

## 10. Anything else you'll need

Nothing beyond a GitHub account and a modern browser to test in — this is a
fully static, client-only app:
- No API keys.
- No backend/server.
- No paid services.
- No build tooling required (though Claude Code is welcome to add a
  lightweight one like Vite if it prefers a dev-server workflow — just make
  sure the final output is a static bundle that works from GitHub Pages).
