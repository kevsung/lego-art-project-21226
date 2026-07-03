# Lego Pixel Art Generator

A static, client-side web app that turns any photo into a 48×48 Lego pixel-art
build plan, split into nine 16×16 build tiles with per-tile instructions and
an assembly diagram — matched against your actual Lego piece inventory.

No backend, no build step, no API keys. Runs entirely in the browser.

## Usage

Open `index.html` via a local static server (required for `fetch()` of
`data/palette.json` to work — opening the file directly with `file://` will
fail due to browser CORS restrictions on local file access).

```
python3 -m http.server 8000
# then visit http://localhost:8000
```

Any static server works (`npx serve`, VS Code Live Server, etc).

## Flow

1. Upload an image (drag-and-drop or file picker).
2. Crop it to a square.
3. Review/edit the color palette and piece counts (`data/palette.json` is the
   starting inventory — edits are in-memory only for this session).
4. Generate — pixelates to 48×48 and matches each pixel to the closest
   available Lego color, respecting your inventory counts.
5. Preview the final image, download as PNG.
6. View/download/print the 9 tile instruction sheets plus an assembly diagram.

## Editing the palette

Edit `data/palette.json` directly for permanent changes, or use the in-app
palette table (step 3) for one-off adjustments to hex codes and counts.

## Algorithm notes

Color matching converts pixels and palette colors to Lab color space (closer
to human perception than raw RGB) and assigns pixels to their nearest
in-stock color, processing the most "confident" (clear-cut) pixel matches
first so ambiguous pixels don't grab colors that a later, better-matching
pixel needs. See `js/palette.js`.

This greedy approach is good enough for 2,304 pixels but isn't globally
optimal. A future improvement would be a true min-cost flow / transportation
solve if greedy results look patchy on tricky images.

## Deploying to GitHub Pages

1. Push to `main`.
2. Settings → Pages → source: `main` branch, root folder.
3. All asset paths are relative, so it works from a project subpath
   (`username.github.io/repo-name/`).
