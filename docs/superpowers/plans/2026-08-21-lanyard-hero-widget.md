# Lanyard Hero Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the React Bits `Lanyard` component (draggable 3D ID card on a physics lanyard, showing the user's own photo) to the right side of the homepage hero, without touching the rest of the site's plain HTML/CSS/JS setup.

**Architecture:** A separate `lanyard-widget/` Vite+React project builds to a single bundled `dist/lanyard.js` (styles injected via a `<style>` tag from JS, not a separate CSS file — avoids fiddly Vite CSS-extraction config in library mode). That built file is committed to the repo and loaded by `index.html` via a plain `<script type="module">` tag, same pattern as the existing `masked-name.js`/`topography.js` includes. The rest of the site — `aboutMe.html`, `myWork.html`, `style.css` (aside from a small hero layout addition) — is untouched.

**Tech Stack:** Vite, React 18, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`, `meshline`, `three`. Consumed by a static HTML site with no other build step.

## Global Constraints

- No Tailwind anywhere in this repo — the original Lanyard source's Tailwind classes must be replaced with plain CSS (spec: "Remove Tailwind classes").
- Build output (`lanyard-widget/dist/`) is committed to git — the main site has no build step at deploy time (spec: "Deploy & wire-up").
- Card front image: `/images/photo_2024-05-19_15-16-22.jpg` (site-relative path, no duplicate asset copied into `lanyard-widget/`) — back image left unset.
- `card.glb` and `lanyard.png` come from `https://github.com/DavidHDev/react-bits/tree/main/src/assets/lanyard`, unmodified.
- No automated tests — this is a visual/interactive 3D widget; verification is manual in-browser (spec: "Testing / verification").
- Widget sits to the right of the existing hero text on desktop, stacked below it on narrow viewports (confirmed placement).

---

### Task 1: Scaffold the `lanyard-widget` Vite project

**Files:**
- Create: `lanyard-widget/package.json`
- Create: `lanyard-widget/vite.config.js`
- Create: `lanyard-widget/.gitignore`

**Interfaces:**
- Produces: an `npm run build` script in `lanyard-widget/` that Task 4 will run, configured to bundle `src/main.jsx` into a single `dist/lanyard.js` (ES module format, no code-splitting, `.glb` treated as an asset).

- [ ] **Step 1: Create `lanyard-widget/package.json`**

```json
{
  "name": "lanyard-widget",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.169.0",
    "@react-three/fiber": "^8.17.10",
    "@react-three/drei": "^9.114.3",
    "@react-three/rapier": "^1.5.0",
    "meshline": "^3.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.3",
    "vite": "^5.4.10"
  }
}
```

- [ ] **Step 2: Create `lanyard-widget/vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.glb'],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/main.jsx',
      name: 'LanyardWidget',
      formats: ['es'],
      fileName: () => 'lanyard.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
})
```

- [ ] **Step 3: Create `lanyard-widget/.gitignore`**

```
node_modules/
```

- [ ] **Step 4: Install dependencies**

Run: `cd lanyard-widget && npm install`
Expected: completes without error, creates `lanyard-widget/node_modules/` and `lanyard-widget/package-lock.json`.

- [ ] **Step 5: Commit**

```bash
git add lanyard-widget/package.json lanyard-widget/package-lock.json lanyard-widget/vite.config.js lanyard-widget/.gitignore
git commit -m "feat: scaffold lanyard-widget Vite project"
```

---

### Task 2: Download the card model and lanyard texture

**Files:**
- Create: `lanyard-widget/src/card.glb` (binary)
- Create: `lanyard-widget/src/lanyard.png` (binary)

**Interfaces:**
- Produces: two local asset files that Task 3's `Lanyard.jsx` imports as `./card.glb` and `./lanyard.png`.

- [ ] **Step 1: Download the assets from the react-bits repo**

Run:
```bash
mkdir -p lanyard-widget/src
curl -fL -o lanyard-widget/src/card.glb https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/assets/lanyard/card.glb
curl -fL -o lanyard-widget/src/lanyard.png https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/assets/lanyard/lanyard.png
```
Expected: both commands exit 0.

- [ ] **Step 2: Sanity-check the downloads**

