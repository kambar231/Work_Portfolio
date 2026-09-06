/* cubes.js — the cube hero.
 *
 * A second fixed canvas (z-index 0, pointer-events none) above the particle field and
 * below the DOM text. Eight photo-textured cubes float in a sorted 4x2 grid, each with
 * a soft DOM label under it. The grid unravels into a loose seeded cloud as you scroll
 * the first 120vh (driven from main.js via setUnravel). Clicking a cube scrolls to its
 * chapter (hit-tested with a raycaster from a window click listener in main.js).
 *
 * PUBLIC API (used now by main.js, and by phase 2 for per-chapter travel):
 *   createCubeHero({ onCubeClick }) -> hero
 *   hero.frame(now, dt)          drive one animation frame (called from the master loop)
 *   hero.setUnravel(p)           p in [0,1]: 0 = sorted grid, 1 = scattered cloud.
 *                                lerps every cube base between its grid slot and its
 *                                seeded scatter slot, and fades the labels out by p=0.4.
 *   hero.setState(name)          'sorted' | 'unravelled' — animate to a whole state
 *                                (GSAP is optional; falls back to an instant set).
 *   hero.focus(i)                move cube i to the screen-left anchor at scale 2.2 and
 *                                dim the others (phase-2 FOCUS pose). focus(-1) clears.
 *   hero.raycast(ndc)            returns the hit cube index (or -1) for a click at NDC.
 *   hero.setPointer(nx, ny)      feed normalised cursor (-1..1) for parallax.
 *   hero.halveCount()            no-op hook kept parallel to the particle field.
 *   hero.ready                   Promise that resolves once all face textures loaded.
 *
 * Geometry/material per NIRNOR_STUDY: BoxGeometry 1x1x1, MeshStandardMaterial
 * roughness .85 metalness 0, six face maps cycling the cube's photos; DirectionalLight
 * 1.2 at (-3,4,5) + AmbientLight .6; no shadows, no fog.
 */
import * as THREE from 'three';

const SPACING = 1.6;
const GROUP_Y = 0.9;          // lift the band into the upper-middle of the hero
const BOB_AMP = 0.08;
const TUMBLE_X = 0.0025;      // per 1/60 s
const TUMBLE_Y = 0.004;
const PARALLAX_LERP = 0.06;
const PARALLAX_MAX = 0.15;    // rad

// cube -> photos (square 512 crops in assets/cubes/), soft label, and target section
const CUBES = [
  { label: 'simulate', section: '#polymer',
    photos: ['polymer-phase-sep', 'polymer-1', 'polymer-2', 'polymer-3'] },
  { label: 'make', section: '#casting',
    photos: ['casting-1', 'casting-2', 'casting-3', 'casting-4', 'casting-5'] },
  { label: 'build', section: '#cnc',
    photos: ['cnc-machine', 'cnc-bed', 'cnc-cut-clean', 'cnc-cut-rough', 'cnc-cut-warm'] },
  { label: 'software', section: '#slicer',
    photos: ['slicer-stl-viewer', 'slicer-software', 'slicer-layer-plot', 'slicer-stl-detail'] },
  { label: 'deploy', section: '#raymond',
    photos: ['raymond-forklift.png', 'sens-plus-flyer'] },
  { label: 'print', section: '#others',
    photos: ['motor-wound-pair', 'motor-desk', 'motor-exploded', 'motor-shaft', 'motor-stator'] },
  { label: 'dynamics', section: '#others',
    photos: ['pendulum-1', 'pendulum-2', 'pendulum-3', 'cannon-1', 'cannon-2', 'cannon-3'] },
  { label: 'flight', section: '#others',
    photos: ['flight-1', 'flight-2', 'flight-3', 'flight-dynamics'] },
];

