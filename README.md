# Cartoon Set

Three flat vector characters drawn in Adobe Illustrator. The source files are the `.ai` documents in the repository root; the PNGs in `previews/` are rendered from them so the work can be seen on GitHub without opening Illustrator.

Gallery: https://abdimannor.github.io/cartoon-set/

## The gallery page

The page hangs the three prints on a wall and lets you look closer than a PNG allows:

- **Lightbox with the real vectors.** Opening a print renders the original `.ai` file (PDF-compatible) with a vendored pdf.js and re-rasterises it at the current zoom, so lines stay crisp. Wheel, pinch, drag and keys all work.
- **Remix the palette.** Recolour a character live through a colour map, compare it with the original using a split divider, reset, or download your version as a PNG.
- **Colour story.** Each character's palette is shown as swatches, read from `previews/palettes.json`.
- **Gallery light.** A warm spot follows the cursor across the wall. A visible motion switch follows the system's reduced-motion setting by default; with motion off the light stays parked above the middle print.

Built with `index.html`, `style.css`, `lightbox.js`, `light.js` and `previews/palette.js`; no build step. `scripts/palette-test.mjs` checks the palette data.

## The characters

| Cartoon 1 | Cartoon 2 | Cartoon 3 |
|---|---|---|
| ![Cartoon 1: smiling man in a red sleeveless top carrying a blue case](previews/cartoon1.png) | ![Cartoon 2: smiling man with braided hair in an all-black outfit](previews/cartoon2.png) | ![Cartoon 3: round red and black robot-like figure with arms spread](previews/cartoon3.png) |

- **Cartoon 1** (`Cartoon1.ai`): a standing man with dark curly hair and a wide open smile, in a red sleeveless top, black trousers and red shoes, holding a blue case in one hand.
- **Cartoon 2** (`Cartoon2.ai`): a standing man with braided hair and the same wide smile, dressed in black from top to shoes, arms at his sides.
- **Cartoon 3** (`Cartoon3.ai`): a rounder, robot-like figure with a black helmet and visor, a red body with a round green lens on the chest, and arms spread wide.

All three share the same flat style: simple geometric shapes, no outlines, and a small palette of red, black, blue and skin tones on a white page.

## Opening and editing

- **Adobe Illustrator:** open any `CartoonN.ai` file directly. The layers and paths are fully editable.
- **Without Illustrator:** the files are saved with PDF compatibility, so a PDF viewer (Preview on macOS, a browser) can display them. Inkscape and Affinity Designer can import them for editing, though some Illustrator-specific features may not carry over.
- **Re-rendering the previews on macOS:**

  ```sh
  cp Cartoon1.ai /tmp/cartoon1.pdf
  qlmanage -t -s 1600 -o /tmp /tmp/cartoon1.pdf
  sips -s format png -Z 1600 /tmp/cartoon1.pdf.png --out previews/cartoon1.png
  ```

## License

Released under the MIT License. See [LICENSE](LICENSE).