Run: `ls -la lanyard-widget/src/card.glb lanyard-widget/src/lanyard.png`
Expected: `card.glb` is at least a few hundred KB (a GLB binary), `lanyard.png` is at least a few KB. If either file is small (a few hundred bytes) and readable as text, the download hit an HTML error page instead of the raw file — re-check the URL, don't proceed with a corrupted asset (react-bits issue #130 documents this failure mode for this exact asset pair via a different install path).

- [ ] **Step 3: Commit**

```bash
git add lanyard-widget/src/card.glb lanyard-widget/src/lanyard.png
git commit -m "feat: add lanyard card model and band texture assets"
```

---

### Task 3: Adapt the Lanyard component (drop Tailwind, keep physics/rig logic)

**Files:**
- Create: `lanyard-widget/src/Lanyard.jsx`

**Interfaces:**
- Consumes: `./card.glb`, `./lanyard.png` (from Task 2).
- Produces: `export default function Lanyard({ position, gravity, fov, transparent, frontImage, backImage, imageFit, lanyardImage, lanyardWidth })` — same prop names/defaults as the original React Bits component. Renders into a `<div className="lanyard-canvas">` (not `h-screen`) so Task 4/5 can size it via plain CSS instead of Tailwind.

- [ ] **Step 1: Write `lanyard-widget/src/Lanyard.jsx`**

