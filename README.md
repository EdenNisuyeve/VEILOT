# VEILOT - Homepage

A static, dependency-free homepage for VEILOT, an IoT security company.
It's plain HTML, CSS and JavaScript with no build step and no framework.

## Opening it locally

**Option 1 (simplest):** double-click `index.html`. It opens in your default browser. Everything works over `file://`.

**Option 2 (local server, closer to production):** from this folder, run any static server, for example:

```bash
npx serve .
```

or, if Python is installed:

```bash
python -m http.server 8000
```

Then open the address it prints (for example `http://localhost:8000`).

Fonts load from Google Fonts, so you need an internet connection for the final typography. Without one, the page falls back to system fonts.

### Fonts and hosting

The site uses two families, both loaded as web fonts from Google Fonts in `index.html`: **Oxanium** (400, 500, 600) for headings and labels, and **IBM Plex Sans** (400, 500, 600) for text. They use `display=swap`, so text is visible straight away. These are the only weights the site uses, so no browser has to fake a bold. The font URLs are absolute (`https://fonts.googleapis.com/...`) and all other asset paths are relative, so the site works unchanged from a GitHub Pages repository subfolder (`https://user.github.io/repo/`). File names are case-sensitive on GitHub Pages; every referenced file matches its name exactly.

## Project structure

```
index.html                     Page markup and all copy
css/styles.css                 Design tokens, layout, components, responsive and reduced-motion rules
js/scanner.js                  Hero scan field (canvas)
js/main.js                     Navigation, reveals, approach story, step selector, devices, grid, form
assets/brand/
  veilot-logo.png              Wordmark (cropped from Brand/VEILOT Logo.png)
  veilot-icon.png              Icon: T over square (used as favicon)
  veilot-icon-scan.png         Icon: square + bracket (kept for future use)
assets/devices/                medical.png, vehicles.png, security_cameras.png
```

Brand note: VEILOT reads as Veil + OT, uncovering the threats hidden below the surface. Tagline: "Beyond the visible."

## Brand analysis → design system

| Logo observation | How the site uses it |
|---|---|
| The lime square is the core module (78 px in the source) | Every list bullet, eyebrow mark, button accent, risk marker and node is a square |
| Strokes are about ¼ of the module, with square ends and no rounding | 2 px square-capped strokes throughout, square corners everywhere |
| The bracket icon is an open corner offset by ½ a module, a viewfinder framing the square | Used as the "detection" sign: the hero scanner, the current lifecycle stage, image placeholders and the form |
| Square + bracket at ¼-module stroke, ½-module offset | The hero scanner is literally this icon stretched into a window: lime square at the lower-left, teal bracket at the upper-right, same proportions |
| The T sits above the square, separated by one stroke-width gap | Spacing rhythm: marks sit one stroke apart from what they annotate |

- **Type:** two families only, both free on Google Fonts. Oxanium (the logo typeface) for headlines and short uppercase labels; IBM Plex Sans for everything else.
- **Colour:** white is dominant and deep teal `#0F2A2A` carries structure and type. Lime `#C5ED47` appears only for a detected risk, the active state, or the primary action on dark backgrounds. Supporting greys are tinted toward teal.
- **Motion:** every animation is either a scan (a line passing over something and revealing it) or a reveal (a square appearing). Durations run 180 to 800 ms on a single easing curve.

## Page structure

Navigation (header and footer): Problem, Approach, How it works, Devices, Platform, plus the "Connect With Us" button. Every link scrolls to a real section.

Every contact button on the page (header, hero, devices, form) reads "Connect With Us". The hero and devices buttons share one component, `.btn--cta` in `css/styles.css` (same height, padding and type), and on phones they span the content width. Two buttons are deliberately sized by their surroundings instead: the header button keeps the slimmer nav size (`.btn--sm`, enlarged inside the mobile menu), and the form button fills the form's inner width, lining up with the fields above it.

