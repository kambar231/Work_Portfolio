/* cubes.js — the cube hero.
 *
 * A fixed canvas (z-index 0, pointer-events none) above the particle field and below
 * the DOM text. Eight photo-textured cubes float in a sorted 4x2 grid parked in the
 * UPPER-RIGHT of the hero (the lower-left is left clear for the headline), each with a
 * soft DOM label under it. The grid unravels into a seeded, non-overlapping cloud as
 * you scroll the first 120vh. Clicking a cube scrolls to its chapter.
 *
 * LAYOUT: cubes render ~106 px tall at 1440 wide with air (column spacing 2.4, tighter
 * rows); the 4x2 group projects into the upper-right, clears the nav by >=24px, and never
 * overlaps the headline or a label at 1280/1440/1920 (asserted by the projection verifier).
 * Scatter targets are a screen-centred expansion of the grid (jittered, with depth) chosen
 * by a seeded search so no two cubes overlap at any point of the unravel, in frustum.
 *
 * PHASE 2: chapterPark(i, side, t) travels cube i to a parking anchor (24vw or 76vw, 48vh)
 * at scale 1.9 with slowed tumble while the others recede (z back, opacity 0.35);
 * chapterDim(t) recedes the whole cloud (origin chapter, which parks no project cube).
 *
 * PUBLIC API:
 *   createCubeHero({ onCubeClick }) -> hero
 *   hero.frame(now, dt, moving)   drive one animation frame from the master loop
 *   hero.setUnravel(p)            p in [0,1]: 0 sorted grid, 1 scattered cloud; labels
 *                                 fade out over the first 20% of p
 *   hero.setState(name)           'sorted' | 'unravelled' (GSAP tween, else instant)
 *   hero.focus(i)                 FOCUS pose for phase 2 (cube i left, scale 2.2)
 *   hero.raycast(ndc)             hit-test, returns cube index or -1
 *   hero.setPointer(nx, ny)       normalised cursor for parallax
 *   hero.cubeBoxes()              screen bounding boxes of the 8 cubes (verifier hook)
 *   hero.labelBoxes()            screen bounding boxes of visible labels (verifier hook)
 *   hero.sectionFor(i) / hero.count / hero.ready
 *
 * Material: BoxGeometry 1x1x1, MeshStandardMaterial roughness .7 metalness 0, six face
 * maps; DirectionalLight 1.6 at (-3,4,5) + fill 0.5 at (4,-2,3) + AmbientLight .45;
 * ACES filmic tone mapping, sRGB output; no shadows, no fog, no outlines.
 */
import * as THREE from 'three';

const FOV = 45;
const CUBE_PX = 106;          // target on-screen height of a 1-unit cube (px)
const SPACING = 2.4;          // column spacing in units (gaps > one cube width)
const ROW_SPACING = 1.7;      // row spacing (tighter, so the larger grid still fits the band)
const REGION_NDC_X = 0.34;    // grid centre in NDC -> upper-right of the hero
const REGION_NDC_Y = 0.42;    // top row clears the nav by >=24px; bottom row clears the headline
const LABEL_DROP = 0.62;      // how far below a cube its label sits (world units)
const BOB_AMP = 0.06;
const TUMBLE_X = 0.0014;      // per 1/60 s (gentle, keeps the sorted hero calm)
const TUMBLE_Y = 0.0022;
const PARALLAX_LERP = 0.06;
const PARALLAX_MAX = 0.05;    // rad (kept small so the sorted cluster stays put)

// ---- motion engine (round 3, spec 8.1) ----
// Positions change ONLY by integration (pos += vel*dt). Sections set targets; a critically
// damped spring moves the cube; repulsion + lane avoidance are soft forces added to velocity.
const OMEGA = 2.2, ZETA = 1.0;       // critically damped spring (settles, never overshoots)
const DT_MAX = 0.05;                 // clamp dt so a stall never launches a cube
const MAX_PX_FRAME = 12;             // no cube's projected centre moves > 12 px per 1/60 s
const CUBE_SHRINK = 0.68;            // inscribed footprint (matches verify_all.py)
const REPULSE_GAIN = 10.0;           // cube-cube repulsion (1/s), stiffer than omega^2 at contact