```jsx
/* eslint-disable react/no-unknown-property */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import { useGLTF, useTexture, Environment, Lightformer } from '@react-three/drei';
import { BallCollider, CuboidCollider, Physics, RigidBody, useRopeJoint, useSphericalJoint } from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';

import cardGLB from './card.glb';
import lanyard from './lanyard.png';

import * as THREE from 'three';

extend({ MeshLineGeometry, MeshLineMaterial });

// 1x1 transparent pixel — lets useTexture be called unconditionally when a
// front/back image isn't supplied.
const BLANK_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// The card model's front face is UV-mapped to the LEFT half of the texture
// atlas and the back face to the RIGHT half (measured from card.glb). Each
// custom image is composited into its own half so the two faces render
// independently, aspect-preserving (no stretching).
const FRONT_UV_RECT = { x: 0, y: 0, w: 0.5, h: 0.755 };
const BACK_UV_RECT = { x: 0.5, y: 0, w: 0.5, h: 0.757 };

export default function Lanyard({
  position = [0, 0, 30],
  gravity = [0, -40, 0],
  fov = 20,
  transparent = true,
  frontImage = null,
  backImage = null,
  imageFit = 'cover',
  lanyardImage = null,
  lanyardWidth = 1
}) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="lanyard-canvas">
      <Canvas
        camera={{ position: position, fov: fov }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ alpha: transparent }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1)}
      >
        <ambientLight intensity={Math.PI} />
        <Physics gravity={gravity} timeStep={isMobile ? 1 / 30 : 1 / 60}>
          <Band
            isMobile={isMobile}
            frontImage={frontImage}
            backImage={backImage}
            imageFit={imageFit}
            lanyardImage={lanyardImage}
            lanyardWidth={lanyardWidth}
          />
        </Physics>
        <Environment blur={0.75}>
          <Lightformer
            intensity={2}
            color="white"
            position={[0, -1, 5]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="white"
            position={[-1, -1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="white"
            position={[1, 1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={10}
            color="white"
            position={[-10, 0, 14]}
            rotation={[0, Math.PI / 2, Math.PI / 3]}
            scale={[100, 10, 1]}
          />
        </Environment>
      </Canvas>
    </div>
  );
}

function Band({
  maxSpeed = 50,
  minSpeed = 0,
  isMobile = false,
  frontImage = null,
  backImage = null,
  imageFit = 'cover',
  lanyardImage = null,
  lanyardWidth = 1
}) {
  const band = useRef(),
    fixed = useRef(),
    j1 = useRef(),
    j2 = useRef(),
    j3 = useRef(),
    card = useRef();
  const vec = new THREE.Vector3(),
    ang = new THREE.Vector3(),
    rot = new THREE.Vector3(),
    dir = new THREE.Vector3();
  const segmentProps = { type: 'dynamic', canSleep: true, colliders: false, angularDamping: 4, linearDamping: 4 };
  const { nodes, materials } = useGLTF(cardGLB);
  const texture = useTexture(lanyardImage || lanyard);
  // useTexture must be called unconditionally; use a blank pixel when an image
  // isn't supplied for a given face, then skip compositing it below.
  const frontTex = useTexture(frontImage || BLANK_PIXEL);
  const backTex = useTexture(backImage || BLANK_PIXEL);

  // Composite the front/back images into the card's texture atlas (front = left
  // half, back = right half). Each image is drawn aspect-preserving (no stretch).
  const cardMap = useMemo(() => {
    const baseMap = materials.base.map;
    if (!frontImage && !backImage) return baseMap;

    const baseImg = baseMap.image;
    const W = baseImg.width;
    const H = baseImg.height;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return baseMap;
    // Keep the original baked atlas for the card edges and any untouched face.
    ctx.drawImage(baseImg, 0, 0, W, H);

    const drawFitted = (img, rect) => {
      const rx = rect.x * W;
      const ry = rect.y * H;
      const rw = rect.w * W;
      const rh = rect.h * H;
      const pick = imageFit === 'contain' ? Math.min : Math.max;
      const scale = pick(rw / img.width, rh / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = rx + (rw - dw) / 2;
      const dy = ry + (rh - dh) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    };

    if (frontImage && frontTex.image) drawFitted(frontTex.image, FRONT_UV_RECT);
    if (backImage && backTex.image) drawFitted(backTex.image, BACK_UV_RECT);

    const composite = new THREE.CanvasTexture(canvas);
    composite.colorSpace = THREE.SRGBColorSpace;
    composite.flipY = baseMap.flipY;
    composite.anisotropy = 16;
    composite.needsUpdate = true;
    return composite;
  }, [frontImage, backImage, imageFit, frontTex, backTex, materials.base.map]);
  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()])
  );
  const [dragged, drag] = useState(false);
  const [hovered, hover] = useState(false);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, 1.5, 0]
  ]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab';
      return () => void (document.body.style.cursor = 'auto');
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach(ref => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({ x: vec.x - dragged.x, y: vec.y - dragged.y, z: vec.z - dragged.z });
    }
    if (fixed.current) {
      [j1, j2].forEach(ref => {
        if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
        const clampedDistance = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())));
        ref.current.lerped.lerp(
          ref.current.translation(),
          delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed))
        );
      });
      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(j2.current.lerped);
      curve.points[2].copy(j1.current.lerped);
      curve.points[3].copy(fixed.current.translation());
      band.current.geometry.setPoints(curve.getPoints(isMobile ? 16 : 32));
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
    }
  });

  curve.curveType = 'chordal';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[2, 0, 0]} ref={card} {...segmentProps} type={dragged ? 'kinematicPosition' : 'dynamic'}>
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={e => (e.target.releasePointerCapture(e.pointerId), drag(false))}
            onPointerDown={e => (
              e.target.setPointerCapture(e.pointerId),
              drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())))
            )}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial
                map={cardMap}
                map-anisotropy={16}
                clearcoat={isMobile ? 0 : 1}
                clearcoatRoughness={0.15}
                roughness={0.9}
                metalness={0.8}
              />
            </mesh>
            <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.3} />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          color="white"
          depthTest={false}
          resolution={isMobile ? [1000, 2000] : [1000, 1000]}
          useMap
          map={texture}
          repeat={[-4, 1]}
          lineWidth={lanyardWidth}
        />
      </mesh>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lanyard-widget/src/Lanyard.jsx
git commit -m "feat: adapt Lanyard component for vanilla CSS (no Tailwind)"
```

---

### Task 4: Write the mount entry and build the bundle

**Files:**
- Create: `lanyard-widget/src/main.jsx`

**Interfaces:**
- Consumes: `Lanyard` default export from `./Lanyard.jsx` (Task 3).
- Produces: `lanyard-widget/dist/lanyard.js` — an ES module that, when loaded via `<script type="module">`, finds `#lanyard-root` in the page, injects its own `<style>` block, and mounts `<Lanyard frontImage="/images/photo_2024-05-19_15-16-22.jpg" />` into it. This is what Task 5 wires into `index.html`.

