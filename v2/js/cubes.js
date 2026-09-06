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
      // Part D: larger type so the band reads on screen (was 44/30/26, about 13 px rendered).
      const padX = 52; let ty = IMG_H + 40; ctx.textBaseline = 'top';
      ctx.fillStyle = ACCENT; ctx.font = '600 30px Roboto, system-ui, sans-serif';
      ctx.fillText(String(label || '').toUpperCase(), padX, ty); ty += 48;
      ctx.fillStyle = '#141414'; ctx.font = '500 64px Roboto, system-ui, sans-serif';
      ty = wrapText(ctx, title, padX, ty, SZ - 2 * padX, 74, 2) + 12;
      if (key) { ctx.fillStyle = '#3a3a3a'; ctx.font = '500 44px Roboto, system-ui, sans-serif';
        ty = wrapText(ctx, key, padX, ty, SZ - 2 * padX, 54, 2) + 10; }
      ctx.fillStyle = '#5a5a5a'; ctx.font = '400 34px Roboto, system-ui, sans-serif';
      wrapText(ctx, summary, padX, ty, SZ - 2 * padX, 44, 4);
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
  // Part D: Raymond faces are TEXT-FIRST (5 of 6 images are the forklift placeholder). White
  // face, big system name, key number in the accent, one line, small "RAYMOND" label. Only a
  // real (non-placeholder) image gets a 30% bottom strip.
  function makeRaymondFace({ name, number, line, image }) {
    const SZ = 1024;
    const cv = document.createElement('canvas'); cv.width = SZ; cv.height = SZ;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const hasImg = !!image && image.indexOf('raymond-forklift') < 0;   // forklift = placeholder
    const stripH = hasImg ? Math.round(SZ * 0.30) : 0;
    function draw(img) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, SZ, SZ);
      const padX = 56; let ty = 52; ctx.textBaseline = 'top';
      ctx.fillStyle = ACCENT; ctx.font = '600 30px Roboto, system-ui, sans-serif';
      ctx.fillText('RAYMOND', padX, ty); ty += 56;
      ctx.fillStyle = '#141414'; ctx.font = '500 104px Roboto, system-ui, sans-serif';
      ty = wrapText(ctx, name, padX, ty, SZ - 2 * padX, 116, 3) + 20;
      ctx.fillStyle = ACCENT; ctx.font = '500 72px Roboto, system-ui, sans-serif';
      ty = wrapText(ctx, number, padX, ty, SZ - 2 * padX, 84, 2) + 16;
      ctx.fillStyle = '#4a4a4a'; ctx.font = '400 40px Roboto, system-ui, sans-serif';
      wrapText(ctx, line, padX, ty, SZ - 2 * padX, 50, 4);
      if (hasImg && img && img.width) {
        const y0 = SZ - stripH, ar = img.width / img.height, box = SZ / stripH;
        let dw, dh, dx, dy;
        if (ar > box) { dh = stripH; dw = dh * ar; dx = (SZ - dw) / 2; dy = y0; }
        else { dw = SZ; dh = dw / ar; dx = 0; dy = y0 + (stripH - dh) / 2; }
        ctx.save(); ctx.beginPath(); ctx.rect(0, y0, SZ, stripH); ctx.clip();
        ctx.drawImage(img, dx, dy, dw, dh); ctx.restore();
      }
      tex.needsUpdate = true;
    }
    draw(null);
    if (hasImg) { const im = new Image(); im.onload = () => draw(im); im.onerror = () => {}; im.src = image; }
    return tex;
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
    for (const h of hits) {            // nearest hit that is actually visible and clickable
      const idx = meshes.indexOf(h.object);
      if (idx < 0) continue;
      if (visibleSet && !visibleSet.has(idx)) continue;
      if (meshes[idx].material[0].opacity < 0.12) continue;   // faded-out cubes are not clickable
      return idx;
    }
    return -1;
  }
  // C2: pixel-space hit test (nearest visible cube mesh under the pointer) for main.js + checker
  function hitTest(clientX, clientY) {
    const ndc = { x: (clientX / window.innerWidth) * 2 - 1, y: -(clientY / window.innerHeight) * 2 + 1 };
    return raycast(ndc);
  }
  // C1: which cube indices are live this section. null = all. Cubes not in the set exit
  // off-screen and fade out (skipped by hit tests and gates), and any stale park/override on
  // a leaving cube is cleared so a discrete scroll jump can never strand it.
  let visibleSet = null;
  function setVisibleSet(indices) {
    visibleSet = (indices && indices.length !== undefined) ? new Set(indices) : (indices || null);
    if (visibleSet) {
      for (let i = 0; i < meshes.length; i++) {
        if (!visibleSet.has(i)) { delete parkTargets[i]; override[i] = null; }
      }
      // Authoritative: a cube leaving the set cannot keep an open rig. On a discrete jump the
      // experience scrub never drives setRaymondUnfold back to 0, so the rig would linger into
      // the next section; snap it (and any open project unfold) closed here.
      if (!visibleSet.has(raymondCubeIndex()) && (raymondRig || raymondT > 0)) { raymondT = 0; disposeRaymondRig(); }
      if (openIndex >= 0 && !visibleSet.has(openIndex)) { openIndex = -1; openT = 0; disposeRig(); }
    }
  }

  // ---- label DOM ----
  const labelLayer = document.getElementById('cube-labels');
  // C2: labels are hover feedback only. They must NEVER intercept pointer events, or a click
  // lands on a label div (whose slot may belong to a different cube) instead of reaching the
  // raycast, which is exactly why clicking CNC opened the slicer. Force pointer-events off here
  // so the fix holds regardless of the stylesheet.
  if (labelLayer) labelLayer.style.pointerEvents = 'none';
  const labelEls = CUBES.map((c) => {
    const el = document.createElement('div');
    el.className = 'cube-label';
    el.style.pointerEvents = 'none';
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
    const inScrubProj = scrubOn && secProg.projects > 0.15 && secProg.projects < 0.62;
    const inProjects = ((projT > 0.5 || contactT > 0.5) || inScrubProj) && openIndex < 0;
    const gEdge = inScrubProj ? grid6EdgePx : gridEdgePx;
    const rc = raymondCubeIndex();
    for (let i = 0; i < meshes.length; i++) {
      let x, y, op;
      // a label is hidden for any cube that is out of the visible set, exited, currently open
      // as a rig, or the Raymond cube while its rig is up (no floating DEPLOY label).
      // feature cube: only label it while it is genuinely parked & closed on screen (not flying
      // in/out, not while its faces are hinged open)
      const own = scrubOn ? ownerOf(i) : null;
      const featureOffOrOpen = own && own !== 'projects' && (secProg[own] <= 0.30 || secProg[own] >= 0.85);
      const hidden = (visibleSet && !visibleSet.has(i)) || (i === rc && raymondT > 0.02) || i === openIndex
        || (srig && srigIndex === i) || featureOffOrOpen;
      if (forceHidden || openIndex >= 0 || hidden) {
        meshes[i].getWorldPosition(_p); _p.project(camera);
        x = (_p.x * 0.5 + 0.5) * w; y = (-_p.y * 0.5 + 0.5) * h + 124; op = 0;
      } else if (inProjects) {
        meshes[i].getWorldPosition(_p);
        _p.project(camera);
        x = (_p.x * 0.5 + 0.5) * w;
        // directly under THIS cube: 8px below its projected box bottom (~0.71*edge half)
        y = (-_p.y * 0.5 + 0.5) * h + gEdge * 0.71 + 8;
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
  // C5: size and place the 4x2 grid from the live lanes so it sits under its heading and never
  // lands on the copy or the morph shape. edge = min(9vw,15vh), 40 px below the lowest lane in
  // the top 45% of the viewport, shrunk to a 7vw floor if it would hit a lane/shape below or
  // the viewport bottom. projWorld (world, z=0) and gridScale are recomputed while the grid is on.
  let gridScale = PROJ_SCALE, gridEdgePx = 0;
  function _rectHit(a, b) {
    return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  }
  function worldAtScreen(px, py, z) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const ndcX = (px / vw) * 2 - 1, ndcY = 1 - 2 * (py / vh);
    const halfHz = (camera.position.z - z) * tanHalf();
    return { x: ndcX * halfHz * camera.aspect, y: ndcY * halfHz };
  }
  function computeGridSlots() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const lanes = domTextRects();
    let headBottom = 0.15 * vh;                       // default top band if no header lane
    for (const r of lanes) if (r.y < 0.45 * vh && r.y + r.h > 0) headBottom = Math.max(headBottom, r.y + r.h);
    // clear the header by the spec 40 px PLUS the checker's own +40 text pad and the tilted
    // cube's overhang above its cell, so the padded box never touches the padded header rect.
    const gridTop = headBottom + 88;
    const minEdge = 0.07 * vw, GAPF = 0.14;
    // A grid cube's tilted (projected) AABB is ~1.6x its face-on edge, so slots must be spaced
    // by that box, not the edge, or adjacent rows/cols overlap. Rows also hold a label.
    const gapXof = (e) => e * 0.16 + 8;                  // small col gap; near-face-on boxes clear
    const gapYof = (e) => Math.max(e * 0.16, 50);        // row gap holds the label; tilt is small now
    const fits = (e) => {
      const gapX = gapXof(e), gapY = gapYof(e), gw = 4 * e + 3 * gapX, gh = 2 * e + gapY;
      if (gridTop + gh + e * 0.15 > vh - 12) return false;   // must sit fully inside the viewport
      // pad the block the way the checker pads text (+40) plus the tilt overhang, so a "fits"
      // result really is on-text-free
      const P = 44 + e * 0.12;
      const block = { x: vw / 2 - gw / 2 - P, y: gridTop - P, w: gw + 2 * P, h: gh + 2 * P };
      for (const r of lanes) { if (r.y + r.h <= headBottom + 1) continue; if (_rectHit(block, r)) return false; }
      for (const r of shapeRects) if (_rectHit(block, r)) return false;
      return true;
    };
    let edge = Math.min(0.09 * vw, 0.15 * vh);
    while (edge > minEdge && !fits(edge)) edge -= 4;
    edge = Math.max(edge, minEdge);
    gridEdgePx = edge;
    const gapX = gapXof(edge), gapY = gapYof(edge), cx = vw / 2;
    for (let i = 0; i < CUBES.length; i++) {
      const col = i % 4, row = Math.floor(i / 4);
      const px = cx + (col - 1.5) * (edge + gapX);
      const py = gridTop + edge / 2 + row * (edge + gapY);
      const w = worldAtScreen(px, py, 0);
      projWorld[i].set(w.x, w.y, 0);
    }
    const ppu0 = (vh * 0.5) / (camera.position.z * tanHalf());   // px per world unit at z=0
    gridScale = edge / ppu0;                                     // world scale so a cube fills one cell
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
  // C3: the rig starts in the clicked cube's exact pose and travels to the framed centre.
  const rigStartPos = new THREE.Vector3(), rigStartQuat = new THREE.Quaternion();
  const rigEndPos = new THREE.Vector3(); const _qIdent = new THREE.Quaternion();
  let rigStartScale = 1, rigEndScale = 1;
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
    // C3: capture the cube's current world pose as the rig START, and the framed net as the
    // END. updateOpenRig(t) drives the rig from one to the other; the closed mesh is hidden the
    // same frame (openIndex opacity 0) so nothing pops or appears in front.
    meshes[i].getWorldPosition(rigStartPos);
    meshes[i].getWorldQuaternion(rigStartQuat);
    rigStartScale = meshes[i].scale.x;
    rigEndPos.set(-0.5 * S, 0, 1.0);   // centre the net (x spans -1.5..2.5) on screen
    rigEndScale = S;
    rig.scale.setScalar(rigStartScale);
    rig.position.copy(rigStartPos);
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
    updateOpenRig(0);
  }
  function setUnfold(t) {
    if (!rig) return;
    const foldAngle = (1 - t) * Math.PI / 2;   // t=1 flat (0 rad), t=0 folded (90 deg)
    for (const key in rigPivots) {
      const f = rigPivots[key];
      if (f.axis === 'y') f.pv.rotation.set(0, f.foldSign * foldAngle, 0);
      else f.pv.rotation.set(f.foldSign * foldAngle, 0, 0);
    }
  }
  // C3: three phases so the CUBE ITSELF unfolds in place, then the net glides to the centre.
  //   0.00-0.25  rotate the closed cube to face-on (rig at the cube pose, folded)
  //   0.25-0.65  hinge the six faces open into the cross net, still at the cube's pose
  //   0.65-1.00  glide + scale the open net to the framed centre
  function updateOpenRig(t) {
    if (!rig) return;
    // Hold at the cube's pose while it rotates face-on and hinges fully OPEN, then glide the
    // open net to the framed centre. The glide is the LAST 25% so the cube is visibly
    // unfolding in place (anchored) for the first three quarters of the motion.
    const p1 = Math.min(1, t / 0.22);                          // rotate to face-on
    const p2 = Math.min(1, Math.max(0, (t - 0.12) / 0.53));    // hinge open (done by t=0.65)
    const p3 = Math.min(1, Math.max(0, (t - 0.75) / 0.25));    // glide to centre (last quarter)
    rig.position.lerpVectors(rigStartPos, rigEndPos, easeInOut(p3));
    rig.scale.setScalar(rigStartScale + (rigEndScale - rigStartScale) * easeInOut(p3));
    rig.quaternion.slerpQuaternions(rigStartQuat, _qIdent, easeInOut(p1));
    setUnfold(easeInOut(p2));
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
    if (g) g.fromTo({ p: 0 }, { p: 0 }, { p: 1, duration: 1.5, ease: 'none', onUpdate: function () { openT = this.targets()[0].p; updateOpenRig(openT); } });
    else { openT = 1; updateOpenRig(1); }
    if (onProjectOpen) onProjectOpen(i);
  }
  function closeProject() {
    if (openIndex < 0) return;
    const g = window.gsap; const idx = openIndex;
    if (g) g.to({ p: openT }, { p: 0, duration: 0.9, ease: 'power2.inOut',
      onUpdate: function () { openT = this.targets()[0].p; updateOpenRig(openT); },
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
      const tex = makeRaymondFace({ name: f.name || '', number: f.number || '', line: f.line || '', image: f.image });
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
    // Round 4 thin adapter: the experience cube is unfolded by setSectionProgress('experience')
    // via the scroll-scrubbed hinge rig. Once that engine is driving, this old 3x2 rig must not
    // also build (double render). Kept so any legacy caller is a harmless no-op.
    if (scrubOn) { if (raymondRig) disposeRaymondRig(); raymondT = 0; return; }
    t = Math.min(1, Math.max(0, t));
    raymondT = t;
    if (t <= 0.001) { disposeRaymondRig(); return; }
    if (!raymondRig) buildRaymondRig();
  }
  // Part D: measure the free band live (between the employer lines and achievements, right of
  // the text, left of the forklift) and size the 3x2 grid to fill it. Cached per frame in these.
  let bandCx = 0, bandCy = 0, bandFace = 0, bandGap = 0, bandW = 0, bandH = 0;
  function raymondBand() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const hb = document.querySelector('.exp2-head');
    const ab = document.querySelector('.exp2-ach');
    const hr = hb ? hb.getBoundingClientRect() : null;
    const ar = ab ? ab.getBoundingClientRect() : null;
    // clamp to the viewport: in the pinned experience section .exp2-ach can be far below the
    // fold, which would make the band (and the fitted park scale) far too tall.
    const top = Math.max(0.06 * vh, ((hr && hr.height > 4 ? hr.bottom : 0.32 * vh) + 40));
    const achTop = (ar && ar.height > 4 && ar.top < vh) ? ar.top : 0.72 * vh;
    const bottom = Math.min(0.90 * vh, achTop - 40);
    const left = 0.05 * vw;
    const forkX = (shapeRects[0] && shapeRects[0].w > 4) ? shapeRects[0].x - 24 : 0.47 * vw;
    const right = Math.min(0.47 * vw, forkX);
    bandW = Math.max(120, right - left); bandH = Math.max(120, bottom - top);
    bandGap = 0.012 * vh;
    bandFace = Math.max(60, Math.min((bandW - 2 * bandGap) / 3, (bandH - bandGap) / 2));
    bandCx = (left + right) / 2; bandCy = (top + bottom) / 2;
  }
  function raymondSlotPx(j) {
    const stepX = bandFace + bandGap, stepY = bandFace + bandGap;
    const col = j % 3, row = Math.floor(j / 3);
    return { x: bandCx + (col - 1) * stepX, y: bandCy + (row - 0.5) * stepY, size: bandFace };
  }
  // C4: cross-net layout (face units), standard cube unfold, one entry per face in j order.
  //   [ ][T][ ][ ]
  //   [L][F][R][B]
  //   [ ][Bo][ ][]
  const RAY_NET = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0]];   // F,R,L,T,Bo,B
  const _rv = new THREE.Vector3(), _rNet = new THREE.Vector3(), _rGrid = new THREE.Vector3();
  function updateRaymondRig() {
    if (!raymondRig || !raymondFaceMeshes.length) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    raymondBand();                                              // Part D: size to the live band
    const halfHz = (camera.position.z - PARK_Z) * tanHalf();
    const faceWorld = bandFace * 2 * halfHz / vh;               // band face px -> world at PARK_Z
    const netStep = faceWorld * 1.04;                          // net cells touch with a hair of gap
    const centerLocal = anchorLocalXY((bandCx / vw) * 100, (bandCy / vh) * 100);
    // C4 two phases: t 0..0.55 HINGE the six faces open into the cross net at the park pose,
    // t 0.55..1 SLIDE the open faces from the net into the 3x2 grid. Never a jump-cut.
    const a = easeInOut(Math.min(1, raymondT / 0.55));         // hinge open into the net
    const b = easeInOut(Math.max(0, (raymondT - 0.55) / 0.45)); // slide net -> grid
    const meanX = (0 + 1 - 1 + 0 + 0 + 2) / 6;                 // centre the cross on the park point
    for (let j = 0; j < 6; j++) {
      const m = raymondFaceMeshes[j];
      // net position (group-local), centred on the park point
      _rNet.set(centerLocal.x + (RAY_NET[j][0] - meanX) * netStep,
                centerLocal.y + RAY_NET[j][1] * netStep, centerLocal.z);
      // grid slot (group-local)
      const slot = raymondSlotPx(j);
      const g = anchorLocalXY((slot.x / vw) * 100, (slot.y / vh) * 100);
      _rGrid.set(g.x, g.y, g.z);
      // phase A: unfold from the stacked park centre out to the net cell, hinging flat
      _rv.lerpVectors(centerLocal, _rNet, a);
      // phase B: slide the open face from its net cell into the grid slot
      _rv.lerpVectors(_rv, _rGrid, b);
      m.position.copy(_rv);
      m.scale.setScalar(faceWorld);
      const foldX = RAY_NET[j][1] !== 0 ? Math.sign(RAY_NET[j][1]) : 0;
      const foldY = RAY_NET[j][0] !== 0 ? Math.sign(RAY_NET[j][0]) : 0;
      // folded (a=0) -> 90deg about the hinge axis; flat net and grid (a>=1, b>=0) -> face-on
      m.rotation.set(foldX * (1 - a) * (Math.PI / 2), foldY * (1 - a) * (Math.PI / 2), 0);
    }
    const rc = raymondCubeIndex();
    if (raymondT > 0.02 && meshes[rc]) setCubeOpacity(meshes[rc], 0);   // hide parked cube behind rig
  }
  function raymondFaceRects() {
    // round 4: the experience cube unfolds via the scrub hinge rig; prefer it when up.
    if (srig && srigIndex === raymondCubeIndex()) { const r = scrubFaceRects(); if (r.length === 6) return r; }
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

  // ================= ROUND 4: scroll-scrubbed choreography (spec 9) =================
  // main.js calls setSectionProgress(section, p) every frame; p is scroll progress 0..1.
  // The whole scene is a pure function of p, spring-smoothed (omega ~8), so motion follows
  // scroll exactly and reverses exactly. Cubes never move on their own. Sections:
  //   experience: cube 4 flies in (0..0.3), hinges open (0.3..0.7), holds (..0.85), folds
  //               and exits up-left (0.85..1); never returns. Its six baked faces = systems.
  //   slicer:     cube 3, same schedule, laid out left of the slice stack; exits for good.
  //   projects:   the other six cubes fly to a 3x2 grid (0..0.4), hold; scroll past translates
  //               the grid up so they leave the top like page content.
  let scrubOn = false;
  const secProg = { experience: 0, slicer: 0, projects: 0 };
  const PROJ6 = [0, 1, 2, 5, 6, 7];
  const FEATURE = { experience: 4, slicer: 3 };
  // each cube is owned by exactly one section, so the three progresses compose without
  // conflict: cube 4 = experience, cube 3 = slicer, the other six = projects.
  function ownerOf(i) { return i === 4 ? 'experience' : i === 3 ? 'slicer' : 'projects'; }
  const grid6World = PROJ6.map(() => new THREE.Vector3());
  let grid6Scale = 1, grid6EdgePx = 0;
  function clamp01(x) { return Math.min(1, Math.max(0, x)); }
  // hinge amount for a feature cube: closed while flying in (<0.3), open 0.3..0.7,
  // hold 0.7..0.85, fold back 0.85..1 (then the closed cube exits).
  function hingeAmt(p) {
    if (p < 0.30) return 0;
    if (p < 0.70) return (p - 0.30) / 0.40;
    if (p < 0.85) return 1;
    return clamp01(1 - (p - 0.85) / 0.15);
  }

  // Free band for a feature cube: between the section's top/bottom text, left of the morph
  // shape (forklift for experience, slice stack for slicer). Sets bandCx/bandCy/bandW/bandH (px).
  // The free band for a feature cube, always an on-screen rectangle. Start from a safe
  // viewport region, then nudge below an on-screen header, above an on-screen footer, and
  // left of the on-screen morph shape. Any degenerate result falls back to the viewport
  // default so the cube (and its unfolded faces) never land below the fold.
  function scrubBand(section) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const shape = (shapeRects[0] && shapeRects[0].w > 4) ? shapeRects[0] : null;
    const left = 0.04 * vw;
    let right = Math.min(0.54 * vw, shape && shape.x > 0.2 * vw ? shape.x - 28 : 0.54 * vw);
    if (right - left < 220) right = Math.min(0.54 * vw, left + 220);   // stack far left: take width
    // on-screen section text rects in the left column (padded), as vertical blockers
    const sels = section === 'slicer' ? ['.slicer-story', '.slicer-key'] : ['.exp2-head', '.exp2-ach'];
    const yTop = 0.05 * vh, yBot = 0.95 * vh;
    const blockers = [];
    sels.forEach((s) => {
      const e = document.querySelector(s); if (!e) return;
      const r = e.getBoundingClientRect();
      if (r.height > 4 && r.width > 4 && r.bottom > 0 && r.top < vh && r.x < right)
        blockers.push([Math.max(yTop, r.top - 40), Math.min(yBot, r.bottom + 40)]);
    });
    blockers.sort((a, b) => a[0] - b[0]);
    // tallest free vertical slab clear of every padded text block
    let cur = yTop, best = null;
    const consider = (a, z) => { if (z - a > (best ? best[1] - best[0] : 0)) best = [a, z]; };
    for (const [b0, b1] of blockers) { if (b0 > cur) consider(cur, b0); cur = Math.max(cur, b1); }
    consider(cur, yBot);
    let top, bottom;
    if (best && best[1] - best[0] >= 160) { top = best[0]; bottom = best[1]; }
    else { top = 0.15 * vh; bottom = 0.83 * vh; }
    bandW = right - left; bandH = bottom - top;
    bandCx = (left + right) / 2; bandCy = (top + bottom) / 2;
  }
  function localAtVwVh(vwPct, vhPct) { return anchorLocalXY(vwPct, vhPct).clone(); }

  // ---- scrub hinge rig: the cube's OWN six faces hinge open into a cross net (same mesh),
  // then glide + scale to fill the free band. Separate from the click-open rig (openProject).
  let srig = null, srigPivots = null, srigIndex = -1, srigFaces = [];
  const srigStartPos = new THREE.Vector3(), srigStartQuat = new THREE.Quaternion();
  function scrubFaceTex(i, idx, raymond) {
    if (raymond) {
      const f = raymondFacesList()[idx] || {};
      return makeRaymondFace({ name: f.name || '', number: f.number || '', line: f.line || '', image: f.image });
    }
    const specs = projectFaceSpecs(i);
    const mats = meshes[i].material;
    const sp = specs[idx];
    sp.imageEl = mats[idx] && mats[idx].map && mats[idx].map.image; sp.image = null;
    return makeBakedFace(sp);
  }
  function buildScrubRig(i, raymond) {
    disposeScrubRig();
    srigIndex = i;
    const faceMat = (idx) => new THREE.MeshBasicMaterial({ map: scrubFaceTex(i, idx, raymond),
      color: 0xffffff, side: THREE.DoubleSide, toneMapped: false, transparent: false });
    const plane = new THREE.PlaneGeometry(1, 1, 1, 1);
    srig = new THREE.Group();
    meshes[i].getWorldPosition(srigStartPos);
    meshes[i].getWorldQuaternion(srigStartQuat);
    srig.position.copy(srigStartPos);
    srig.quaternion.copy(srigStartQuat);
    srig.scale.setScalar(Math.max(0.1, meshes[i].scale.x));
    const front = new THREE.Mesh(plane, faceMat(FACE_MAP.front)); srig.add(front);
    function flap(name, pivotPos, axis, foldSign, parent) {
      const pv = new THREE.Group(); pv.position.copy(pivotPos);
      const mesh = new THREE.Mesh(plane, faceMat(FACE_MAP[name]));
      if (axis === 'y') mesh.position.set(pivotPos.x >= 0 ? 0.5 : -0.5, 0, 0);
      else mesh.position.set(0, pivotPos.y >= 0 ? 0.5 : -0.5, 0);
      pv.add(mesh); (parent || srig).add(pv);
      return { pv, axis, foldSign, mesh };
    }
    srigPivots = {
      right: flap('right', new THREE.Vector3(0.5, 0, 0), 'y', -1),
      left: flap('left', new THREE.Vector3(-0.5, 0, 0), 'y', 1),
      top: flap('top', new THREE.Vector3(0, 0.5, 0), 'x', 1),
      bottom: flap('bottom', new THREE.Vector3(0, -0.5, 0), 'x', -1),
    };
    srigPivots.back = flap('back', new THREE.Vector3(1, 0, 0), 'y', -1, srigPivots.right.pv);
    srigFaces = [front, srigPivots.right.mesh, srigPivots.left.mesh, srigPivots.top.mesh, srigPivots.bottom.mesh, srigPivots.back.mesh];
    scene.add(srig);
  }
  function disposeScrubRig() {
    if (!srig) return;
    scene.remove(srig);
    srig.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); } });
    srig = null; srigPivots = null; srigIndex = -1; srigFaces = [];
  }
  // net spans x[-1.5,2.5] (centre +0.5), y[-1.5,1.5]; fit into the band and centre it there.
  function updateScrubRig(t, section) {
    if (!srig) return;
    scrubBand(section);
    const vh = window.innerHeight, RZ = 1.0;
    const ppu = (vh * 0.5) / ((camera.position.z - RZ) * tanHalf());
    // 0.85 headroom: mid-hinge (t~0.5) faces tilt toward the camera and project larger than the
    // flat 4x3 net, so the union of the six face rects at t=0.5 and t=1 stays inside the band.
    let S = Math.min((bandW - 24) / (4 * ppu), (bandH - 24) / (3 * ppu)) * 0.85;
    S = Math.max(0.2, S);
    const c = worldAtScreen(bandCx, bandCy, RZ);
    const p1 = clamp01(t / 0.25);                         // rotate to face-on
    const p2 = clamp01((t - 0.10) / 0.75);               // hinge flat
    // Glide over a WIDER scroll window than the hinge (section p 0.30..0.82, not 0.30..0.70) so
    // the same travel spreads across more scroll: the per-frame step at the easeInOut midpoint
    // no longer spikes (~20 px), while the zero-velocity endpoints keep both handoffs continuous.
    const pp = secProg[section] != null ? secProg[section] : (0.30 + 0.40 * t);
    const e = easeInOut(clamp01((pp - 0.30) / 0.52));    // glide + scale into the band
    srig.quaternion.slerpQuaternions(srigStartQuat, _qIdent, easeInOut(p1));
    srig.position.set(
      srigStartPos.x + ((c.x - 0.5 * S) - srigStartPos.x) * e,
      srigStartPos.y + (c.y - srigStartPos.y) * e,
      srigStartPos.z + (RZ - srigStartPos.z) * e);
    const s0 = Math.max(0.1, meshes[srigIndex] ? meshes[srigIndex].scale.x : 1);
    srig.scale.setScalar(s0 + (S - s0) * e);
    const fold = (1 - easeInOut(p2)) * Math.PI / 2;
    for (const k in srigPivots) {
      const f = srigPivots[k];
      if (f.axis === 'y') f.pv.rotation.set(0, f.foldSign * fold, 0);
      else f.pv.rotation.set(f.foldSign * fold, 0, 0);
    }
  }
  function scrubFaceRects() {
    const out = [];
    if (!srig || !srigFaces.length) return out;
    const w = window.innerWidth, h = window.innerHeight;
    srig.updateWorldMatrix(true, true);
    for (let j = 0; j < 6; j++) {
      const m = srigFaces[j];
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
  // six screen rects of the click-open (C3) rig while cube i is open, else [].
  function rigFaceRects() {
    const out = [];
    if (!rig || !rigPivots) return out;
    const w = window.innerWidth, h = window.innerHeight;
    rig.updateWorldMatrix(true, true);
    const faces = [rig.userData.front, rigPivots.right.mesh, rigPivots.left.mesh, rigPivots.top.mesh, rigPivots.bottom.mesh, rigPivots.back.mesh];
    for (let j = 0; j < 6; j++) {
      const m = faces[j]; if (!m) continue;
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
  // six screen rects while cube i is open (scrub hinge or click-open), else [].
  function unfoldFaceRects(i) {
    if (srig && srigIndex === i) return scrubFaceRects();
    if (rig && openIndex === i) return rigFaceRects();
    return [];
  }

  // 3x2 projects grid sized/placed from the live lanes, shifted up as p passes the hold.
  // 3x2 grid. `edge` is the rendered cube FACE size; a nearly face-on cube projects to an AABB
  // ~1.4x that (perspective + slight tilt), so cells are pitched by that box plus a label gap:
  // pitchX = 1.55*edge, pitchY = 1.5*edge + labelGap. Labels sit in the row's lower gap.
  const LABEL_H = 16;   // cube-label line box (12px uppercase, single line)
  function computeGrid6(shiftPx) {
    const vw = window.innerWidth, vh = window.innerHeight;
    // Page-locked: anchor the grid a fixed distance below the projects heading, read straight
    // from its live rect so the whole block scrolls 1:1 with the page (the heading and the
    // websites text can never pass through it). Fall back to the lane scan if the head is absent.
    const headEl = document.querySelector('.projects-head');
    let headBottom;
    if (headEl) { headBottom = headEl.getBoundingClientRect().bottom; }
    else {
      const lanes = domTextRects();
      headBottom = 0.13 * vh;
      for (const r of lanes) if (r.y < 0.40 * vh && r.y + r.h > 0) headBottom = Math.max(headBottom, r.y + r.h);
    }
    const gridTop = headBottom + 64;
    const minEdge = 0.055 * vw;
    const pitchXof = (e) => 1.58 * e;
    // row pitch holds this cube's box, its label row below it, and 8px clearance on each side of
    // the label: center-to-center = box + 8 + LABEL_H + 8 = 1.42e + LABEL_H + 16.
    const pitchYof = (e) => 1.42 * e + LABEL_H + 16;
    const box = (e) => 1.42 * e;                          // projected AABB of a face-on cube
    const fits = (e) => {
      const totH = pitchYof(e) + box(e) + LABEL_H + 8;    // second row's box plus its label row
      const totW = 2 * pitchXof(e) + box(e);
      return (gridTop + totH <= vh - 12) && (totW <= vw * 0.9);
    };
    let edge = Math.min(0.10 * vw, 0.14 * vh);
    while (edge > minEdge && !fits(edge)) edge -= 3;
    edge = Math.max(edge, minEdge);
    grid6EdgePx = edge;
    const pitchX = pitchXof(edge), pitchY = pitchYof(edge), cx = vw / 2;
    const topRowCy = gridTop + box(edge) / 2;
    for (let k = 0; k < PROJ6.length; k++) {
      const col = k % 3, row = Math.floor(k / 3);
      const px = cx + (col - 1) * pitchX;
      const py = topRowCy + row * pitchY;   // page-locked via headBottom; shiftPx is ignored
      const wpt = worldAtScreen(px, py, 0);
      grid6World[k].set(wpt.x, wpt.y, 0);
    }
    const ppu0 = (vh * 0.5) / (camera.position.z * tanHalf());
    grid6Scale = edge / ppu0;
  }

  // Record one section's scroll progress. main.js calls this for all three sections every
  // frame. Cube positions, the feature-cube hinge, and the projects grid are derived from
  // these in frame() (pure functions of progress), so motion follows and reverses scroll
  // exactly. No opacity dimming, no visible-set latch: a cube is off-screen by POSITION when
  // its owning section is before (p=0) or after (p=1) its active window.
  function setSectionProgress(section, p) {
    if (!(section in secProg)) return;
    scrubOn = true;
    visibleSet = null;                 // ownership drives visibility now, not the set latch
    secProg[section] = clamp01(p);
    // feature-cube hinge rig: experience(cube 4) or slicer(cube 3), never both at once
    let wantRig = -1, wantRaymond = false;
    if (hingeAmt(secProg.experience) > 0.02) { wantRig = 4; wantRaymond = true; }
    else if (hingeAmt(secProg.slicer) > 0.02) { wantRig = 3; wantRaymond = false; }
    if (wantRig >= 0) { if (!srig || srigIndex !== wantRig) buildScrubRig(wantRig, wantRaymond); }
    else if (srig) disposeScrubRig();
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
    return { x, y: 1.55 * halfH - group.position.y, z };
  }

  // ---- off-screen park guarantee ----
  // A cube parked before (p=0) or after (p=1) its window must sit with its WHOLE projected box
  // clear of the viewport. The box is a tumbled cube at PARK_Z depth (closer to camera, so it
  // projects larger) at scales up to 2.6, and a fixed vw/vh anchor cannot promise clearance at
  // every size. offscreenPark() pushes a park anchor outward, using the exact projected box the
  // checker reads (meshBox math), until the box is >= OFFSCREEN_PAD px beyond the named edge(s).
  // Iterated (projection is non-linear) and recomputed each frame, so a resize re-parks it.
  const OFFSCREEN_PAD = 48;
  const _bqPos = new THREE.Vector3(), _bqQuat = new THREE.Quaternion(), _bqScale = new THREE.Vector3(), _bqMat = new THREE.Matrix4(), _bqC = new THREE.Vector3();
  function projectedBoxAtLocal(i, loc, scale) {
    const m = meshes[i];
    _bqPos.copy(loc); group.localToWorld(_bqPos);
    _bqQuat.copy(m.quaternion); _bqScale.setScalar(scale);
    _bqMat.compose(_bqPos, _bqQuat, _bqScale);
    const w = window.innerWidth, h = window.innerHeight;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (let sx = -1; sx <= 1; sx += 2)
      for (let sy = -1; sy <= 1; sy += 2)
        for (let sz = -1; sz <= 1; sz += 2) {
          _bqC.set(sx * 0.5, sy * 0.5, sz * 0.5).applyMatrix4(_bqMat).project(camera);
          const X = (_bqC.x * 0.5 + 0.5) * w, Y = (-_bqC.y * 0.5 + 0.5) * h;
          if (X < minx) minx = X; if (X > maxx) maxx = X;
          if (Y < miny) miny = Y; if (Y > maxy) maxy = Y;
        }
    return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
  }
  const _oa = new THREE.Vector3(), _oaW0 = new THREE.Vector3(), _oaW1 = new THREE.Vector3();
  function offscreenPark(i, base, scale, edges) {
    _oa.copy(base);
    const w = window.innerWidth, h = window.innerHeight;
    for (let it = 0; it < 5; it++) {
      const b = projectedBoxAtLocal(i, _oa, scale);
      _oaW0.copy(_oa); group.localToWorld(_oaW0); _oaW1.copy(_oaW0); _oaW1.x += 1;
      _oaW0.project(camera); _oaW1.project(camera);
      const ppu = Math.max(1, Math.abs((_oaW1.x - _oaW0.x) * 0.5 * w));
      let moved = false;
      for (const edge of edges) {
        let sh = 0;
        if (edge === 'right')       { sh = (w + OFFSCREEN_PAD) - b.x;        if (sh > 0.5) { _oa.x += sh / ppu; moved = true; } }
        else if (edge === 'left')   { sh = (b.x + b.w) + OFFSCREEN_PAD;      if (sh > 0.5) { _oa.x -= sh / ppu; moved = true; } }
        else if (edge === 'bottom') { sh = (h + OFFSCREEN_PAD) - b.y;        if (sh > 0.5) { _oa.y -= sh / ppu; moved = true; } }
        else if (edge === 'top')    { sh = (b.y + b.h) + OFFSCREEN_PAD;      if (sh > 0.5) { _oa.y += sh / ppu; moved = true; } }
      }
      if (!moved) break;
    }
    return _oa;
  }

  const _tmp = new THREE.Vector3(), _tmp2 = new THREE.Vector3(), _acc = new THREE.Vector3(), _delta = new THREE.Vector3();
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

    // C5: while the projects/contact grid is on, size and place it from the live lanes.
    if (projT > 0.01 || contactT > 0.01) computeGridSlots();
    if (scrubOn) computeGrid6(0);   // grid is page-locked to the heading rect; no viewport shift
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
      if (visibleSet && !visibleSet.has(i)) {
        // C1: not in this section's visible set -> exit off-screen by POSITION at full speed.
        // Opacity stays 1 the whole way (MIN-OPACITY gate + Kambar's no-dimming rule); the cube
        // is skipped by hit tests (raycast filters the set) and leaves overlap/text gates as
        // soon as its box clears the viewport. No park/target/lane work applies.
        const ex = exitTargetLocal(i);
        tgt[i].set(ex.x, ex.y, ex.z);
        scaleTarget[i] = 1;
        revealTargets[i] = 1;               // never dim an on-screen cube
        if (moving) { m.rotation.x += TUMBLE_X * fs; m.rotation.y += TUMBLE_Y * fs; }
      } else if (scrubOn) {
        // Round 4: every cube is driven by its OWNER section's scroll progress. Off-screen by
        // position when the section is before (p=0) or after (p=1) its window; opacity stays 1.
        const owner = ownerOf(i);
        const pp = secProg[owner];
        const vw2 = window.innerWidth, vh2 = window.innerHeight;
        if (owner === 'projects') {
          // 3x2 grid: fly up from below the fold (p 0..0.4), hold, then translate up past the
          // hold (computeGrid6 applies the shift) so the block leaves the top like page content.
          const k = PROJ6.indexOf(i);
          const e = easeInOut(Math.min(1, pp / 0.4));
          _tmp.copy(grid6World[k]).sub(group.position);   // grid slot (group-local)
          // below-fold start whose full box clears the bottom edge by OFFSCREEN_PAD at scale 1
          _tmp2.set(_tmp.x, localAtVwVh(50, 130).y, _tmp.z);
          const belowY = offscreenPark(i, _tmp2, 1, ['bottom']).y;
          tgt[i].set(_tmp.x, belowY + (_tmp.y - belowY) * e, _tmp.z);   // pure f(p), no self-motion
          scaleTarget[i] = 1 + (grid6Scale - 1) * e;
          // face-on so the silhouette centroid equals the projected centre (hit test matches render)
          m.rotation.x += (0 - m.rotation.x) * 0.14;
          m.rotation.y += (0 - m.rotation.y) * 0.14;
          // grid click: the clicked cube hinges open in place via the C3 click rig (openProject),
          // so the closed mesh must vanish the same frame or it sits opaque over the rig.
          _opArr[i] = (i === openIndex) ? 0 : 1;
        } else {
          // feature cube: fly in from the right (0..0.3), park in the band (..0.85), fold and
          // exit up-left (..1). Pure f(p) -> the spring reverses exactly. While its faces are
          // hinged open the closed cube is hidden (opacity 0); the scrub rig shows the faces.
          scrubBand(owner);
          const park = localAtVwVh((bandCx / vw2) * 100, (bandCy / vh2) * 100);
          // largest scale whose projected box (~1.5 * scale * ppu at the park plane) fits the
          // band in both dims, so the closed cube never spills right over the morph shape.
          const ppuPark = (vh2 * 0.5) / ((camera.position.z - PARK_Z) * tanHalf());
          const parkScale = Math.max(1.0, Math.min(2.6, (Math.min(bandW, bandH) - 24) / (1.5 * ppuPark)));
          let sc;
          if (pp < 0.30) {
            const e = easeInOut(pp / 0.30);
            // fly-in start: fully ABOVE the top edge at the band's own x, so the descent into
            // the park point never crosses the morph shape or the padded section text.
            const flyIn = offscreenPark(i, localAtVwVh((bandCx / vw2) * 100, -18), 0.8, ['top']);
            tgt[i].copy(flyIn).lerp(park, e);
            sc = 0.8 + (parkScale - 0.8) * e;
          } else if (pp < 0.85) {
            tgt[i].copy(park); sc = parkScale;
          } else {
            const e = easeInOut((pp - 0.85) / 0.15);
            // exit end: fully off the TOP-LEFT at the parked scale (up to 2.6)
            const flyOut = offscreenPark(i, localAtVwVh(-18, -18), parkScale, ['top', 'left']);
            tgt[i].copy(park).lerp(flyOut, e); sc = parkScale;
          }
          scaleTarget[i] = sc;
          _opArr[i] = hingeAmt(pp) > 0.05 ? 0 : 1;
          m.rotation.x += (0.05 - m.rotation.x) * 0.15;
          m.rotation.y += (0.06 - m.rotation.y) * 0.15;
        }
        // Discrete scroll jump: when the owning section is fully before (p=0) or after (p=1) its
        // window the cube is not in play. Snap it off-screen at once so a direct scrollToY parks
        // it, instead of crawling across the viewport at the 12 px/frame cap for ~3 s. Gradual
        // scroll never sits exactly at the extremes with the cube mid-screen, so the fly-in /
        // park / exit stays smooth.
        if (pp >= 1 - 1e-4) {
          // fully past: a full-size parked feature cube (scale up to 2.6) is so large that even
          // centred off the top-left its perspective-skewed box still pokes in. Drop to scale 1
          // and park straight off the TOP, where the small box clears every edge.
          const ex = exitTargetLocal(i);
          tgt[i].set(ex.x, ex.y, ex.z);
          scaleTarget[i] = 1; m.scale.setScalar(1);
          m.position.copy(tgt[i]); vel[i].set(0, 0, 0);
        } else if (pp <= 1e-4) {
          m.position.copy(tgt[i]); vel[i].set(0, 0, 0);
        }
      } else if (projT > 0.01) {
        // 4x2 centred grid; open cube hides (its unfold rig shows), the rest hold at 0.06
        const e = ease(projT);
        _tmp.copy(projWorld[i]).sub(group.position);
        const lift = (i === hoverIndex && openIndex < 0) ? 0.15 : 0;
        tgt[i].set(base[i].x + (_tmp.x - base[i].x) * e,
                   base[i].y + (_tmp.y - base[i].y) * e + bob * 0.15,
                   base[i].z + (_tmp.z - base[i].z) * e + lift);
        scaleTarget[i] = 1 + (gridScale - 1) * e;
        tumbleScale = (i === hoverIndex || projT > 0.5) ? 0 : 0.6;
        if (projT > 0.4 && openIndex < 0) {
          // nearly face-on so the projected box stays close to the face size (keeps the grid
          // compact enough to fit and to space rows without the tilt inflating the AABB)
          m.rotation.x += (0.04 - m.rotation.x) * 0.12;
          m.rotation.y += (0.05 - m.rotation.y) * 0.12;
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
        scaleTarget[i] = 1 + (gridScale - 1) * e;
      } else if (tr) {
        // follow the DOM anchor (scrolls with the content); face-on
        const anchor = anchorLocalXY(tr.cx, tr.cy);
        tgt[i].set(anchor.x, anchor.y + bob * 0.3, anchor.z);
        m.rotation.x += (0.35 - m.rotation.x) * 0.2;
        m.rotation.y += (0.5 - m.rotation.y) * 0.2;
        scaleTarget[i] = tr.scale;
      } else if (pt) {
        const e = ease(pt.t);
        let ax = pt.axvw, ay = pt.ayvh, psc = pt.scale, laneAvoid = true;
        if (i === raymondCubeIndex()) {
          // Part D: the Raymond cube parks in the CENTRE of the free band (already clear of the
          // text and the forklift), at the largest scale that fits with 40 px pads (cap 2.4,
          // floor 1.4). No lane avoidance, so it is never shoved off the right edge at 2.4.
          raymondBand();
          const vw = window.innerWidth, vh = window.innerHeight;
          // Use the ACTUAL rendered box (meshBox) to get px-per-scale, so the fit and the
          // on-screen clamp match what the camera draws (projection math via anchorLocalXY
          // ignores the group z offset and mis-sizes it). Converges as the scale eases in.
          const pbx = meshBox(i), curS = Math.max(0.1, m.scale.x);
          const pxPerScale = Math.max(1, Math.max(pbx.w, pbx.h) / curS);
          psc = Math.max(1.0, Math.min(2.4, (Math.min(bandW, bandH) - 80) / pxPerScale));
          laneAvoid = false;
        }
        // emerge from the background ON the park side (fixed x/y, target z travels)
        const anchor = anchorLocalXY(ax, ay);
        tgt[i].set(anchor.x, anchor.y + bob * (1 - e), PARK_START_Z + (PARK_Z - PARK_START_Z) * e);
        scaleTarget[i] = 0.8 + (psc - 0.8) * e;
        tumbleScale = pt.tumble * (1 - 0.7 * e);
        if (i === raymondCubeIndex()) {
          // Keep the whole box on-screen using the ACTUAL rendered box: shift the target in
          // world units by whatever pixels it overflows an edge (converges over a few frames).
          const vw = window.innerWidth, vh = window.innerHeight, cb = meshBox(i);
          const ppw = Math.max(1, cb.w / Math.max(0.1, m.scale.x));   // px per world unit here
          let dx = 0, dy = 0;
          if (cb.x < 10) dx = 10 - cb.x; else if (cb.x + cb.w > vw - 10) dx = (vw - 10) - (cb.x + cb.w);
          if (cb.y < 10) dy = 10 - cb.y; else if (cb.y + cb.h > vh - 10) dy = (vh - 10) - (cb.y + cb.h);
          tgt[i].x += dx / ppw; tgt[i].y += -dy / ppw;   // screen +y is down -> world -y
        }
        // a parked cube may clear text lanes/shapes (projectTargets) but never joins pairwise
        // de-conflict: a screen-filling feature cube cannot be nudged off small cubes without
        // jitter. The Raymond cube skips lane avoidance too (its band centre is already clear).
        _forceable[i] = true; _avoid[i] = laneAvoid; _avoidPair[i] = false;
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
      // a = -2*zeta*omega*vel - omega^2*(pos - target); semi-implicit Euler. A stiffer spring
      // (omega ~8) while a scrubbed section is active so cube motion tracks scroll tightly.
      const om = scrubOn ? 8 : OMEGA;
      _acc.copy(m.position).sub(tgt[i]).multiplyScalar(-om * om);
      _acc.addScaledVector(vel[i], -2 * ZETA * om);
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
    if (srig && scrubOn) { const os = ownerOf(srigIndex); updateScrubRig(hingeAmt(secProg[os]), os); }
    renderer.render(scene, camera);
    updateLabels();
  }

  return {
    frame, setUnravel, setState, focus, raycast, hitTest, setVisibleSet, setPointer, ready,
    cubeBoxes, labelBoxes, chapterPark, setTrack, setExclude, setTextRects, setShapeRects, setLanes, setTargets, exit, recall, chapterDim, setCloudDim, setMobileHide, setForceHidden, meshBox,
    setProjects, setContact, gridSlots, cubeCenters, shapeRectsNow, setHover, openProject, closeProject, projectOpenIndex, faceAnchors, setProjectHandlers,
    setParkAnchor, setRaymondUnfold, setRaymondFaces, raymondFaceRects, raymondFaceAt,
    setSectionProgress, unfoldFaceRects,
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