1. **Hero:** eyebrow "IOT SECURITY. BEYOND THE VISIBLE.", headline "Uncover risks. Secure devices.", one-line intro and an interactive scan field with four short signals.
2. **Security at every layer:** one light-grey container, four equal cells (Device, Firmware, Network, Cloud), each with a brand glyph. Informational, not clickable.
3. **01 / The problem:** why connected devices are a blind spot, with a visibility map.
4. **02 / Our approach:** dark teal section. A full-width lifecycle timeline and one stage shown at a time.
5. **03 / How it works:** a vertical step list on the left; the selected step's animation and description on the right.
6. **04 / What we protect:** three full-bleed image columns (Medical devices, Connected vehicles, Security cameras), followed by a short "Protecting more than what you see." line with a "Connect With Us" button that scrolls to the briefing form.
7. **05 / The platform:** six capabilities.
8. **Connect With Us (contact):** the call to action and form.
9. **Footer:** logo, tagline, links to the sections on this page.

Hero, layers and the problem section share one vertical gap (`--flow` in `css/styles.css`).

## Interactions

- **Hero scanner.** A grid-snapped window follows the mouse. Tiles inside it lift slightly. Four signals sit spread across the right side of the hero (in a band under the buttons on tablets and phones), each starting as an outlined tile. When the scanner passes over one, the tile turns lime and its message appears.
  - Edit the four messages in `index.html`.
  - Without any interaction, or about 1.8 s after the visitor stops moving the mouse or touching the screen, the scanner resumes and reveals the remaining signals one by one, then drifts quietly. New input always takes over immediately.
  - Signals always appear one at a time and stay visible once revealed. On phones the cards are slim rectangles sized to their text, centred under the button and nudged one tile left or right in turn (a subtle zig-zag). On short screens the hero copy tightens slightly (height-based media queries) so the headline, text, button and all four cards fit in the first screen, down to 320 x 568 and the iPhone SE Safari view (375 x 548). Only even shorter screens scroll.
  - On touch screens, tapping the field moves the scanner there and dragging a finger sideways steers it. Vertical swipes always scroll the page, and the automatic scan resumes a few seconds after the last touch.
- **Approach.** The mouse wheel steps through the four stages whenever the cursor is anywhere inside the section's content area (heading, timeline and stage), and only once the timeline and stage are fully on screen. Over the outer left and right margins the page scrolls normally. One deliberate wheel movement moves one stage, and trackpad momentum is absorbed briefly so a gesture never skips stages. At the first or last stage the wheel scrolls on to the neighbouring section. The lime indicator is placed from the measured centre of each stage marker. Stage labels and the arrow buttons work everywhere, and a horizontal swipe changes stage on touch screens.
- **How it works.** The vertical step list is an ARIA tablist (click, tap, arrow keys, Home, End). The mouse wheel also moves between steps, with exactly the same content-area boundaries, one-step-per-gesture control and release at the first and last steps as Our approach. On touch screens, a horizontal swipe over the animation changes step. Selecting a step highlights it, fades out the previous animation and plays the new one with its description underneath. On tablets and phones the list becomes a compact four-step row above the animation.
- **What we protect.** One column is always active. Hover, keyboard focus or click moves it: the column widens and lifts, its photo goes from greyscale to colour, a lime scan line passes over it and its short brief opens. On tablets and phones the three become stacked full-width panels with the brief always visible. The panel crossing the middle of the screen plays the scan, and tapping works too.
- **Contact grid.** On desktop, squares near the cursor brighten slightly in place and fade back. On touch screens the squares around a finger brighten the same way, and a softer light drifts through the grid while the section scrolls past. The grid never moves, and nothing blocks scrolling or the form. Reduced motion keeps the static grid.
- **Back to top.** A small arrow button, fixed bottom-right. It appears after scrolling about one screen and hides near the top. On tablets and phones it steps aside while the briefing form is on screen.
- **Form** checks its fields on the client and then shows a confirmation. To send submissions somewhere, set `FORM_ENDPOINT` in `js/main.js` to a URL that accepts a JSON POST.
- **`prefers-reduced-motion`** is respected. All signals show immediately, nothing moves on its own, and reveals are instant.

## Device photos

The three device columns load `assets/devices/medical.png`, `vehicles.png` and `security_cameras.png`. Each image has its own crop point (the `--focus` value on its `<img>` in `index.html`), so the device stays in view in the tall desktop columns and the wider mobile panels. Photos fade in once loaded over a plain neutral background. If a file is missing, the column keeps its size and shows only that background, with no technical text.

The image URLs end in `?v=1` so browsers fetch fresh copies after a photo is replaced. When you swap a photo again (keeping the same file name), raise that number in `index.html`.
