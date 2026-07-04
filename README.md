# Lego Pixel Art Generator

A static, client-side web app that turns any photo into a 48×48 Lego pixel-art
build plan for Lego set 21226, split into nine 16×16 build tiles with
per-tile instructions and an assembly diagram — matched against that kit's
fixed 16-color inventory.

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

1. Home — intro explaining the tool is built around Lego set 21226's fixed
   16-color, fixed-quantity kit.
2. Upload an image (drag-and-drop or file picker).
3. Crop it to a square.
4. Generate — pixelates to 48×48 and matches each pixel to the closest
   available Lego color, respecting the kit's exact piece counts.
5. Preview the final image, download as PNG.
6. View/download/print the 9 tile instruction sheets (numbered 1–16 to match
   the kit's physical color-key card) plus an assembly diagram.

## Editing the palette

The palette is fixed and read-only at runtime — there is no in-app editor.
To change colors or counts, edit `data/palette.json` directly. The array
order is meaningful: each color's position (1-indexed) is the number shown
in the build instructions, matching the kit's physical color-key card, so
don't reorder it.

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
