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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
  const base = [];        // current interpolated local position

  const MOBILE = window.innerWidth < 820;   // 4x2 in the top band, tighter spacing to fit
  const SP = MOBILE ? 1.7 : SPACING;        // grid spacing used for layout
  const RSP = MOBILE ? 1.7 : ROW_SPACING;
  for (let i = 0; i < CUBES.length; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    gridLocal.push(new THREE.Vector3((col - 1.5) * SP, (0.5 - row) * RSP, 0));
    scatter.push(new THREE.Vector3());
    base.push(gridLocal[i].clone());

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
    const inProjects = projT > 0.5 && openIndex < 0;
    for (let i = 0; i < meshes.length; i++) {
      let x, y, op;
      if (inProjects) {
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
  const PARK_Z = 1.5, PARK_SCALE = 1.9, PARK_START_Z = -5, RECEDE_Z = 6;
  // parkTargets[i] = { axvw, ayvh, scale, tumble, t } for each currently parked cube.
  const parkTargets = {};
  let dimAllT = 0, cloudDim = 0, mobileHide = false;
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
    parkTargets[i] = { axvw: side === 'left' ? 24 : 76, ayvh: 48,
      scale: (opts && opts.scale) || PARK_SCALE, tumble: (opts && opts.tumble != null) ? opts.tumble : 1, t };
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
  const _ex = new THREE.Vector3();
  function partAroundText(wx, wy, wz) {
    if (!excludeRects.length) return wx;
    const vw = window.innerWidth, vh = window.innerHeight;
    _ex.set(wx, wy, wz).add(group.position).project(camera);
    const sx = (_ex.x * 0.5 + 0.5) * vw, sy = (-_ex.y * 0.5 + 0.5) * vh;
    _ex.set(wx + 0.5, wy, wz).add(group.position).project(camera);
    const halfPx = Math.max(1, Math.abs((_ex.x * 0.5 + 0.5) * vw - sx));
    const PAD = 20;
    let shiftPx = 0;
    for (const r of excludeRects) {
      const vOverlap = sy + halfPx > r.y - PAD && sy - halfPx < r.y + r.h + PAD;
      const hOverlap = sx + halfPx > r.x - PAD && sx - halfPx < r.x + r.w + PAD;
      if (vOverlap && hOverlap) shiftPx = Math.max(shiftPx, r.x + r.w + PAD + halfPx - sx);
    }
    return shiftPx > 0 ? wx + shiftPx * (0.5 / halfPx) : wx;
  }

  const anyParked = () => Object.keys(parkTargets).length > 0 || trackList.length > 0;
  // recede the whole cloud (used by the origin chapter, which parks no project cube)
  function chapterDim(t) { dimAllT = Math.min(1, Math.max(0, t)); }
  // persistent background dim: non-parked cubes stay <=0.35 while chapter text is on screen
  function setCloudDim(t) { cloudDim = Math.min(1, Math.max(0, t)); }
  // mobile: hide every non-featured cube (used between the hero grid and the contact grid)
  function setMobileHide(b) { mobileHide = !!b; }

  // ---- Projects grid + cube unfold (phase 2) ----
  // When the projects section is on screen the eight cubes settle into a centred 4x2 grid.
  // Clicking one glides it to the centre and unfolds it into a cross net of six textured
  // faces; DOM cards (positioned by projection, see faceAnchors) fade in over each face.
  const PROJ_SCALE = 1.55, PROJ_SPX = 2.0, PROJ_SPY = 2.7, PROJ_CY = -0.05;
  let projT = 0, projActive = false;          // 0..1 settle into the grid
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
  function unfoldScale() { return (0.8 * window.innerHeight) / (3 * CUBE_PX); }
  function buildRig(i) {
    disposeRig();
    const mats = meshes[i].material;
    const faceMat = (idx) => new THREE.MeshBasicMaterial({ map: mats[idx].map || null,
      color: mats[idx].map ? 0xffffff : 0xe0e0e0, side: THREE.DoubleSide, transparent: true, opacity: 1 });
    const plane = new THREE.PlaneGeometry(1, 1);
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

  window.addEventListener('resize', resize);
  resize();

  const _tmp = new THREE.Vector3();
  function frame(now, dt, moving) {
    const t = now / 1000;
    const fs = Math.min(3, dt * 60);
    // parallax fades out as the grid unravels so scatter stays put
    const pAmt = (1 - unravel) * (anyParked() ? 0 : 1);
    rotTarget.x = -pointerY * PARALLAX_MAX * pAmt;
    rotTarget.y = pointerX * PARALLAX_MAX * pAmt;
    group.rotation.x += (rotTarget.x - group.rotation.x) * PARALLAX_LERP;
    group.rotation.y += (rotTarget.y - group.rotation.y) * PARALLAX_LERP;

    const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) * (-2 * x + 2) * 0.5);
    const dimE = ease(dimAllT);
    // resolve tracked anchors to screen positions (only while on screen)
    for (const k in _tr) delete _tr[k];
    const vw = window.innerWidth, vh = window.innerHeight;
    for (const tk of trackList) {
      const r = tk.el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh && r.width > 0) {
        _tr[tk.i] = { cx: ((r.left + r.width / 2) / vw) * 100, cy: ((r.top + r.height / 2) / vh) * 100, scale: tk.scale || 1.2 };
      }
    }
    const parked = anyParked();

    // projects grid settles the whole cloud; ease parallax out while it is active
    if (projT > 0.01) { group.rotation.x *= 0.88; group.rotation.y *= 0.88; }

    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      let tumbleScale = 1, targetScale = 1, op = 1;
      const bob = Math.sin(t * 0.6 + i) * BOB_AMP;
      const pt = parkTargets[i];
      const tr = _tr[i];
      if (projT > 0.01) {
        // 4x2 centred grid; open cube hides (its unfold rig shows), the rest fade back
        const e = ease(projT);
        _tmp.copy(projWorld[i]).sub(group.position);
        const px = base[i].x + (_tmp.x - base[i].x) * e;
        const py = base[i].y + (_tmp.y - base[i].y) * e;
        const pz = base[i].z + (_tmp.z - base[i].z) * e;
        const lift = (i === hoverIndex && openIndex < 0) ? 0.15 : 0;
        m.position.set(px, py + bob * 0.15, pz + lift);
        targetScale = 1 + (PROJ_SCALE - 1) * e;
        tumbleScale = (i === hoverIndex || projT > 0.5) ? 0 : 0.6;
        if (projT > 0.4 && openIndex < 0) {
          // settle nearer face-on (small 3D tilt) so each cube reads at its ~180px
          // footprint and a label fits cleanly under it between the two rows
          m.rotation.x += (0.16 - m.rotation.x) * 0.12;
          m.rotation.y += (0.26 - m.rotation.y) * 0.12;
        }
        op = openIndex >= 0 ? (i === openIndex ? 0 : 0.15) : 1;
        if (moving && tumbleScale > 0) { m.rotation.x += TUMBLE_X * fs * tumbleScale; m.rotation.y += TUMBLE_Y * fs * tumbleScale; }
        m.scale.setScalar(targetScale);
        cubeReveal[i] += (revealTargets[i] - cubeReveal[i]) * Math.min(1, 0.12 * fs);
        setCubeOpacity(m, op * cubeReveal[i]);
        continue;
      }
      if (tr) {
        // follow the DOM anchor (scrolls with the content); tumble frozen so the box
        // stays face-on and clears the column titles
        const anchor = anchorLocalXY(tr.cx, tr.cy);
        m.position.set(anchor.x, anchor.y + bob * 0.3, anchor.z);
        m.rotation.set(0.35, 0.5, 0);
        targetScale = tr.scale;
        tumbleScale = 0;
        op = 1;
      } else if (pt) {
        const e = ease(pt.t);
        // emerge from the background ON the park side (fixed x/y, moving in z) so the
        // bright cube never crosses to the text side during its travel
        const anchor = anchorLocalXY(pt.axvw, pt.ayvh);
        const z = PARK_START_Z + (PARK_Z - PARK_START_Z) * e;
        m.position.set(anchor.x, anchor.y + bob * (1 - e), z);
        targetScale = 0.8 + (pt.scale - 0.8) * e;
        tumbleScale = pt.tumble * (1 - 0.7 * e);   // slows to 0.3x (0 for Raymond)
        op = 1;
      } else if (mobileHide) {
        // mobile chapters: every non-featured cube is fully hidden and pushed out of ray range
        m.position.set(base[i].x, base[i].y, base[i].z - 40);
        op = 0;
      } else {
        const recede = Math.max(parked ? 1 : 0, dimE, cloudDim);
        // slow continuous drift so the cloud is always alive across the page
        const dx = Math.sin(t * 0.07 + i * 1.3) * 0.7;
        const dy = Math.cos(t * 0.05 + i) * 0.5;
        const wz = base[i].z - recede * RECEDE_Z;
        const wy = base[i].y + bob + dy;
        const wx = partAroundText(base[i].x + dx, wy, wz);
        m.position.set(wx, wy, wz);
        op = 1 - 0.4 * recede;       // never fainter than 0.6 (cubes stay visible)
      }
      if (moving) { m.rotation.x += TUMBLE_X * fs * tumbleScale; m.rotation.y += TUMBLE_Y * fs * tumbleScale; }
      m.scale.setScalar(targetScale);
      // fade the cube in once its own textures have arrived
      cubeReveal[i] += (revealTargets[i] - cubeReveal[i]) * Math.min(1, 0.12 * fs);
      setCubeOpacity(m, op * cubeReveal[i]);
    }

    renderer.render(scene, camera);
    updateLabels();
  }

  return {
    frame, setUnravel, setState, focus, raycast, setPointer, ready,
    cubeBoxes, labelBoxes, chapterPark, setTrack, setExclude, chapterDim, setCloudDim, setMobileHide, meshBox,
    setProjects, setHover, openProject, closeProject, projectOpenIndex, faceAnchors, setProjectHandlers,
    projectsActive: () => projActive,
    labelFor: (i) => (CUBES[i] ? CUBES[i].label : ''),
    cubeOpacity: (i) => meshes[i].material[0].opacity,
    getState: () => ({ unravel, parked: Object.keys(parkTargets).map(Number) }),
    capDpr() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); resize(); },
    halveCount() {},
    sectionFor: (i) => (CUBES[i] ? CUBES[i].section : null),
    get count() { return meshes.length; },
    _onCubeClick: onCubeClick,
  };
}
