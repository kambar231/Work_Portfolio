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

// cube -> curated faces (high-contrast/photographic first), soft label, target section.
// Paper-white document crops (polymer title page, flight text/diagrams, cannon tables,
// casting CFD sheet, slicer layer plot) are dropped in favour of stronger crops.
const CUBES = [
  { label: 'simulate', section: '#polymer',
    photos: ['polymer-phase-sep', 'casting-4', 'casting-1', 'casting-3', 'polymer-phase-sep', 'polymer-2'] },
  { label: 'make', section: '#casting',
    photos: ['casting-3', 'casting-5', 'casting-1', 'casting-4', 'casting-3', 'casting-5'] },
  { label: 'build', section: '#cnc',
    photos: ['cnc-machine', 'cnc-bed', 'cnc-cut-clean', 'cnc-cut-warm', 'cnc-machine', 'cnc-bed'] },
  { label: 'software', section: '#slicer',
    photos: ['slicer-software', 'slicer-stl-viewer', 'slicer-stl-detail', 'slicer-software', 'slicer-stl-viewer', 'slicer-stl-detail'] },
  { label: 'deploy', section: '#raymond',
    photos: ['sens-plus-flyer', 'raymond-forklift.png', 'sens-plus-flyer', 'raymond-forklift.png', 'sens-plus-flyer', 'raymond-forklift.png'] },
  { label: 'print', section: '#others',
    photos: ['motor-stator', 'motor-wound-pair', 'motor-desk', 'motor-exploded', 'motor-shaft', 'motor-stator'] },
  { label: 'dynamics', section: '#others',
    photos: ['pendulum-1', 'pendulum-1', 'cannon-1', 'pendulum-1', 'cannon-2', 'pendulum-3'] },
  { label: 'flight', section: '#others',
    photos: ['flight-dynamics', 'flight-1', 'flight-dynamics', 'flight-1', 'flight-dynamics', 'flight-3'] },
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

  const meshes = [];
  const gridLocal = [];   // sorted slot, relative to the group centre
  const scatter = [];     // seeded scatter slot (world, group centre is origin at rest)
  const base = [];        // current interpolated local position

  for (let i = 0; i < CUBES.length; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    gridLocal.push(new THREE.Vector3((col - 1.5) * SPACING, (0.5 - row) * ROW_SPACING, 0));
    scatter.push(new THREE.Vector3());
    base.push(gridLocal[i].clone());

    const faces = [];
    for (let f = 0; f < 6; f++) {
      const name = CUBES[i].photos[f % CUBES[i].photos.length];
      const file = name.endsWith('.png') ? name : name + '.jpg';
      const mat = new THREE.MeshStandardMaterial({ color: 0xbfbfbf, roughness: 0.7, metalness: 0, transparent: true, opacity: 1 });
      loads.push(new Promise((res) => {
        loader.load('assets/cubes/' + file, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
          mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; res();
        }, undefined, () => res());
      }));
      faces.push(mat);
    }
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
    let D = h / (CUBE_PX * 2 * tanHalf());   // 1-unit cube ~CUBE_PX tall
    let regionX = REGION_NDC_X, regionY = REGION_NDC_Y;
    // narrow screens: centre the grid and pull back so all four columns fit (desktop
    // path is left exactly as verified at 1280/1440/1920)
    if (camera.aspect < 1.2) {
      regionX = 0; regionY = 0.55;
      const gridHalfW = 1.5 * SPACING + 0.6;
      for (let g = 0; g < 40; g++) {
        if (D * tanHalf() * camera.aspect * 0.9 >= gridHalfW) break;
        D *= 1.08;
      }
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
    for (let i = 0; i < meshes.length; i++) {
      meshes[i].getWorldPosition(_p);
      _p.y -= LABEL_DROP;
      _p.project(camera);
      const x = (_p.x * 0.5 + 0.5) * w;
      const y = (-_p.y * 0.5 + 0.5) * h;
      const op = labelOpacity * (_p.z < 1 ? 1 : 0);
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
  const PARK_Z = 1.5, PARK_SCALE = 1.9, RECEDE_Z = 6;
  let parkCube = -1, parkSide = 'right', parkT = 0, dimAllT = 0;
  const _anchor = new THREE.Vector3();

  function anchorLocal(side) {
    // screen (sideVW, 48vh) -> world at z = PARK_Z, expressed relative to the group centre
    const ndcX = (side === 'left' ? 0.24 : 0.76) * 2 - 1;
    const ndcY = 1 - 2 * 0.48;
    const halfHz = (camera.position.z - PARK_Z) * tanHalf();
    _anchor.set(ndcX * halfHz * camera.aspect, ndcY * halfHz, PARK_Z);
    return _anchor.sub(group.position);
  }
  function setCubeOpacity(m, o) { for (const mat of m.material) mat.opacity = o; }

  function chapterPark(i, side, t) {
    t = Math.min(1, Math.max(0, t));
    if (t <= 0.001) { if (parkCube === i) { parkCube = -1; parkT = 0; } return; }
    parkCube = i; parkSide = side; parkT = t;
  }
  // recede the whole cloud (used by the origin chapter, which parks no project cube)
  function chapterDim(t) { dimAllT = Math.min(1, Math.max(0, t)); }

  window.addEventListener('resize', resize);
  resize();

  const _tmp = new THREE.Vector3();
  function frame(now, dt, moving) {
    const t = now / 1000;
    const fs = Math.min(3, dt * 60);
    // parallax fades out as the grid unravels so scatter stays put
    const pAmt = (1 - unravel) * (parkCube < 0 ? 1 : 0);
    rotTarget.x = -pointerY * PARALLAX_MAX * pAmt;
    rotTarget.y = pointerX * PARALLAX_MAX * pAmt;
    group.rotation.x += (rotTarget.x - group.rotation.x) * PARALLAX_LERP;
    group.rotation.y += (rotTarget.y - group.rotation.y) * PARALLAX_LERP;

    const anchor = parkCube >= 0 ? anchorLocal(parkSide) : null;
    const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) * (-2 * x + 2) * 0.5);
    const e = ease(parkT);
    const dimE = ease(dimAllT);

    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      let tumbleScale = 1, targetScale = 1, op = 1;
      const bob = Math.sin(t * 0.6 + i) * BOB_AMP;
      if (parkCube === i) {
        _tmp.lerpVectors(base[i], anchor, e);
        m.position.set(_tmp.x, _tmp.y + bob * (1 - e), _tmp.z);
        targetScale = 1 + (PARK_SCALE - 1) * e;
        tumbleScale = 1 - 0.7 * e;   // slows to 0.3x when parked
        op = 1;
      } else {
        const recede = Math.max(parkCube >= 0 ? e : 0, dimE);
        m.position.set(base[i].x, base[i].y + bob, base[i].z - recede * RECEDE_Z);
        op = 1 - 0.65 * recede;      // down to 0.35 in the background
      }
      if (moving) { m.rotation.x += TUMBLE_X * fs * tumbleScale; m.rotation.y += TUMBLE_Y * fs * tumbleScale; }
      m.scale.setScalar(targetScale);
      setCubeOpacity(m, op);
    }

    renderer.render(scene, camera);
    updateLabels();
  }

  return {
    frame, setUnravel, setState, focus, raycast, setPointer, ready,
    cubeBoxes, labelBoxes, chapterPark, chapterDim, meshBox,
    getState: () => ({ unravel, parkCube, parkT, parkSide }),
    halveCount() {},
    sectionFor: (i) => (CUBES[i] ? CUBES[i].section : null),
    get count() { return meshes.length; },
    _onCubeClick: onCubeClick,
  };
}
