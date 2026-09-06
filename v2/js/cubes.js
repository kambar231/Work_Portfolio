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
const MAX_PX_FRAME = 14;             // no cube's projected centre moves > 14 px per 1/60 s
const CUBE_SHRINK = 0.68;            // inscribed footprint (matches verify_all.py)
const REPULSE_GAIN = 8.0;            // cube-cube soft repulsion (1/s)
const LANE_GAIN = 12.0;             // lane / shape avoidance (1/s)
const LANE_PAD = 40, SHAPE_PAD = 34; // screen px pad around soft lanes / hard shape rects

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

  // ---- cube-cube overlap resolution ----
  // After all cubes are positioned, push any overlapping pair apart so no two projected
  // bounding boxes intersect. Uses the axis of least penetration (MTV), depth-weighted so
  // the nearer cube (larger world z) yields less. Runs every frame for the drift, parked,
  // grid and contact states (never the open unfold cube). Positions are nudged so the
  // rendered frame is always overlap-free.
  const _c0 = new THREE.Vector3(), _c1 = new THREE.Vector3();
  const _sc = new Array(CUBES.length).fill(null);
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
  // Soft forces: add cube-cube repulsion and lane/shape avoidance to VELOCITY (never a
  // position write). Called each frame before integration. Only drifting cubes (forceable)
  // receive a push; grid/park/track cubes keep their authoritative spring targets but still
  // act as repulsors so drifters part around them. Settled grids are non-overlapping targets
  // so forces are skipped there (they would fight the exact slots).
  function computeForces(dtc, forceable) {
    if (projT > 0.5 || contactT > 0.5) return;
    const n = gatherBoxes();
    if (n < 1) return;
    for (let a = 0; a < meshes.length; a++) {
      const A = _sc[a]; if (!A || !forceable[a]) continue;
      // cube-cube repulsion on the inscribed footprint, with a smooth (linear) falloff
      for (let b = 0; b < meshes.length; b++) {
        if (b === a) continue;
        const B = _sc[b]; if (!B) continue;
        const dx = A.cx - B.cx, dy = A.cy - B.cy;
        const ox = (A.hx + B.hx) * CUBE_SHRINK + OVERLAP_MARGIN - Math.abs(dx);
        const oy = (A.hy + B.hy) * CUBE_SHRINK + OVERLAP_MARGIN - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;              // no footprint overlap -> no force
        // push A along the axis of least penetration, away from B
        if (ox < oy) vel[a].x += ((dx >= 0 ? ox : -ox) / A.ppu) * REPULSE_GAIN * dtc;
        else         vel[a].y += (-(dy >= 0 ? oy : -oy) / A.ppu) * REPULSE_GAIN * dtc;
      }
      // lane avoidance: text columns are soft lanes (steer sideways to the nearest free
      // side); morph shapes are hard lanes with a larger pad and full MTV push-out.
      const hxS = A.hx * CUBE_SHRINK, hyS = A.hy * CUBE_SHRINK;
      const softLanes = excludeRects.length ? excludeRects : textRects;
      for (const r of softLanes) {
        const L = A.cx - (r.x - hxS - LANE_PAD), R = (r.x + r.w + hxS + LANE_PAD) - A.cx;
        const T = A.cy - (r.y - hyS - LANE_PAD), Bp = (r.y + r.h + hyS + LANE_PAD) - A.cy;
        if (L <= 0 || R <= 0 || T <= 0 || Bp <= 0) continue;   // not over the column
        const shift = L < R ? -L : R;                          // out the nearer side
        vel[a].x += (shift / A.ppu) * LANE_GAIN * dtc;
      }
      for (const r of shapeRects) {
        const L = A.cx - (r.x - hxS - SHAPE_PAD), R = (r.x + r.w + hxS + SHAPE_PAD) - A.cx;
        const T = A.cy - (r.y - hyS - SHAPE_PAD), Bp = (r.y + r.h + hyS + SHAPE_PAD) - A.cy;
        if (L <= 0 || R <= 0 || T <= 0 || Bp <= 0) continue;
        const mn = Math.min(L, R, T, Bp);
        if (mn === L)       vel[a].x += (-L / A.ppu) * LANE_GAIN * dtc;
        else if (mn === R)  vel[a].x += (R / A.ppu) * LANE_GAIN * dtc;
        else if (mn === T)  vel[a].y += (T / A.ppu) * LANE_GAIN * dtc;   // screen up = +local y
        else                vel[a].y += (-Bp / A.ppu) * LANE_GAIN * dtc;
      }
    }
  }

  // a target 1.3x past the nearest horizontal viewport edge (an exit lane the cube drifts
  // out to and holds, so a hidden cube leaves by position, never by opacity)
  function exitTargetLocal(i) {
    meshes[i].getWorldPosition(_c0); _c0.project(camera);
    const ndcX = _c0.x >= 0 ? 1.3 : -1.3;
    const z = base[i].z;
    const halfW = (camera.position.z - z) * tanHalf() * camera.aspect;
    return { x: ndcX * halfW - group.position.x, y: base[i].y, z };
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
      _opArr[i] = 1; _forceable[i] = false;
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
        _forceable[i] = !ov.parked;
        if (moving && !ov.parked) { m.rotation.x += TUMBLE_X * fs; m.rotation.y += TUMBLE_Y * fs; }
      } else {
        // free drift: slow sine wander around the unravel home; a slow tumble via angVel
        const dx = Math.sin(t * 0.07 + i * 1.3) * 0.7;
        const dy = Math.cos(t * 0.05 + i) * 0.5;
        tgt[i].set(base[i].x + dx, base[i].y + bob + dy, base[i].z);
        scaleTarget[i] = 1;
        _forceable[i] = true;
        const damp = Math.min(1, 4 * dtc);
        angVel[i].x += (TUMBLE_X * 60 - angVel[i].x) * damp;
        angVel[i].y += (TUMBLE_Y * 60 - angVel[i].y) * damp;
        if (moving) { m.rotation.x += angVel[i].x * dtc; m.rotation.y += angVel[i].y * dtc; }
      }
    }

    // ---- soft forces (repulsion + lanes) added to velocity, never position ----
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

    renderer.render(scene, camera);
    updateLabels();
  }

  return {
    frame, setUnravel, setState, focus, raycast, setPointer, ready,
    cubeBoxes, labelBoxes, chapterPark, setTrack, setExclude, setTextRects, setShapeRects, setLanes, setTargets, exit, recall, chapterDim, setCloudDim, setMobileHide, setForceHidden, meshBox,
    setProjects, setContact, gridSlots, cubeCenters, shapeRectsNow, setHover, openProject, closeProject, projectOpenIndex, faceAnchors, setProjectHandlers,
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
