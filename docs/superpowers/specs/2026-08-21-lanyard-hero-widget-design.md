# Lanyard hero widget — design

## Context

Portfolio site (`index.html`, `style.css`, vanilla JS) has no framework or build tool — plain static HTML served via `python -m http.server` (see `.claude/launch.json`), currently deployed via CNAME (GitHub Pages today; moving to Vercel later per project notes).

Request: integrate the React Bits `Lanyard` component (a draggable 3D ID-card-on-a-lanyard, built on React Three Fiber + Rapier physics) into the hero section, showing the user's own photo on the card face.

`Lanyard` is React + `@react-three/fiber` + `@react-three/drei` + `@react-three/rapier` + `meshline` + `three` — a stack that cannot be hand-rolled into vanilla JS the way the existing `masked-name.js` (a CSS-driven React Bits port) was. It needs a real bundler.

## Decision: isolated Vite+React subset, not a site-wide framework migration

Rest of the site (`aboutMe.html`, `myWork.html`, nav, hero copy, etc.) stays exactly as-is — plain HTML/CSS/JS. Only the Lanyard widget gets a build step, and its *output* is a static JS/CSS bundle checked into the repo, so the deployed site remains servable as plain static files with no build step required at deploy time.

Alternatives considered and rejected:
- **Convert whole site to React** — far larger scope than requested, not needed just to show one 3D widget.
- **Hand-roll in vanilla three.js** — throws away the maintained Lanyard physics/rigging code for no real benefit; the isolated-bundle approach gets the real component with zero blast radius on the rest of the site.

## Structure

```
lanyard-widget/                  # new, separate npm project
  package.json                   # react, react-dom, three, @react-three/fiber,
                                  # @react-three/drei, @react-three/rapier, meshline, vite
  vite.config.js                 # assetsInclude: ['**/*.glb'], build.lib -> single JS+CSS output
  src/
    Lanyard.jsx                  # adapted from React Bits source (see below)
    main.jsx                     # mounts <Lanyard /> into #lanyard-root
    card.glb                     # from DavidHDev/react-bits: src/assets/lanyard/card.glb
    lanyard.png                  # from DavidHDev/react-bits: src/assets/lanyard/lanyard.png
  dist/
    lanyard.js                   # BUILD OUTPUT — committed to repo
    lanyard.css                  # BUILD OUTPUT — committed to repo (if Vite emits one)
```

## Component adaptation (Lanyard.jsx)

Starting from the React Bits source in the request:

- **Remove Tailwind classes** (`w-full h-screen flex justify-center items-center ...`). Site has no Tailwind anywhere else. Replace with a plain CSS class (`.lanyard-canvas`) defined in a small stylesheet bundled alongside `lanyard.js`, sized to fit the hero rather than full viewport height (~480px desktop, shorter on mobile — final numbers tuned during implementation against the existing `.hero` layout in `style.css`).
- **Props used at the call site**:
  - `frontImage="/images/photo_2024-05-19_15-16-22.jpg"` — site-relative path, no duplicate asset copied into `lanyard-widget/`.
  - `backImage` — left unset; falls back to the model's baked back-face texture.
  - `position`, `gravity`, `fov` — left at component defaults unless they look wrong once rendered.
- Everything else (physics rig, drag interaction, meshline band, lighting) is used as-is from the source.

## Build & wire-up

1. `cd lanyard-widget && npm install && npm run build` produces `dist/lanyard.js` (+ `dist/lanyard.css` if separate).
2. Both build outputs are committed to the repo (no CI/build step assumed at deploy time).
3. `index.html` hero section (`#home .hero .wrap`) gets:
   - `<div id="lanyard-root"></div>` placed beside the existing hero text, laid out via a small addition to `style.css` (flex row on desktop, stacked on mobile).
   - `<link rel="stylesheet" href="lanyard-widget/dist/lanyard.css">` in `<head>` (if a CSS file is emitted).
   - `<script type="module" src="lanyard-widget/dist/lanyard.js"></script>` before `</body>`, alongside the existing `masked-name.js`/`topography.js` script tags.

## Assets

`card.glb` and `lanyard.png` fetched from `https://github.com/DavidHDev/react-bits/tree/main/src/assets/lanyard` (raw.githubusercontent.com) and committed under `lanyard-widget/src/`. No edits to these files needed — the card's photo comes from the `frontImage` runtime-compositing path in the component, not from editing the `.glb`.

## Testing / verification

- Serve the whole site with the existing `python -m http.server` config (`.claude/launch.json`, port 5173).
- Open in browser: confirm the card renders with the chosen photo on its front face, the band/physics respond to drag, and there are no console errors.
- Check the hero on a narrow viewport (mobile breakpoint) — component already has internal `isMobile` handling (lower DPR, disabled clearcoat, slower physics timestep), but the *container* sizing/stacking is new CSS and needs a visual check.
- No automated tests — this is a visual/interactive widget; verification is manual in-browser per the standard UI-change workflow.

## Out of scope

- No changes to `aboutMe.html`, `myWork.html`, or any other page.
- No Tailwind, no site-wide bundler, no TypeScript.
- No back-face image (single front photo only, per approved design).