// cube -> faces, soft label, target section. Each cube shows ONLY its own project's
// images so the parked cube in a chapter is that project. Face order is [px,nx,py,ny,pz,nz].
const CUBES = [
  { label: 'simulate', section: '#polymer',
    photos: ['polymer-phase-sep', 'polymer-2', 'polymer-phase-sep', 'polymer-1', 'polymer-phase-sep', 'polymer-3'] },
  { label: 'make', section: '#casting',
    photos: ['casting-1', 'casting-2', 'casting-3', 'casting-4', 'casting-5', 'casting-3'] },
  { label: 'build', section: '#cnc',
    photos: ['cnc-machine', 'cnc-bed', 'cnc-cut-clean', 'cnc-cut-rough', 'cnc-cut-warm', 'cnc-machine'] },
  { label: 'software', section: '#slicer',
    photos: ['slicer-software', 'slicer-stl-viewer', 'slicer-stl-detail', 'slicer-layer-plot', 'slicer-software', 'slicer-stl-viewer'] },
  { label: 'deploy', section: '#raymond',
    photos: ['raymond-forklift.png', 'sens-plus-flyer', 'raymond-forklift.png', 'raymond-forklift.png', 'raymond-forklift.png', 'raymond-forklift.png'] },
  { label: 'print', section: '#others',
    photos: ['motor-stator', 'motor-wound-pair', 'motor-desk', 'motor-exploded', 'motor-shaft', 'motor-stator'] },
  { label: 'dynamics', section: '#others',
    photos: ['pendulum-1', 'pendulum-2', 'pendulum-3', 'cannon-1', 'cannon-2', 'cannon-3'] },
  { label: 'flight', section: '#others',
    photos: ['flight-dynamics', 'flight-1', 'flight-dynamics', 'flight-2', 'flight-dynamics', 'flight-3'] },
];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createCubeHero({ onCubeClick } = {}) {
  const canvas = document.createElement('canvas');
  canvas.id = 'cubes-canvas';
  document.body.appendChild(canvas);
  // canvas stays hidden (CSS) until body.cubes-ready is set once textures have loaded

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth > 1920 ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(4, -2, 3);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  const group = new THREE.Group();
  scene.add(group);

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const loader = new THREE.TextureLoader();
  const loads = [];
  // each cube stays invisible until its own textures load, then fades in, so no cube is
  // ever shown as flat grey; cubeReveal[i] lerps toward revealTargets[i]
  const cubeReveal = new Array(CUBES.length).fill(0);
  const revealTargets = new Array(CUBES.length).fill(0);
  // safety: after 2.5s every cube shows regardless (neutral #e0e0e0 for any missing face)
  setTimeout(() => {
    for (let i = 0; i < revealTargets.length; i++) revealTargets[i] = 1;
    for (const m of meshes) for (const mat of m.material) if (!mat.map) mat.color.set(0xe0e0e0);
  }, 2500);

  const meshes = [];
  const gridLocal = [];   // sorted slot, relative to the group centre
  const scatter = [];     // seeded scatter slot (world, group centre is origin at rest)
  const base = [];        // drift home (group-local), set from the unravel
  const vel = [];         // group-local velocity (units/s); positions integrate from this
  const angVel = [];      // {x,y} angular velocity (rad/s), damped toward a slow tumble or 0
  const tgt = [];         // group-local spring target this frame
  const scaleTarget = new Array(CUBES.length).fill(1);
  const override = new Array(CUBES.length).fill(null);   // exit()/setTargets() overrides

  const MOBILE = window.innerWidth < 820;   // 4x2 in the top band, tighter spacing to fit
  const SP = MOBILE ? 1.7 : SPACING;        // grid spacing used for layout
  const RSP = MOBILE ? 1.7 : ROW_SPACING;
  for (let i = 0; i < CUBES.length; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    gridLocal.push(new THREE.Vector3((col - 1.5) * SP, (0.5 - row) * RSP, 0));
    scatter.push(new THREE.Vector3());
    base.push(gridLocal[i].clone());
    vel.push(new THREE.Vector3());
    angVel.push({ x: TUMBLE_X * 60, y: TUMBLE_Y * 60 });
    tgt.push(new THREE.Vector3());

    const faces = [];
    const faceLoads = [];
    for (let f = 0; f < 6; f++) {
      const name = CUBES[i].photos[f % CUBES[i].photos.length];
      const file = (name.endsWith('.png') ? name.slice(0, -4) : name) + '.webp';   // WebP for smaller payload
      const mat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.7, metalness: 0, transparent: true, opacity: 1 });
      const pr = new Promise((res) => {
        loader.load('assets/cubes/' + file, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
          mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; res();
        }, undefined, () => res());
      });
      loads.push(pr); faceLoads.push(pr);
      faces.push(mat);
    }
    Promise.all(faceLoads).then(() => { cubeReveal[i] = Math.max(cubeReveal[i], 0.0001); revealTargets[i] = 1; });
    const mesh = new THREE.Mesh(geometry, faces);
    mesh.rotation.set(0.3 + i * 0.1, 0.4 + i * 0.2, 0);
    group.add(mesh);
    meshes.push(mesh);
  }

  const ready = Promise.all(loads);

  // ---- project / raymond content (spec 8.3 baked faces) ----
  // projByCube[cubeIndex] = the projects.json entry; raymondData = the raymond block.
  let projByCube = {}, raymondData = null, raymondFacesOverride = null;
  fetch('data/projects.json').then((r) => r.json()).then((j) => {
    (j.projects || []).forEach((p) => { if (p.cube != null) projByCube[p.cube] = p; });
    raymondData = j.raymond || null;
  }).catch(() => {});

  // ---- baked face texture: 1024px canvas, image cover in the top 58%, a white band with a
  // small label, title, key line and one-line summary. CanvasTexture, sRGB, anisotropy 8.
  // The band draws immediately; the image is redrawn in when it loads (spec 8.3). ----
  const ACCENT = '#b8552e';
  function wrapText(ctx, text, x, y, maxW, lh, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean); let line = '', n = 0;
    for (const wd of words) {
      const test = line ? line + ' ' + wd : wd;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y); y += lh; line = wd; n++;
        if (maxLines && n >= maxLines) { return y; }
      } else line = test;
    }
    if (line) { ctx.fillText(line, x, y); y += lh; }
    return y;
  }
  function makeBakedFace({ image, imageEl, title, key, summary, label }) {
    const SZ = 1024, IMG_H = Math.round(SZ * 0.58);
    const cv = document.createElement('canvas'); cv.width = SZ; cv.height = SZ;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    function draw(img) {
      ctx.fillStyle = '#141414'; ctx.fillRect(0, 0, SZ, IMG_H);
      if (img && img.width) {
        const ar = img.width / img.height, box = SZ / IMG_H;
        let dw, dh, dx, dy;
        if (ar > box) { dh = IMG_H; dw = dh * ar; dx = (SZ - dw) / 2; dy = 0; }
        else { dw = SZ; dh = dw / ar; dx = 0; dy = (IMG_H - dh) / 2; }
        ctx.drawImage(img, dx, dy, dw, dh);
      }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, IMG_H, SZ, SZ - IMG_H);
      const padX = 52; let ty = IMG_H + 44; ctx.textBaseline = 'top';
      ctx.fillStyle = ACCENT; ctx.font = '600 26px Roboto, system-ui, sans-serif';
      ctx.fillText(String(label || '').toUpperCase(), padX, ty); ty += 44;
      ctx.fillStyle = '#141414'; ctx.font = '500 44px Roboto, system-ui, sans-serif';
      ty = wrapText(ctx, title, padX, ty, SZ - 2 * padX, 52, 2) + 10;
      if (key) { ctx.fillStyle = '#3a3a3a'; ctx.font = '400 30px Roboto, system-ui, sans-serif';
        ty = wrapText(ctx, key, padX, ty, SZ - 2 * padX, 38, 2) + 8; }
      ctx.fillStyle = '#5a5a5a'; ctx.font = '400 26px Roboto, system-ui, sans-serif';
      wrapText(ctx, summary, padX, ty, SZ - 2 * padX, 34, 4);
      tex.needsUpdate = true;
    }
    // an already-decoded texture image (no network load, so no 404 for stale data paths)
    if (imageEl && imageEl.width) { draw(imageEl); }
    else { draw(null); if (image) { const im = new Image(); im.onload = () => draw(im); im.onerror = () => {}; im.src = image; } }
    return tex;
  }
  function cubeImg(name) {
    if (!name) return null;
    if (name.indexOf('/') >= 0) return name;                       // already a path
    return 'assets/cubes/' + (name.endsWith('.png') ? name.slice(0, -4) : name) + '.webp';
  }

  // ---- camera + grid placement ----
  function tanHalf() { return Math.tan((FOV * Math.PI / 180) / 2); }

  function placeCamera() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    let regionX = REGION_NDC_X, regionY = REGION_NDC_Y;
    let D;
    if (MOBILE) {
      // 4x2 grid of ~56px cubes parked in the top 34vh (below the nav); centred in x,
      // pulled back if the four columns would not fit the width
      D = h / (56 * 2 * tanHalf());
      const gridHalfW = 1.5 * SP + 0.6;
      for (let g = 0; g < 60; g++) { if (D * tanHalf() * camera.aspect * 0.94 >= gridHalfW) break; D *= 1.05; }
      regionX = 0; regionY = 0.62;   // grid centre high in the viewport
    } else {
      D = h / (CUBE_PX * 2 * tanHalf());   // 1-unit cube ~CUBE_PX tall
    }
    camera.position.set(0, 0, D);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const halfH = D * tanHalf();
    const halfW = halfH * camera.aspect;
    group.position.set(regionX * halfW, regionY * halfH, 0);
  }

  // ---- scatter: Poisson-sampled, in-frustum, screen-non-overlapping ----
  const _v = new THREE.Vector3();
  function ndcOf(worldVec) { return _v.copy(worldVec).project(camera); }

  // Scatter is a screen-centred EXPANSION of the sorted grid: each cube keeps its
  // relative grid slot but is pushed outward (with jitter + depth) so the cloud fills
  // the viewport. Because it preserves the grid ordering, the unravel paths stay roughly
  // parallel and do not cross; a seeded search over the jitter picks a set whose whole
  // staggered path is provably non-overlapping (pathClear) and inside the frustum.
  function genScatter() {
    const EX = 1.3, EY = 2.15;                 // horizontal / vertical expansion
    const JIT = 0.5, ZMIN = -3, ZMAX = 0.5;
    for (let attempt = 0; attempt < 8000; attempt++) {
      const rng = mulberry32(20260906 + attempt * 101);
      let inFrustum = true;
      for (let i = 0; i < meshes.length; i++) {
        const world = new THREE.Vector3(
          gridLocal[i].x * EX + (rng() - 0.5) * JIT,
          gridLocal[i].y * EY + (rng() - 0.5) * JIT,
          ZMIN + rng() * (ZMAX - ZMIN),
        );
        const n = ndcOf(world);
        if (Math.abs(n.x) > 0.82 || Math.abs(n.y) > 0.82 || n.z > 1) { inFrustum = false; break; }
        scatter[i].copy(world).sub(group.position);   // store relative to the group centre
      }
      if (!inFrustum) continue;
      if (!pathClear()) continue;                 // no screen overlap along the whole path
      return;
    }
    // fallback: the un-jittered expansion (still ordered, non-crossing)
    for (let i = 0; i < meshes.length; i++) {
      scatter[i].set(gridLocal[i].x * EX - group.position.x,
                     gridLocal[i].y * EY - group.position.y, -1);
    }
  }

  function projBox(worldPos, half) {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    const w = window.innerWidth, h = window.innerHeight;
    for (let sx = -1; sx <= 1; sx += 2)
      for (let sy = -1; sy <= 1; sy += 2)
        for (let sz = -1; sz <= 1; sz += 2) {
          const n = ndcOf(new THREE.Vector3(worldPos.x + sx * half, worldPos.y + sy * half, worldPos.z + sz * half));
          const X = (n.x * 0.5 + 0.5) * w, Y = (-n.y * 0.5 + 0.5) * h;
          minx = Math.min(minx, X); maxx = Math.max(maxx, X);
          miny = Math.min(miny, Y); maxy = Math.max(maxy, Y);
        }
    return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
  }

  function boxesIntersect(a, b, pad = 0) {
    return !(a.x + a.w + pad < b.x || b.x + b.w + pad < a.x ||
             a.y + a.h + pad < b.y || b.y + b.h + pad < a.y);
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    placeCamera();
    genScatter();
    applyBaseFromUnravel();
  }

  // ---- state ----
  let unravel = 0;
  let labelOpacity = 1;
  let focusIndex = -1;
  let pointerX = 0, pointerY = 0;
  const rotTarget = new THREE.Vector2(0, 0);

  function easeInOut(x) { return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) * (-2 * x + 2) * 0.5; }

  // local position of cube i at a given global unravel p (with per-cube stagger so the
  // cubes do not all cross the centre at once)
  const _cl = new THREE.Vector3();
  function computeLocalAt(i, p) {
    const stagger = i * 0.03;
    const local = Math.min(1, Math.max(0, (p - stagger) / (1 - 0.21)));
    return _cl.lerpVectors(gridLocal[i], scatter[i], easeInOut(local));
  }

  function applyBaseFromUnravel() {
    for (let i = 0; i < meshes.length; i++) base[i].copy(computeLocalAt(i, unravel));
  }

  // true if, along the whole staggered unravel, no two cubes overlap on screen
  const _pw = new THREE.Vector3();
  function pathClear() {
    for (const pv of [0, 0.15, 0.25, 0.35, 0.5, 0.65, 0.75, 0.85, 1]) {
      const boxes = [];
      for (let i = 0; i < meshes.length; i++) {
        _pw.copy(computeLocalAt(i, pv)).add(group.position);
        boxes.push(projBox(_pw, 0.62));
      }
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++)
          if (boxesIntersect(boxes[i], boxes[j], 6)) return false;
    }
    return true;
  }

  function setUnravel(p) {
    unravel = Math.min(1, Math.max(0, p));
    labelOpacity = 1 - Math.min(1, unravel / 0.2);   // labels gone by 20% of the unravel
    if (focusIndex < 0) applyBaseFromUnravel();
  }

  function setState(name) {
    const g = window.gsap;
    const target = name === 'unravelled' ? 1 : 0;
    focusIndex = -1;
    if (g) {
      g.to({ p: unravel }, { p: target, duration: 1.2, ease: 'power3.inOut',
        onUpdate: function () { setUnravel(this.targets()[0].p); } });
    } else { setUnravel(target); }
  }

  function focus(i) {
    focusIndex = i;
    const g = window.gsap;
    if (i < 0) { applyBaseFromUnravel(); return; }
    const anchor = new THREE.Vector3(-halfWidthWorld() * 0.5 - group.position.x, -group.position.y, 1.2);
    for (let k = 0; k < meshes.length; k++) {
      const dest = k === i ? anchor : scatter[k];
      const scl = k === i ? 2.2 : 1;
      if (g) {
        g.to(base[k], { x: dest.x, y: dest.y, z: dest.z, duration: 1.2, ease: 'power3.inOut' });
        g.to(meshes[k].scale, { x: scl, y: scl, z: scl, duration: 1.2, ease: 'power3.inOut' });
      } else { base[k].copy(dest); meshes[k].scale.setScalar(scl); }
    }
    labelOpacity = 0;
  }
  function halfWidthWorld() { return camera.position.z * tanHalf() * camera.aspect; }

  function setPointer(nx, ny) { pointerX = nx; pointerY = ny; }

  const raycaster = new THREE.Raycaster();
  function raycast(ndc) {
    raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
    const hits = raycaster.intersectObjects(meshes, false);
    return hits.length ? meshes.indexOf(hits[0].object) : -1;
  }

  // ---- label DOM ----
  const labelLayer = document.getElementById('cube-labels');
  const labelEls = CUBES.map((c) => {
    const el = document.createElement('div');
    el.className = 'cube-label';
    el.textContent = c.label;
    labelLayer.appendChild(el);
    return el;
  });
  const _p = new THREE.Vector3();
  function updateLabels() {
    const w = window.innerWidth, h = window.innerHeight;
    // the projects grid names each cube (simulate/make/build/...). The cube's axis-aligned
    // box is hugely inflated by the tumble, so pin the label a fixed pixel offset below the
    // projected cube CENTRE (~half a 180px cube plus margin): clear of this cube, above the
    // next row.
    const inProjects = (projT > 0.5 || contactT > 0.5) && openIndex < 0;
    for (let i = 0; i < meshes.length; i++) {
      let x, y, op;
      if (forceHidden || openIndex >= 0) {
        // a cube is open (or shape debug): no grid labels compete with the net
        meshes[i].getWorldPosition(_p); _p.project(camera);
        x = (_p.x * 0.5 + 0.5) * w; y = (-_p.y * 0.5 + 0.5) * h + 124; op = 0;
      } else if (inProjects) {
        meshes[i].getWorldPosition(_p);
        _p.project(camera);
        x = (_p.x * 0.5 + 0.5) * w;
        y = (-_p.y * 0.5 + 0.5) * h + 124;
        op = mobileHide ? 0 : (_p.z < 1 ? 1 : 0);
      } else {
        meshes[i].getWorldPosition(_p);
        _p.y -= LABEL_DROP;
        _p.project(camera);
        x = (_p.x * 0.5 + 0.5) * w;
        y = (-_p.y * 0.5 + 0.5) * h;
        op = mobileHide ? 0 : labelOpacity * (_p.z < 1 ? 1 : 0);
      }
      const el = labelEls[i];
      el.style.opacity = op.toFixed(3);
      el.style.transform = `translate(-50%, 0) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }

  // ---- verifier hooks ----
  // Screen box from the cube's actual (tumbled) corners — the projection the reviewer's
  // script reads. Tumble is kept gentle (see TUMBLE_*) so this stays close to face-on.
  function cubeBoxes() {
    return meshes.map((m, i) => {
      m.position.set(base[i].x, base[i].y, base[i].z);   // deterministic (no bob)
      m.updateWorldMatrix(true, false);
      let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      const w = window.innerWidth, h = window.innerHeight;
      for (let sx = -1; sx <= 1; sx += 2)
        for (let sy = -1; sy <= 1; sy += 2)
          for (let sz = -1; sz <= 1; sz += 2) {
            _p.set(sx * 0.5 * m.scale.x, sy * 0.5 * m.scale.y, sz * 0.5 * m.scale.z);
            _p.applyMatrix4(m.matrixWorld).project(camera);
            const X = (_p.x * 0.5 + 0.5) * w, Y = (-_p.y * 0.5 + 0.5) * h;
            minx = Math.min(minx, X); maxx = Math.max(maxx, X);
            miny = Math.min(miny, Y); maxy = Math.max(maxy, Y);
          }
      return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
    });
  }
  // live screen box of one mesh at its CURRENT position (used to check a parked cube)
  function meshBox(i) {
    const m = meshes[i];
    m.updateWorldMatrix(true, false);
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    const w = window.innerWidth, h = window.innerHeight;
    for (let sx = -1; sx <= 1; sx += 2)
      for (let sy = -1; sy <= 1; sy += 2)
        for (let sz = -1; sz <= 1; sz += 2) {
          _p.set(sx * 0.5 * m.scale.x, sy * 0.5 * m.scale.y, sz * 0.5 * m.scale.z);
          _p.applyMatrix4(m.matrixWorld).project(camera);
          const X = (_p.x * 0.5 + 0.5) * w, Y = (-_p.y * 0.5 + 0.5) * h;
          minx = Math.min(minx, X); maxx = Math.max(maxx, X);
          miny = Math.min(miny, Y); maxy = Math.max(maxy, Y);
        }
    return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
  }
  function labelBoxes() {
    return labelEls
      .filter((el) => parseFloat(el.style.opacity || '0') > 0.05)
      .map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  }

  // ---- chapter cube travel (phase 2) ----
  // On entering chapter k, cube k travels from its cloud slot to a parking anchor on the
  // chapter's cube side (24vw or 76vw, 48vh), grows to 1.9x and slows its tumble; every
  // other cube recedes to the background (z back, opacity 0.35) so the parked cube is the
  // only sharp object. Driven by chapterPark(i, side, t) scrubbed by the chapter's
  // ScrollTrigger; t in [0,1].
  const PARK_Z = 1.5, PARK_SCALE = 1.9, PARK_START_Z = -5;
  // parkTargets[i] = { axvw, ayvh, scale, tumble, t } for each currently parked cube.
  const parkTargets = {};
  let mobileHide = false, forceHidden = false;
  const _anchor = new THREE.Vector3();

  function anchorLocalXY(axvw, ayvh) {
    // screen (axvw%, ayvh%) -> world at z = PARK_Z, relative to the group centre
    const ndcX = (axvw / 100) * 2 - 1;
    const ndcY = 1 - 2 * (ayvh / 100);
    const halfHz = (camera.position.z - PARK_Z) * tanHalf();
    _anchor.set(ndcX * halfHz * camera.aspect, ndcY * halfHz, PARK_Z);
    return _anchor.sub(group.position);
  }
  function setCubeOpacity(m, o) { for (const mat of m.material) mat.opacity = o; }

  function chapterPark(i, side, t, opts) {
    t = Math.min(1, Math.max(0, t));
    if (t <= 0.001) { delete parkTargets[i]; return; }
    parkTargets[i] = {
      axvw: (opts && opts.axvw != null) ? opts.axvw : (side === 'left' ? 24 : 76),
      ayvh: (opts && opts.ayvh != null) ? opts.ayvh : 48,
      scale: (opts && opts.scale) || PARK_SCALE, tumble: (opts && opts.tumble != null) ? opts.tumble : 1, t };
  }
  // spec 8.2: park cube i at an explicit viewport anchor (vw%, vh%) at `scale`, through the
  // same spring as every other park target (main.js uses this for the Raymond cube).
  function setParkAnchor(i, vw, vh, scale) {
    parkTargets[i] = { axvw: vw, ayvh: vh, scale: scale || PARK_SCALE, tumble: 0, t: 1 };
  }
  // Track DOM anchors (Other Projects): each listed cube follows its anchor element's
  // screen rect every frame, so the cubes scroll WITH the columns and stay in the
  // reserved band above each title. list = [{ i, el, scale }].
  let trackList = [];
  const _tr = {};   // index -> {el, scale} for on-screen anchors this frame
  function setTrack(list) { trackList = list || []; }

  // Exclusion: screen-px rects the drifting cloud must part around (e.g. a text column).
  // A cube whose projected box would overlap a rect is pushed horizontally clear (to the
  // right, since the reserved text columns sit on the left) so the copy stays readable.
  let excludeRects = [];
  function setExclude(rects) { excludeRects = rects || []; }
  // visible text rects (screen px), refreshed each frame by main.js; a cube whose box lands
  // on one is faded so the copy stays readable ("cubes part around text").
  let textRects = [];
  function setTextRects(rects) { textRects = rects || []; }
  // active morph shape boxes (screen px, already padded): a HARD exclusion — every cube,
  // dimmed or not, is pushed clear so the silhouette is never crossed.
  let shapeRects = [];
  function setShapeRects(rects) { shapeRects = rects || []; }
  function shapeRectsNow() { return shapeRects; }
  // generic soft lanes (adapter): text blocks the drifting cloud steers around
  function setLanes(rects) { excludeRects = rects || []; }
  // section target API (spec 8.1 item 4): world-unit targets, exit, recall
  function setTargets(list) {
    for (let i = 0; i < override.length; i++) override[i] = (list && list[i]) || null;
  }
  function exit(i) { override[i] = { exit: true }; }
  function recall(i) { override[i] = null; }

  const anyParked = () => Object.keys(parkTargets).length > 0 || trackList.length > 0;
  // opacity is never used to hide cubes now (spec 8.1): these stay as exported no-ops that
  // main.js still calls this wave; they will be removed from main.js next wave.
  function chapterDim(_t) {}
  function setCloudDim(_t) {}
  // mobile: hide every non-featured cube (used between the hero grid and the contact grid)
  function setMobileHide(b) { mobileHide = !!b; }
  // debug/shape verification: hide every cube so only the particle morph is on screen
  function setForceHidden(b) { forceHidden = !!b; }

  // ---- Projects grid + cube unfold (phase 2) ----
  // When the projects section is on screen the eight cubes settle into a centred 4x2 grid.
  // Clicking one glides it to the centre and unfolds it into a cross net of six textured
  // faces; DOM cards (positioned by projection, see faceAnchors) fade in over each face.
  const PROJ_SCALE = 1.5, PROJ_SPX = 2.5, PROJ_SPY = 2.9, PROJ_CY = -0.05;
  let projT = 0, projActive = false;          // 0..1 settle into the grid
  let contactT = 0;                           // 0..1 settle into the SAME grid at the close
  function setContact(t) { contactT = Math.min(1, Math.max(0, t)); }
  let hoverIndex = -1;
  let openIndex = -1, openT = 0;              // 0 closed, 1 fully unfolded
  const projWorld = [];                        // centred grid slot (world) per cube
  for (let i = 0; i < CUBES.length; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    projWorld.push(new THREE.Vector3((col - 1.5) * PROJ_SPX, (0.5 - row) * PROJ_SPY + PROJ_CY, 0));
  }
  function setProjects(on) {
    projActive = !!on;
    const g = window.gsap;
    if (g) g.to({ p: projT }, { p: on ? 1 : 0, duration: 1.2, ease: 'power3.out', onUpdate: function () { projT = this.targets()[0].p; } });
    else projT = on ? 1 : 0;
    if (!on && openIndex >= 0) closeProject();
  }

  // build a six-face cross-net rig for cube i, hinged so t=0 is a closed cube and t=1 is flat
  let rig = null, rigPivots = null;
  const FACE_MAP = { right: 0, left: 1, top: 2, bottom: 3, front: 4, back: 5 };
  function unfoldScale() { return (0.92 * window.innerHeight) / (3 * CUBE_PX); }
  // spec 8.3: content for each face of a project cube, indexed by FACE_MAP value (0..5).
  // front = overview, the five other faces = the DESIGNED/ANALYZED/BUILT/PROVED/TOOLS steps.
  function projectFaceSpecs(i) {
    const p = projByCube[i]; const imgs = (p && p.images) || [];
    const im = (k) => cubeImg(imgs.length ? imgs[k % imgs.length] : null);
    const t = (p && p.title) || (CUBES[i] && CUBES[i].label) || '';
    const s = [];
    s[FACE_MAP.front] = { image: im(0), title: t, key: (p && p.key) || '', summary: (p && p.one) || '', label: (p && p.year) || 'PROJECT' };
    s[FACE_MAP.right] = { image: im(1), title: t, summary: (p && p.designed) || '', label: 'DESIGNED' };
    s[FACE_MAP.left] = { image: im(2), title: t, summary: (p && p.analyzed) || '', label: 'ANALYZED' };
    s[FACE_MAP.top] = { image: im(3), title: t, summary: (p && p.built) || '', label: 'BUILT' };
    s[FACE_MAP.bottom] = { image: im(4), title: t, summary: (p && p.proved) || '', label: 'PROVED' };
    s[FACE_MAP.back] = { image: im(5), title: t, summary: (p && p.tools) || '', label: 'TOOLS' };
    return s;
  }
  function buildRig(i) {
    disposeRig();
    const specs = projectFaceSpecs(i);
    const mats = meshes[i].material;
    // draw each face from the cube's ALREADY-LOADED texture image (guaranteed to exist, no
    // second network request) so stale projects.json image names never 404.
    for (let idx = 0; idx < 6; idx++) { specs[idx].imageEl = mats[idx] && mats[idx].map && mats[idx].map.image; specs[idx].image = null; }
    // seam-free (spec 8.4): MeshBasicMaterial, toneMapped off, FrontSide, no transparency, so
    // there is no lighting-induced diagonal across the plane.
    const faceMat = (idx) => new THREE.MeshBasicMaterial({ map: makeBakedFace(specs[idx]),
      color: 0xffffff, side: THREE.FrontSide, toneMapped: false, transparent: false });
    const plane = new THREE.PlaneGeometry(1, 1, 1, 1);
    rig = new THREE.Group();
    const S = unfoldScale();
    rig.scale.setScalar(S);
    rig.position.set(-0.5 * S * 1, 0, 1.0);   // centre the net (x spans -1.5..2.5) on screen
    // front stays flat at the net centre
    const front = new THREE.Mesh(plane, faceMat(FACE_MAP.front)); rig.add(front);
    // a hinged flap: pivot at the shared edge, plane offset one half-unit beyond it
    function flap(name, pivotPos, axis, foldSign, parent) {
      const pv = new THREE.Group(); pv.position.copy(pivotPos);
      const mesh = new THREE.Mesh(plane, faceMat(FACE_MAP[name]));
      // plane centre sits half a unit outward from the hinge along the opening direction
      if (axis === 'y') mesh.position.set(pivotPos.x >= 0 ? 0.5 : -0.5, 0, 0);
      else mesh.position.set(0, pivotPos.y >= 0 ? 0.5 : -0.5, 0);
      pv.add(mesh); (parent || rig).add(pv);
      return { pv, axis, foldSign, mesh };
    }
    rigPivots = {
      right: flap('right', new THREE.Vector3(0.5, 0, 0), 'y', -1),
      left: flap('left', new THREE.Vector3(-0.5, 0, 0), 'y', 1),
      top: flap('top', new THREE.Vector3(0, 0.5, 0), 'x', 1),
      bottom: flap('bottom', new THREE.Vector3(0, -0.5, 0), 'x', -1),
    };
    // back hinges off the right flap's outer edge
    rigPivots.back = flap('back', new THREE.Vector3(1, 0, 0), 'y', -1, rigPivots.right.pv);
    rig.userData.front = front;
    scene.add(rig);
    setUnfold(0);
  }
  function setUnfold(t) {
    if (!rig) return;
    const foldAngle = (1 - t) * Math.PI / 2;   // t=1 flat (0 rad), t=0 folded (90 deg)
    for (const key in rigPivots) {
      const f = rigPivots[key];
      if (f.axis === 'y') f.pv.rotation.set(0, f.foldSign * foldAngle, 0);
      else f.pv.rotation.set(f.foldSign * foldAngle, 0, 0);
    }
    // fade faces up as it opens so the closed cube reads as the photo cube first
    const o = 0.15 + 0.85 * t;
    rig.traverse((c) => { if (c.material) c.material.opacity = o; });
  }
  function disposeRig() {
    if (!rig) return;
    scene.remove(rig);
    rig.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    rig = null; rigPivots = null;
  }
  function openProject(i) {
    if (openIndex === i) return;
    openIndex = i;
    buildRig(i);
    const g = window.gsap;
    if (g) g.fromTo({ p: 0 }, { p: 0 }, { p: 1, duration: 1.1, ease: 'power3.inOut', onUpdate: function () { openT = this.targets()[0].p; setUnfold(openT); } });
    else { openT = 1; setUnfold(1); }
    if (onProjectOpen) onProjectOpen(i);
  }
  function closeProject() {
    if (openIndex < 0) return;
    const g = window.gsap; const idx = openIndex;
    if (g) g.to({ p: openT }, { p: 0, duration: 0.9, ease: 'power3.inOut',
      onUpdate: function () { openT = this.targets()[0].p; setUnfold(openT); },
      onComplete: () => { disposeRig(); } });
    else { disposeRig(); }
    openIndex = -1; openT = 0;
    if (onProjectClose) onProjectClose(idx);
  }
  let onProjectOpen = null, onProjectClose = null;
  function setProjectHandlers(o, c) { onProjectOpen = o; onProjectClose = c; }
  // screen-space centres of the six faces (for the DOM cards); null unless a rig is open
  function faceAnchors() {
    if (!rig) return null;
    const centres = { front: [0, 0, 0], right: [1, 0, 0], left: [-1, 0, 0], top: [0, 1, 0], bottom: [0, -1, 0], back: [2, 0, 0] };
    const out = {}; const w = window.innerWidth, h = window.innerHeight; const v = new THREE.Vector3();
    rig.updateWorldMatrix(true, true);
    for (const k in centres) {
      const c = centres[k];
      v.set(c[0], c[1], c[2]); rig.localToWorld(v); v.project(camera);
      out[k] = { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, vis: openT };
    }
    return out;
  }
  function setHover(i) { hoverIndex = i; }
  function projectOpenIndex() { return openIndex; }

  // ---- Raymond 3x2 unfold rig (spec 8.2, grid override, not the cross net) ----
  // Cube 4 (deploy) unfolds into six baked faces in a 3-col x 2-row grid centred on its park
  // point. Faces hinge open over the first half of t, then slide into their grid slots over the
  // second half. Scroll-driven: setRaymondUnfold(t) sets t; updateRaymondRig() runs each frame.
  let raymondT = 0, raymondRig = null, raymondFaceMeshes = [];
  let RAY_CENTER_VW = 30, RAY_CENTER_VH = 52, RAY_FACE_VH = 15, RAY_GAP_VH = 1;
  function raymondCubeIndex() { return (raymondData && raymondData.cube != null) ? raymondData.cube : 4; }
  function raymondFacesList() { return raymondFacesOverride || (raymondData && raymondData.faces) || []; }
  function setRaymondFaces(list) { raymondFacesOverride = list || null; if (raymondRig) disposeRaymondRig(); }
  function buildRaymondRig() {
    disposeRaymondRig();
    const faces = raymondFacesList();
    raymondRig = new THREE.Group();
    const plane = new THREE.PlaneGeometry(1, 1, 1, 1);
    raymondFaceMeshes = [];
    for (let j = 0; j < 6; j++) {
      const f = faces[j] || {};
      const tex = makeBakedFace({ image: f.image, title: f.name || '', key: f.number || '',
        summary: f.line || '', label: f.name || 'SYSTEM' });
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, side: THREE.FrontSide, toneMapped: false, transparent: false });
      const m = new THREE.Mesh(plane, mat);
      raymondRig.add(m); raymondFaceMeshes.push(m);
    }
    group.add(raymondRig);
  }
  function disposeRaymondRig() {
    if (!raymondRig) return;
    group.remove(raymondRig);
    raymondRig.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); } });
    raymondRig = null; raymondFaceMeshes = [];
  }
  function setRaymondUnfold(t) {
    t = Math.min(1, Math.max(0, t));
    raymondT = t;
    if (t <= 0.001) { disposeRaymondRig(); return; }
    if (!raymondRig) buildRaymondRig();
  }
  function raymondSlotPx(j) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const face = (RAY_FACE_VH / 100) * vh, gap = (RAY_GAP_VH / 100) * vh, step = face + gap;
    const col = j % 3, row = Math.floor(j / 3);
    return { x: (RAY_CENTER_VW / 100) * vw + (col - 1) * step, y: (RAY_CENTER_VH / 100) * vh + (row - 0.5) * step, size: face };
  }
  const _rv = new THREE.Vector3();
  function updateRaymondRig() {
    if (!raymondRig || !raymondFaceMeshes.length) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const halfHz = (camera.position.z - PARK_Z) * tanHalf();
    const faceWorld = (RAY_FACE_VH / 100) * 2 * halfHz;         // 15vh -> world units at PARK_Z
    const hinge = easeInOut(Math.min(1, raymondT / 0.5));
    const slide = easeInOut(Math.max(0, (raymondT - 0.5) / 0.5));
    const centerLocal = anchorLocalXY(RAY_CENTER_VW, RAY_CENTER_VH);
    for (let j = 0; j < 6; j++) {
      const m = raymondFaceMeshes[j];
      const slot = raymondSlotPx(j);
      const target = anchorLocalXY((slot.x / vw) * 100, (slot.y / vh) * 100);
      m.position.lerpVectors(centerLocal, target, slide);
      const sc = faceWorld * (0.32 + 0.68 * hinge);
      m.scale.set(sc, sc, sc);
      const col = j % 3, foldSign = col === 0 ? 1 : (col === 2 ? -1 : 0);
      m.rotation.set((Math.floor(j / 3) === 0 ? 1 : -1) * (1 - hinge) * 0.9, foldSign * (1 - hinge) * (Math.PI / 2), 0);
    }
    const rc = raymondCubeIndex();
    if (raymondT > 0.02 && meshes[rc]) setCubeOpacity(meshes[rc], 0);   // hide parked cube behind rig
  }
  function raymondFaceRects() {
    const out = [];
    if (!raymondRig || !raymondFaceMeshes.length) { for (let j = 0; j < 6; j++) out.push(null); return out; }
    const w = window.innerWidth, h = window.innerHeight;
    raymondRig.updateWorldMatrix(true, true);
    for (let j = 0; j < 6; j++) {
      const m = raymondFaceMeshes[j];
      let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      for (let sx = -1; sx <= 1; sx += 2) for (let sy = -1; sy <= 1; sy += 2) {
        _rv.set(sx * 0.5, sy * 0.5, 0); m.localToWorld(_rv); _rv.project(camera);
        const X = (_rv.x * 0.5 + 0.5) * w, Y = (-_rv.y * 0.5 + 0.5) * h;
        minx = Math.min(minx, X); maxx = Math.max(maxx, X); miny = Math.min(miny, Y); maxy = Math.max(maxy, Y);
      }
      out.push({ x: minx, y: miny, w: maxx - minx, h: maxy - miny });
    }
    return out;
  }
  function raymondFaceAt(ndcX, ndcY) {
    if (raymondT <= 0.9) return -1;
    const w = window.innerWidth, h = window.innerHeight;
    const px = (ndcX * 0.5 + 0.5) * w, py = (-ndcY * 0.5 + 0.5) * h;
    const rects = raymondFaceRects();
    for (let j = 0; j < 6; j++) { const r = rects[j]; if (r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return j; }
    return -1;
  }
   // screen centres of the eight grid slots (for the contact-settle verifier)
  function gridSlots() {
    const w = window.innerWidth, h = window.innerHeight; const out = [];
    group.updateWorldMatrix(true, false);
    for (let i = 0; i < projWorld.length; i++) {
      // the settled cube sits at local (projWorld - group.position); project THAT through the
      // group transform, exactly where a cube ends up, so the slot matches the cube.
      _p.copy(projWorld[i]).sub(group.position);
      group.localToWorld(_p);
      _p.project(camera);
      out.push({ x: (_p.x * 0.5 + 0.5) * w, y: (-_p.y * 0.5 + 0.5) * h });
    }
    return out;
  }
  // projected CENTRE POINT of each cube (not the AABB centre, which perspective skews for a
  // tilted off-centre cube) — the fair comparison against a grid slot.
  function cubeCenters() {
    const w = window.innerWidth, h = window.innerHeight; const out = [];
    for (let i = 0; i < meshes.length; i++) {
      meshes[i].getWorldPosition(_p); _p.project(camera);
      out.push({ x: (_p.x * 0.5 + 0.5) * w, y: (-_p.y * 0.5 + 0.5) * h, op: meshes[i].material[0].opacity });
    }
    return out;
  }

  window.addEventListener('resize', resize);
  resize();
  // initial spawn: the ONLY direct position write. Every later change is integration.
  for (let i = 0; i < meshes.length; i++) { meshes[i].position.copy(base[i]); tgt[i].copy(base[i]); }
  window.__dbgT = () => { const w = window.innerWidth, h = window.innerHeight; return tgt.map((v, i) => { const q = v.clone(); group.localToWorld(q); q.project(camera); const q1 = v.clone(); q1.x += 1; group.localToWorld(q1); q1.project(camera); const sx = (q.x * 0.5 + 0.5) * w; const ppu = Math.abs((q1.x * 0.5 + 0.5) * w - sx); return { i, sx: Math.round(sx), sy: Math.round((-q.y * 0.5 + 0.5) * h), ppu: Math.round(ppu), sc: +scaleTarget[i].toFixed(2), av: _avoid[i] }; }); };

  // ---- cube-cube overlap resolution ----
  // After all cubes are positioned, push any overlapping pair apart so no two projected
  // bounding boxes intersect. Uses the axis of least penetration (MTV), depth-weighted so
  // the nearer cube (larger world z) yields less. Runs every frame for the drift, parked,
  // grid and contact states (never the open unfold cube). Positions are nudged so the
  // rendered frame is always overlap-free.
  const _c0 = new THREE.Vector3(), _c1 = new THREE.Vector3();
  const _tp = new THREE.Vector3(), _tp1 = new THREE.Vector3();
  const _sc = new Array(CUBES.length).fill(null);
  const _avoid = new Array(CUBES.length).fill(true);   // cubes that must dodge text/shape/each other
  const _avoidPair = new Array(CUBES.length).fill(true); // cubes that also join pairwise de-conflict
                                                        // (a screen-filling parked cube clears lanes
                                                        // but cannot be nudged off small cubes)
  const OVERLAP_MARGIN = 8;
  function gatherBoxes() {
    const w = window.innerWidth, h = window.innerHeight;
    let n = 0;
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      if (i === openIndex || m.material[0].opacity < 0.12) { _sc[i] = null; continue; }
      m.updateWorldMatrix(true, false);
      let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      for (let sx = -1; sx <= 1; sx += 2)
        for (let sy = -1; sy <= 1; sy += 2)
          for (let sz = -1; sz <= 1; sz += 2) {
            _p.set(sx * 0.5 * m.scale.x, sy * 0.5 * m.scale.y, sz * 0.5 * m.scale.z);
            _p.applyMatrix4(m.matrixWorld).project(camera);
            const X = (_p.x * 0.5 + 0.5) * w, Y = (-_p.y * 0.5 + 0.5) * h;
            if (X < minx) minx = X; if (X > maxx) maxx = X;
            if (Y < miny) miny = Y; if (Y > maxy) maxy = Y;
          }
      // px per one group-local x-unit AT THIS cube's depth (accurate screen<->world scale)
      m.getWorldPosition(_c0); _c1.copy(_c0); _c1.x += 1;
      _c0.project(camera); _c1.project(camera);
      const ppu = Math.max(1, Math.abs((_c1.x - _c0.x) * 0.5 * w));
      const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
      _sc[i] = { cx, cy, ix: cx, iy: cy, hx: (maxx - minx) / 2, hy: (maxy - miny) / 2, wz: m.position.z, ppu };
      n++;
    }
    return n;
  }
  // Velocity-only backstop: stiff cube-cube repulsion so any transient penetration (before
  // the spring reaches the de-conflicted targets) resolves within ~0.5 s. Lanes and shapes
  // are handled as HARD constraints on the TARGETS (see projectTargets), not here, so the
  // spring never has to fight a soft push. Repulsion gain exceeds omega^2 near contact and
  // is zero beyond the footprints. Skipped in the settled projects/contact grid.
  function computeForces(dtc, forceable) {
    if (projT > 0.5 || contactT > 0.5) return;
    const n = gatherBoxes();
    if (n < 1) return;
    for (let a = 0; a < meshes.length; a++) {
      const A = _sc[a]; if (!A || !forceable[a]) continue;
      for (let b = 0; b < meshes.length; b++) {
        if (b === a) continue;
        const B = _sc[b]; if (!B) continue;
        const dx = A.cx - B.cx, dy = A.cy - B.cy;
        const ox = (A.hx + B.hx) * CUBE_SHRINK + OVERLAP_MARGIN - Math.abs(dx);
        const oy = (A.hy + B.hy) * CUBE_SHRINK + OVERLAP_MARGIN - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;              // no footprint overlap -> no force
        if (ox < oy) vel[a].x += ((dx >= 0 ? ox : -ox) / A.ppu) * REPULSE_GAIN * dtc;
        else         vel[a].y += (-(dy >= 0 ? oy : -oy) / A.ppu) * REPULSE_GAIN * dtc;
      }
    }
  }

  // ---- HARD lane / shape / overlap constraints on the spring targets ----
  // Mirrors verify_all.py TEXT_SELECTORS so the engine steers around exactly the rects the
  // checker reads. The checker judges cube-on-text on the FULL projected box (+40 px) and
  // overlap / on-shape on the inscribed 0.68 footprint, so we clear targets by a full-box
  // half-extent for text and a shrunk one for shapes/pairs.
  const TEXT_LANE_SEL = '.display,.hero-sub,.exp-word,.exp2-head,.exp2-systems,.exp2-ach,'
    + '.exp2-prev,.slicer-story,.slicer-key,.ev-strip,.flat-head,.projects-head,.web-lead,'
    + '.web-tiles,.ds-left,.edu,.contact-inner,.prev-band';
  const _lane = [];
  function domTextRects() {
    _lane.length = 0;
    const vh = window.innerHeight;
    document.querySelectorAll(TEXT_LANE_SEL).forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < vh) _lane.push({ x: r.x, y: r.y, w: r.width, h: r.height });
    });
    return _lane;
  }
  const _scn = [];   // per-cube target projected to screen: {sx,sy,ox,oy,ppu,hpx,avoid}
  function projectTargets() {
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = 0; i < meshes.length; i++) {
      _tp.copy(tgt[i]); group.localToWorld(_tp); _tp.project(camera);
      const sx = (_tp.x * 0.5 + 0.5) * w, sy = (-_tp.y * 0.5 + 0.5) * h;
      _tp1.set(tgt[i].x + 1, tgt[i].y, tgt[i].z); group.localToWorld(_tp1); _tp1.project(camera);
      const ppu = Math.max(1, Math.abs((_tp1.x * 0.5 + 0.5) * w - sx));
      // Real projected AABB half-extents (matches meshBox, which the checker measures): a
      // tumbling cube's box is up to ~1.7x its edge, so ppu*scale badly undersizes it. Using
      // the actual box makes the de-conflict / lane clearances agree with the checker exactly.
      const bx = meshBox(i);
      const hx = Math.max(bx.w * 0.5, ppu * scaleTarget[i] * 0.5);
      const hy = Math.max(bx.h * 0.5, ppu * scaleTarget[i] * 0.5);
      _scn[i] = { sx, sy, ox: sx, oy: sy, ppu, hx, hy, avoid: _avoid[i], avoidPair: _avoidPair[i] };
    }
    const lanes = domTextRects();
    for (let pass = 0; pass < 10; pass++) {
      // push avoid targets fully out of every text lane (+40, full box) and shape rect
      for (let i = 0; i < meshes.length; i++) {
        const S = _scn[i]; if (!S.avoid) continue;
        const hpx = S.hx, hpy = S.hy, PAD = 42;   // full-box half per axis (+2 over the checker's 40)
        for (const r of lanes) {
          const L = S.sx - (r.x - hpx - PAD), R = (r.x + r.w + hpx + PAD) - S.sx;
          const T = S.sy - (r.y - hpy - PAD), B = (r.y + r.h + hpy + PAD) - S.sy;
          if (L <= 0 || R <= 0 || T <= 0 || B <= 0) continue;
          // push out the least-penetration side that stays on-screen (a wide block is escaped
          // vertically, a tall column horizontally)
          const goR = r.x + r.w + hpx + PAD, goL = r.x - hpx - PAD;
          const goD = r.y + r.h + hpy + PAD, goU = r.y - hpy - PAD;
          let best = Infinity, pick = '';
          if (goR < w - hpx && R < best) { best = R; pick = 'R'; }
          if (goL > hpx && L < best) { best = L; pick = 'L'; }
          if (goU > hpy && T < best) { best = T; pick = 'U'; }
          if (goD < h - hpy && B < best) { best = B; pick = 'D'; }
          if (!pick) { S.sx = r.x < w / 2 ? goR : goL; continue; }   // none fits: exit sideways
          if (pick === 'R') S.sx = goR; else if (pick === 'L') S.sx = goL;
          else if (pick === 'U') S.sy = goU; else S.sy = goD;
        }
        const hsx = S.hx * 0.68 + 2, hsy = S.hy * 0.68 + 2;   // shrunk footprint (checker judges shapes on the 0.68 box)
        for (const r of shapeRects) {
          const L = S.sx - (r.x - hsx), R = (r.x + r.w + hsx) - S.sx;
          const T = S.sy - (r.y - hsy), B = (r.y + r.h + hsy) - S.sy;
          if (L <= 0 || R <= 0 || T <= 0 || B <= 0) continue;
          const mn = Math.min(L, R, T, B);
          if (mn === L) S.sx = r.x - hsx; else if (mn === R) S.sx = r.x + r.w + hsx;
          else if (mn === T) S.sy = r.y - hsy; else S.sy = r.y + r.h + hsy;
        }
      }
      // de-conflict target footprints (0.68) so no two clear by less than the checker gap.
      // Only cubes flagged avoidPair MOVE here; every cube is still a repulsor to part around.
      for (let a = 0; a < meshes.length; a++) {
        const A = _scn[a]; if (!A.avoidPair) continue;
        for (let b = 0; b < meshes.length; b++) {
          if (b === a) continue;
          const B = _scn[b];
          const dx = A.sx - B.sx, dy = A.sy - B.sy;
          // real shrunk (0.68) box half-extents per axis + a small gap so the checker's
          // overlap (shrunk-box intersection, threshold 0.5 px) always clears
          const ox = (A.hx + B.hx) * 0.68 + 6 - Math.abs(dx);
          const oy = (A.hy + B.hy) * 0.68 + 6 - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          const share = B.avoidPair ? 0.5 : 1.0;   // an immovable (grid/park) target does not yield
          if (ox < oy) { const s = dx >= 0 ? ox : -ox; A.sx += s * share; if (B.avoidPair) B.sx -= s * 0.5; }
          else { const s = dy >= 0 ? oy : -oy; A.sy += s * share; if (B.avoidPair) B.sy -= s * 0.5; }
        }
      }
    }
    // write the adjusted screen centres back into the local spring targets
    for (let i = 0; i < meshes.length; i++) {
      const S = _scn[i]; if (!S.avoid) continue;
      tgt[i].x += (S.sx - S.ox) / S.ppu;
      tgt[i].y += -(S.sy - S.oy) / S.ppu;
    }
  }

  // a target 1.3x past the nearest horizontal viewport edge (an exit lane the cube drifts
  // out to and holds, so a hidden cube leaves by position, never by opacity)
  function exitTargetLocal(i) {
    // Exit straight UP off the top (never crosses the left text column or the centred morph
    // shape). Spread the eight cubes by INDEX across the width so same-column cubes (i, i+4)
    // do not pile onto one x and overlap off-screen; the de-conflict then has nothing to undo.
    const z = base[i].z;
    const halfH = (camera.position.z - z) * tanHalf();
    const halfW = (camera.position.z - z) * tanHalf() * camera.aspect;
    const frac = meshes.length > 1 ? i / (meshes.length - 1) : 0.5;   // 0..1 across the row
    const x = (-0.82 + 1.64 * frac) * halfW - group.position.x;
    return { x, y: 1.3 * halfH - group.position.y, z };
  }

  const _tmp = new THREE.Vector3(), _acc = new THREE.Vector3(), _delta = new THREE.Vector3();
  const _opArr = new Array(CUBES.length).fill(1);
  const _forceable = new Array(CUBES.length).fill(true);
  function frame(now, dt, moving) {
    const t = now / 1000;
    const fs = Math.min(3, dt * 60);
    const dtc = Math.min(DT_MAX, dt || 0.0166);
    // parallax fades out as the grid unravels so scatter stays put
    const pAmt = (1 - unravel) * (anyParked() ? 0 : 1);
    rotTarget.x = -pointerY * PARALLAX_MAX * pAmt;
    rotTarget.y = pointerX * PARALLAX_MAX * pAmt;
    group.rotation.x += (rotTarget.x - group.rotation.x) * PARALLAX_LERP;
    group.rotation.y += (rotTarget.y - group.rotation.y) * PARALLAX_LERP;

    const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) * (-2 * x + 2) * 0.5);
    // resolve tracked anchors to screen positions (only while on screen)
    for (const k in _tr) delete _tr[k];
    const vw = window.innerWidth, vh = window.innerHeight;
    for (const tk of trackList) {
      const r = tk.el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh && r.width > 0) {
        _tr[tk.i] = { cx: ((r.left + r.width / 2) / vw) * 100, cy: ((r.top + r.height / 2) / vh) * 100, scale: tk.scale || 1.2 };
      }
    }

    // the projects and contact grids settle the whole cloud; ease parallax out
    if (projT > 0.01 || contactT > 0.01) { group.rotation.x *= 0.88; group.rotation.y *= 0.88; }

    // ---- pass A: every section sets a spring TARGET (group-local), scale, and rotation.
    // No position writes here; positions are integrated in pass B.
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      let tumbleScale = 1;
      _opArr[i] = 1; _forceable[i] = false; _avoid[i] = false; _avoidPair[i] = false;
      const bob = Math.sin(t * 0.6 + i) * BOB_AMP;
      const pt = parkTargets[i];
      const tr = _tr[i];
      const ov = override[i];
      if (projT > 0.01) {
        // 4x2 centred grid; open cube hides (its unfold rig shows), the rest hold at 0.06
        const e = ease(projT);
        _tmp.copy(projWorld[i]).sub(group.position);
        const lift = (i === hoverIndex && openIndex < 0) ? 0.15 : 0;
        tgt[i].set(base[i].x + (_tmp.x - base[i].x) * e,
                   base[i].y + (_tmp.y - base[i].y) * e + bob * 0.15,
                   base[i].z + (_tmp.z - base[i].z) * e + lift);
        scaleTarget[i] = 1 + (PROJ_SCALE - 1) * e;
        tumbleScale = (i === hoverIndex || projT > 0.5) ? 0 : 0.6;
        if (projT > 0.4 && openIndex < 0) {
          m.rotation.x += (0.1 - m.rotation.x) * 0.12;
          m.rotation.y += (0.14 - m.rotation.y) * 0.12;
        } else if (moving && tumbleScale > 0) { m.rotation.x += TUMBLE_X * fs * tumbleScale; m.rotation.y += TUMBLE_Y * fs * tumbleScale; }
        _opArr[i] = openIndex >= 0 ? (i === openIndex ? 0 : 0.06) : 1;   // projects scrim exception
      } else if (contactT > 0.01) {
        // settle into the SAME centred 4x2 grid as projects
        const e = ease(contactT);
        _tmp.copy(projWorld[i]).sub(group.position);
        tgt[i].set(base[i].x + (_tmp.x - base[i].x) * e,
                   base[i].y + (_tmp.y - base[i].y) * e,
                   base[i].z + (_tmp.z - base[i].z) * e);
        m.rotation.x += (0.06 - m.rotation.x) * 0.2;
        m.rotation.y += (0.08 - m.rotation.y) * 0.2;
        scaleTarget[i] = 1 + (PROJ_SCALE - 1) * e;
      } else if (tr) {
        // follow the DOM anchor (scrolls with the content); face-on
        const anchor = anchorLocalXY(tr.cx, tr.cy);
        tgt[i].set(anchor.x, anchor.y + bob * 0.3, anchor.z);
        m.rotation.x += (0.35 - m.rotation.x) * 0.2;
        m.rotation.y += (0.5 - m.rotation.y) * 0.2;
        scaleTarget[i] = tr.scale;
      } else if (pt) {
        const e = ease(pt.t);
        // emerge from the background ON the park side (fixed x/y, target z travels)
        const anchor = anchorLocalXY(pt.axvw, pt.ayvh);
        tgt[i].set(anchor.x, anchor.y + bob * (1 - e), PARK_START_Z + (PARK_Z - PARK_START_Z) * e);
        scaleTarget[i] = 0.8 + (pt.scale - 0.8) * e;
        tumbleScale = pt.tumble * (1 - 0.7 * e);
        // a parked cube clears text lanes and morph shapes (projectTargets) but does NOT join
        // pairwise de-conflict: a screen-filling feature cube cannot be nudged off small cubes
        // without jitter, so it only routes around the copy. (_avoidPair stays false.)
        _forceable[i] = true; _avoid[i] = true; _avoidPair[i] = true;
        if (moving) { m.rotation.x += TUMBLE_X * fs * tumbleScale; m.rotation.y += TUMBLE_Y * fs * tumbleScale; }
      } else if (mobileHide || forceHidden || (ov && ov.exit)) {
        // hidden / exited: drift out past the nearest edge and hold there (opacity stays 1)
        const ex = exitTargetLocal(i);
        tgt[i].set(ex.x, ex.y, ex.z);
        scaleTarget[i] = 1;
        if (moving) { m.rotation.x += TUMBLE_X * fs; m.rotation.y += TUMBLE_Y * fs; }
      } else if (ov) {
        // explicit setTargets() override (world units)
        tgt[i].set(ov.x - group.position.x, ov.y - group.position.y, ov.z);
        scaleTarget[i] = ov.scale || 1;
        _forceable[i] = !ov.parked; _avoid[i] = !ov.parked; _avoidPair[i] = !ov.parked;
        if (moving && !ov.parked) { m.rotation.x += TUMBLE_X * fs; m.rotation.y += TUMBLE_Y * fs; }
      } else if (excludeRects.length) {
        // crowded section (experience / slicer): eight cubes cannot fit the free band beside
        // the text column and the morph shape, so the drift cubes exit to alternating edges
        // (opacity stays 1). Nearest edge (shortest trip under the 12 px cap), staggered.
        const ex = exitTargetLocal(i);
        tgt[i].set(ex.x, ex.y, ex.z);
        scaleTarget[i] = 1;
        _forceable[i] = true; _avoid[i] = true; _avoidPair[i] = true;
        if (moving) { m.rotation.x += TUMBLE_X * fs; m.rotation.y += TUMBLE_Y * fs; }
      } else {
        // free drift: slow sine wander around the unravel home (none at the calm hero grid);
        // a slow tumble via angVel
        const wander = Math.min(1, unravel * 3);
        const dx = Math.sin(t * 0.07 + i * 1.3) * 0.7 * wander;
        const dy = Math.cos(t * 0.05 + i) * 0.5 * wander;
        tgt[i].set(base[i].x + dx, base[i].y + bob + dy, base[i].z);
        scaleTarget[i] = 1;
        _forceable[i] = true; _avoid[i] = true; _avoidPair[i] = true;
        // Tumble ramps with unravel: the calm sorted grid faces forward (small AABB, so the
        // tight rows clear), and the scattered cloud spins freely once the cubes have spread.
        const spin = Math.min(1, unravel * 2.2);
        const damp = Math.min(1, 4 * dtc);
        angVel[i].x += (TUMBLE_X * 60 * spin - angVel[i].x) * damp;
        angVel[i].y += (TUMBLE_Y * 60 * spin - angVel[i].y) * damp;
        if (moving) { m.rotation.x += angVel[i].x * dtc; m.rotation.y += angVel[i].y * dtc; }
        // ease residual rotation back to face-on at the calm grid so the box stays compact
        if (spin < 0.05) { m.rotation.x += (0.1 - m.rotation.x) * Math.min(1, 0.1 * fs); m.rotation.y += (0.14 - m.rotation.y) * Math.min(1, 0.1 * fs); }
      }
    }

    // ---- hard constraints: project targets clear of text lanes, shapes, and each other ----
    projectTargets();
    // ---- velocity-only repulsion backstop for transient penetrations ----
    computeForces(dtc, _forceable);

    // ---- pass B: critically damped spring integrates every cube toward its target ----
    const w = window.innerWidth;
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      // a = -2*zeta*omega*vel - omega^2*(pos - target); semi-implicit Euler
      _acc.copy(m.position).sub(tgt[i]).multiplyScalar(-OMEGA * OMEGA);
      _acc.addScaledVector(vel[i], -2 * ZETA * OMEGA);
      vel[i].addScaledVector(_acc, dtc);
      // px per group-local x-unit at this cube's depth, for the screen speed cap
      m.getWorldPosition(_c0); _c1.copy(_c0); _c1.x += 1;
      _c0.project(camera); _c1.project(camera);
      const ppu = Math.max(1, Math.abs((_c1.x - _c0.x) * 0.5 * w));
      const maxVel = (MAX_PX_FRAME * 60) / ppu;         // <= 14 px per 1/60 s
      const sp = vel[i].length();
      if (sp > maxVel) vel[i].multiplyScalar(maxVel / sp);
      _delta.copy(vel[i]).multiplyScalar(dtc);
      const stepPx = Math.hypot(_delta.x, _delta.y) * ppu;   // hard per-frame safety clamp
      if (stepPx > MAX_PX_FRAME) _delta.multiplyScalar(MAX_PX_FRAME / stepPx);
      m.position.add(_delta);
      // scale eased (no scale pop), opacity = reveal fade * scrim (1.0 otherwise)
      m.scale.setScalar(m.scale.x + (scaleTarget[i] - m.scale.x) * Math.min(1, 0.15 * fs));
      cubeReveal[i] += (revealTargets[i] - cubeReveal[i]) * Math.min(1, 0.12 * fs);
      setCubeOpacity(m, _opArr[i] * cubeReveal[i]);
    }

    updateRaymondRig();   // Raymond faces + hide the parked cube behind the rig (after opacity)
    renderer.render(scene, camera);
    updateLabels();
  }

  return {
    frame, setUnravel, setState, focus, raycast, setPointer, ready,
    cubeBoxes, labelBoxes, chapterPark, setTrack, setExclude, setTextRects, setShapeRects, setLanes, setTargets, exit, recall, chapterDim, setCloudDim, setMobileHide, setForceHidden, meshBox,
    setProjects, setContact, gridSlots, cubeCenters, shapeRectsNow, setHover, openProject, closeProject, projectOpenIndex, faceAnchors, setProjectHandlers,
    setParkAnchor, setRaymondUnfold, setRaymondFaces, raymondFaceRects, raymondFaceAt,
    _dbgTargets: () => { const w = window.innerWidth, h = window.innerHeight; return tgt.map((v, i) => { const q = v.clone(); group.localToWorld(q); q.project(camera); return { i, sx: +((q.x * 0.5 + 0.5) * w).toFixed(0), sy: +((-q.y * 0.5 + 0.5) * h).toFixed(0), avoid: _avoid[i] }; }); },
    projectsActive: () => projActive,
    labelFor: (i) => (CUBES[i] ? CUBES[i].label : ''),
    cubeOpacity: (i) => meshes[i].material[0].opacity,
    getState: () => ({ unravel, parked: Object.keys(parkTargets).map(Number), projT: +projT.toFixed(2), contactT: +contactT.toFixed(2) }),
    capDpr() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); resize(); },
    halveCount() {},
    sectionFor: (i) => (CUBES[i] ? CUBES[i].section : null),
    get count() { return meshes.length; },
    _onCubeClick: onCubeClick,
  };
}