- [ ] **Step 1: Write `lanyard-widget/src/main.jsx`**

```jsx
import { createRoot } from 'react-dom/client';
import Lanyard from './Lanyard.jsx';

const STYLES = `
.lanyard-canvas {
  position: relative;
  width: 100%;
  height: 480px;
  display: flex;
  justify-content: center;
  align-items: center;
}
@media (max-width: 720px) {
  .lanyard-canvas {
    height: 360px;
  }
}
`;

function mount() {
  const root = document.getElementById('lanyard-root');
  if (!root) return;

  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.appendChild(style);

  createRoot(root).render(
    <Lanyard frontImage="/images/photo_2024-05-19_15-16-22.jpg" />
  );
}

mount();
```

- [ ] **Step 2: Build**

Run: `cd lanyard-widget && npm run build`
Expected: exits 0, creates `lanyard-widget/dist/lanyard.js`.

- [ ] **Step 3: Verify the bundle contains the expected code**

Run: `grep -c "lanyard-root" lanyard-widget/dist/lanyard.js`
Expected: a number >= 1 (confirms `main.jsx`'s mount logic made it into the built bundle, not just tree-shaken away).

- [ ] **Step 4: Commit**

```bash
git add lanyard-widget/src/main.jsx lanyard-widget/dist/lanyard.js
git commit -m "feat: build lanyard-widget bundle"
```

---

### Task 5: Wire the widget into the hero and verify in-browser

**Files:**
- Modify: `index.html:36-78` (hero section markup)
- Modify: `index.html:441` (add script tag after the existing `topography.js` include)
- Modify: `style.css:155-156` (hero rule block — add layout CSS)

**Interfaces:**
- Consumes: `lanyard-widget/dist/lanyard.js` (Task 4), which self-mounts into any element with `id="lanyard-root"`.

- [ ] **Step 1: Restructure the hero markup in `index.html`**

Replace lines 36-78:

```html
    <!-- HERO -->
    <section id="home" class="hero">
      <div class="wrap">
        <div class="status data">
          <span class="dot" aria-hidden="true"></span>
          <span>Open to opportunities</span>
          <span class="sep" aria-hidden="true">/</span>
          <span>Kuala Lumpur</span>
          <span class="sep" aria-hidden="true">/</span>
          <span class="clock" id="clock" aria-label="Current local time in Kuala Lumpur">—</span>
        </div>

        <p class="hero-hi">Hey, I'm</p>
        <h1><span class="mh-fill" id="heroName">Wan Hafizuddin</span><span class="dot">.</span></h1>
        <p class="hero-lead">A <b>Software Engineering</b> student at Universiti Putra Malaysia, now geared toward <b>data, ML &amp; AI engineering</b> — I train machine-learning models in Python and build full-stack applications end to end.</p>

        <div class="hero-chips">
          <span class="chip">Data Engineering</span>
          <span class="chip">Machine Learning</span>
          <span class="chip">AI Engineering</span>
          <span class="chip">Python</span>
        </div>

        <div class="hero-actions">
          <a href="#projects" class="btn btn-primary">View my work <span class="arw" aria-hidden="true">→</span></a>
          <a href="#contact" class="btn btn-ghost">Get in touch</a>
        </div>

        <div class="stats data" aria-label="Highlights">
          <div class="stat">
            <div class="num" data-target="5" data-pad="2">00</div>
            <div class="lbl">Projects built</div>
          </div>
          <div class="stat">
            <div class="num" data-target="3" data-pad="2">00</div>
            <div class="lbl">Events led</div>
          </div>
          <div class="stat">
            <div class="num" data-target="2027">0</div>
            <div class="lbl">Graduating</div>
          </div>
        </div>
      </div>
    </section>
```

with:

```html
    <!-- HERO -->
    <section id="home" class="hero">
      <div class="wrap">
        <div class="hero-content">
          <div class="status data">
            <span class="dot" aria-hidden="true"></span>
            <span>Open to opportunities</span>
            <span class="sep" aria-hidden="true">/</span>
            <span>Kuala Lumpur</span>
            <span class="sep" aria-hidden="true">/</span>
            <span class="clock" id="clock" aria-label="Current local time in Kuala Lumpur">—</span>
          </div>

          <p class="hero-hi">Hey, I'm</p>
          <h1><span class="mh-fill" id="heroName">Wan Hafizuddin</span><span class="dot">.</span></h1>
          <p class="hero-lead">A <b>Software Engineering</b> student at Universiti Putra Malaysia, now geared toward <b>data, ML &amp; AI engineering</b> — I train machine-learning models in Python and build full-stack applications end to end.</p>

          <div class="hero-chips">
            <span class="chip">Data Engineering</span>
            <span class="chip">Machine Learning</span>
            <span class="chip">AI Engineering</span>
            <span class="chip">Python</span>
          </div>

          <div class="hero-actions">
            <a href="#projects" class="btn btn-primary">View my work <span class="arw" aria-hidden="true">→</span></a>
            <a href="#contact" class="btn btn-ghost">Get in touch</a>
          </div>

          <div class="stats data" aria-label="Highlights">
            <div class="stat">
              <div class="num" data-target="5" data-pad="2">00</div>
              <div class="lbl">Projects built</div>
            </div>
            <div class="stat">
              <div class="num" data-target="3" data-pad="2">00</div>
              <div class="lbl">Events led</div>
            </div>
            <div class="stat">
              <div class="num" data-target="2027">0</div>
              <div class="lbl">Graduating</div>
            </div>
          </div>
        </div>

        <div class="hero-visual">
          <div id="lanyard-root"></div>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: Add the script tag**

In `index.html`, after line 441 (`<script type="module" src="topography.js"></script>`), add:

```html
  <script type="module" src="lanyard-widget/dist/lanyard.js"></script>
```

- [ ] **Step 3: Add hero layout CSS**

In `style.css`, right after line 156 (`.hero { padding: 60px 0 86px; }`), add:

```css
.hero .wrap { display: flex; align-items: center; gap: 48px; }
.hero-content { flex: 1 1 480px; min-width: 0; }
.hero-visual { flex: 1 1 380px; min-width: 280px; }
```

In the `@media (max-width: 720px)` block (around line 376-386), add a line to stack the columns:

```css
  .hero .wrap { flex-direction: column; }
```

- [ ] **Step 4: Serve the site and check it renders**

Run: use the `portfolio` preview config in `.claude/launch.json` (`python -m http.server 5173`), open `http://localhost:5173/` in a browser.

Expected, checked via the browser preview tools:
- No errors in the browser console (`read_console_messages`).
- No failed network requests for `lanyard-widget/dist/lanyard.js`, `card.glb`, `lanyard.png`, or the front-image path (`read_network_requests`).
- The card renders to the right of the hero text with the chosen photo visible on its front face (screenshot).
- Clicking and dragging the card moves it, and it swings back on release.

- [ ] **Step 5: Check the narrow-viewport layout**

Resize the preview to the mobile preset (or `< 720px` width), reload, and confirm the hero visual stacks below the hero text rather than being squeezed beside it, and the card still renders without console errors.

- [ ] **Step 6: Commit**

```bash
git add index.html style.css
git commit -m "feat: mount Lanyard widget in hero, next to hero text"
```

---

## Self-Review Notes

- **Spec coverage:** scaffold+deps (Task 1), assets (Task 2), component adaptation dropping Tailwind (Task 3), build producing `dist/lanyard.js` (Task 4), `index.html`/`style.css` wiring + manual verification (Task 5) — all spec sections have a task.
- **Type/name consistency:** `Lanyard` default export and its prop names (`frontImage`, `backImage`, `imageFit`, `lanyardImage`, `lanyardWidth`, `position`, `gravity`, `fov`, `transparent`) are identical between Task 3's definition and Task 4's usage. `#lanyard-root` id is identical between Task 4's `main.jsx` and Task 5's `index.html` markup. `.lanyard-canvas` class name is identical between Task 3's JSX and Task 4's injected `STYLES`.
- **Placeholder scan:** no TBDs; every step has literal file content and literal shell commands.