// small deterministic RNG so the scatter is the same every reload
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

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(-3, 4, 5);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const group = new THREE.Group();
  group.position.y = GROUP_Y;
  scene.add(group);

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const loader = new THREE.TextureLoader();
  const loads = [];

  const meshes = [];
  const grid = [];       // grid slot per cube (relative to group)
  const scatter = [];    // seeded scatter slot per cube
  const base = [];       // current base position, lerped grid<->scatter

  const rng = mulberry32(20260905);
  for (let i = 0; i < CUBES.length; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    grid.push(new THREE.Vector3((col - 1.5) * SPACING, (0.5 - row) * SPACING, 0));
    scatter.push(new THREE.Vector3(
      -4 + rng() * 8,          // x [-4, 4]
      -1.5 + rng() * 4,        // y [-1.5, 2.5]
      -2 + rng() * 3           // z [-2, 1]
    ));
    base.push(grid[i].clone());

    const faces = [];
    for (let f = 0; f < 6; f++) {
      const name = CUBES[i].photos[f % CUBES[i].photos.length];
      const file = name.endsWith('.png') ? name : name + '.jpg';
      const mat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.85, metalness: 0 });
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

  // fit the camera so the whole 4x2 grid clears the viewport width with margin
  function fitCamera() {
    const w = window.innerWidth, h = window.innerHeight;
    const aspect = w / h;
    camera.aspect = aspect;
    const gridW = 3 * SPACING + 1.6;   // 4 columns + cube + margin
    const gridH = SPACING + 2.4;
    const fovRad = (45 * Math.PI) / 180;
    const zForH = (gridH / 2) / Math.tan(fovRad / 2);
    const zForW = (gridW / 2) / (Math.tan(fovRad / 2) * aspect);
    camera.position.set(0, 0, Math.max(6.2, zForH, zForW));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    fitCamera();
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- state ----
  let unravel = 0;            // 0 sorted .. 1 scattered
  let labelOpacity = 1;
  let focusIndex = -1;
  let pointerX = 0, pointerY = 0;
  const rotTarget = new THREE.Vector2(0, 0);

  function applyBaseFromUnravel() {
    for (let i = 0; i < meshes.length; i++) {
      base[i].lerpVectors(grid[i], scatter[i], unravel);
    }
  }

  function setUnravel(p) {
    unravel = Math.min(1, Math.max(0, p));
    labelOpacity = 1 - Math.min(1, unravel / 0.4);
    if (focusIndex < 0) applyBaseFromUnravel();
  }

  function setState(name) {
    const g = window.gsap;
    const target = name === 'unravelled' ? 1 : 0;
    focusIndex = -1;
    if (g) {
      g.to({ p: unravel }, {
        p: target, duration: 1.2, ease: 'power3.inOut',
        onUpdate: function () { setUnravel(this.targets()[0].p); },
      });
    } else {
      setUnravel(target);
    }
  }

  function focus(i) {
    focusIndex = i;
    const g = window.gsap;
    if (i < 0) { applyBaseFromUnravel(); return; }
    const anchor = new THREE.Vector3(-3.0, 0, 1.2);
    for (let k = 0; k < meshes.length; k++) {
      const dest = k === i ? anchor : scatter[k];
      const scl = k === i ? 2.2 : 1;
      const dim = k === i ? 1 : 0.35;
      if (g) {
        g.to(base[k], { x: dest.x, y: dest.y, z: dest.z, duration: 1.2, ease: 'power3.inOut' });
        g.to(meshes[k].scale, { x: scl, y: scl, z: scl, duration: 1.2, ease: 'power3.inOut' });
      } else {
        base[k].copy(dest); meshes[k].scale.setScalar(scl);
      }
      meshes[k].userData.dim = dim;
    }
    labelOpacity = 0;
  }

  function setPointer(nx, ny) { pointerX = nx; pointerY = ny; }

  const raycaster = new THREE.Raycaster();
  function raycast(ndc) {
    raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
    const hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) return -1;
    return meshes.indexOf(hits[0].object);
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
  const projected = new THREE.Vector3();

  function updateLabels() {
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = 0; i < meshes.length; i++) {
      meshes[i].getWorldPosition(projected);
      projected.y -= 0.62;                 // sit just under the cube
      projected.project(camera);
      const x = (projected.x * 0.5 + 0.5) * w;
      const y = (-projected.y * 0.5 + 0.5) * h;
      const el = labelEls[i];
      const op = labelOpacity * (projected.z < 1 ? 1 : 0);
      el.style.opacity = op.toFixed(3);
      el.style.transform = `translate(-50%, 0) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }

  function frame(now, dt, moving) {
    const t = now / 1000;
    const fs = Math.min(3, dt * 60);       // frame scale vs 60fps, clamped

    // cursor parallax on the whole group
    rotTarget.x = -pointerY * PARALLAX_MAX;
    rotTarget.y = pointerX * PARALLAX_MAX;
    group.rotation.x += (rotTarget.x - group.rotation.x) * PARALLAX_LERP;
    group.rotation.y += (rotTarget.y - group.rotation.y) * PARALLAX_LERP;

    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      if (moving) {
        m.rotation.x += TUMBLE_X * fs;
        m.rotation.y += TUMBLE_Y * fs;
      }
      const bob = Math.sin(t * 0.6 + i) * BOB_AMP;
      m.position.set(base[i].x, base[i].y + bob, base[i].z);
    }

    renderer.render(scene, camera);
    updateLabels();
  }

  return {
    frame, setUnravel, setState, focus, raycast, setPointer, ready,
    halveCount() {},
    sectionFor: (i) => (CUBES[i] ? CUBES[i].section : null),
    get count() { return meshes.length; },
    _onCubeClick: onCubeClick,
  };
}
