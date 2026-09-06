/* particles.js — the signature background field + morph engine (round 2).
 *
 * A full-viewport fixed THREE.Points cloud (z-index -1). Every point sits ON the de Jong
 * strange attractor's invariant set, baked once, so the cloud reads as bold pencil-dust
 * ribbons (compare docs/nirnor-study/lead-film/frame_013.jpg). 160k points, size 1.6,
 * colour #b8b8b8, density floor 70%.
 *
 * MORPH ENGINE. Each point carries three shape targets (aShape0 forklift, aShape1 slicer
 * stack, aShape2 cube outline) plus a per-point hash (aHash). The vertex shader mixes the
 * warped attractor position toward shape k by uMorph[k] (clamped sum), and adds a
 * per-point swirl that peaks mid-transition (m*(1-m)) so the form ASSEMBLES FROM DUST and
 * dissolves back. Shape targets are sampled at build time by v2/assets/img/_gen_shapes.py
 * into v2/assets/shapes/*.bin (raw Float32 xyz, normalised height 1); they are fetched
 * lazily and placed into world space here (forklift = 62vh tall on the right 45%).
 *
 * Only one shape is active at a time; uMorph[k] is driven by a ScrollTrigger per section.
 */
import * as THREE from 'three';

const A0 = 1.4, B0 = -2.3, C0 = 2.4, D0 = -2.1;
const FOV = 50;
const CAM_D = 450;
const FILL = 1.3;
const ATTR_SPAN = 3.6;
const HERO_DENSITY = 0.70;

export function createParticles(opts = {}) {
  const staticDensity = opts.staticDensity;
  const canvas = document.createElement('canvas');
  canvas.id = 'particles-canvas';
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 5000);
  camera.position.z = CAM_D;

  const visH = 2 * CAM_D * Math.tan((FOV * Math.PI / 180) / 2);   // world height the camera frames
  function aspect() { return window.innerWidth / window.innerHeight; }
  const SCALE = (FILL * Math.max(visH * (window.innerWidth / window.innerHeight), visH)) / ATTR_SPAN;

  const maxCount = window.innerWidth < 820 ? 45000 : 160000;
  let count = maxCount;

  // bake the attractor onto the buffer
  const positions = new Float32Array(maxCount * 3);
  const hash = new Float32Array(maxCount);
  let a = A0, b = B0, c = C0, d = D0;
  const sx = new Float32Array(maxCount), sy = new Float32Array(maxCount);
  for (let i = 0; i < maxCount; i++) { sx[i] = (Math.random() * 2 - 1) * 2; sy[i] = (Math.random() * 2 - 1) * 2; hash[i] = Math.random(); }
  for (let s = 0; s < 30; s++) {
    for (let i = 0; i < maxCount; i++) {
      const nx = Math.sin(a * sy[i]) - Math.cos(b * sx[i]);
      const ny = Math.sin(c * sx[i]) - Math.cos(d * sy[i]);
      sx[i] = nx; sy[i] = ny;
    }
  }
  for (let i = 0; i < maxCount; i++) {
    positions[i * 3] = sx[i] * SCALE;
    positions[i * 3 + 1] = sy[i] * SCALE;
    positions[i * 3 + 2] = 0;
  }

  // shape target buffers default to each point's own attractor position (identity morph)
  const shapeArrays = [new Float32Array(positions), new Float32Array(positions), new Float32Array(positions)];
  const shapeAttr = shapeArrays.map((arr) => { const at = new THREE.BufferAttribute(arr, 3); at.setUsage(THREE.DynamicDrawUsage); return at; });
  // per-point flag for shape k: 0 = not in the shape (background dust), 1 = FILL point,
  // 2 = EDGE point. Drives per-class colour + size and lets non-shape dust fade away.
  const flag = [new Float32Array(maxCount), new Float32Array(maxCount), new Float32Array(maxCount)];
  const flagAttr = flag.map((arr) => { const at = new THREE.BufferAttribute(arr, 1); at.setUsage(THREE.DynamicDrawUsage); return at; });
  const shapeNorm = [null, null, null];   // normalised source data once fetched (stride 4: x,y,z,cls)
  const shapeLoaded = [false, false, false];
  const shapeBounds = [null, null, null]; // {maxx} of the normalised shape, for placement

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('aShape0', shapeAttr[0]);
  geom.setAttribute('aShape1', shapeAttr[1]);
  geom.setAttribute('aShape2', shapeAttr[2]);
  geom.setAttribute('aFlag0', flagAttr[0]);
  geom.setAttribute('aFlag1', flagAttr[1]);
  geom.setAttribute('aFlag2', flagAttr[2]);
  geom.setAttribute('aHash', new THREE.BufferAttribute(hash, 1));
  geom.setDrawRange(0, Math.floor(count * HERO_DENSITY));

  const WARP = SCALE * 0.03, WFREQ = 2.4 / SCALE, NOISE = SCALE * 0.9;
  const material = new THREE.PointsMaterial({
    color: 0xffffff, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false,
  });
  const uniforms = { uTime: { value: 0 }, uWarp: { value: WARP }, uFreq: { value: WFREQ }, uNoise: { value: NOISE },
    uMorph0: { value: 0 }, uMorph1: { value: 0 }, uMorph2: { value: 0 },
    // slice stack builds bottom-first: shape-1 points below uReveal1 (fraction of stack height) are placed
    uReveal1: { value: 1 }, uSliceLo: { value: -1 }, uSliceHi: { value: 1 } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    // vertex: warp -> morph -> swirl, plus per-class colour/size and background dimming
    shader.vertexShader =
      'uniform float uTime,uWarp,uFreq,uNoise,uMorph0,uMorph1,uMorph2,uReveal1,uSliceLo,uSliceHi;\n' +
      'attribute vec3 aShape0; attribute vec3 aShape1; attribute vec3 aShape2; attribute float aHash,aFlag0,aFlag1,aFlag2;\n' +
      'varying vec3 vCol; varying float vOpa;\n' +
      shader.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
         // slice stack builds bottom ring first: a shape-1 point is placed only once the
         // build line uReveal1 has risen past its height fraction within the stack.
         float hFrac1 = clamp((aShape1.y - uSliceLo) / max(0.0001, uSliceHi - uSliceLo), 0.0, 1.0);
         float built1 = aFlag1 > 0.5 ? step(hFrac1, uReveal1) : 1.0;
         float uM1 = uMorph1 * built1;
         float m = clamp(uMorph0 + uM1 + uMorph2, 0.0, 1.0);
         // warped attractor, warp fades as the form assembles
         vec3 base = transformed;
         base.x += uWarp * sin(base.y * uFreq + uTime * 0.35) * (1.0 - m);
         base.y += uWarp * cos(base.x * uFreq + uTime * 0.31) * (1.0 - m);
         vec3 pos = base;
         pos = mix(pos, aShape0, uMorph0);
         pos = mix(pos, aShape1, uM1);
         pos = mix(pos, aShape2, uMorph2);
         // swirl from dust: peaks mid-transition, ZERO at both ends (so a formed shape is crisp)
         float swirl = m * (1.0 - m) * 2.6;
         vec3 n = vec3(fract(sin(aHash*91.7)*4372.1), fract(sin(aHash*38.3)*1934.7), fract(sin(aHash*17.1)*271.3)) - 0.5;
         pos += n * uNoise * swirl;
         transformed = pos;
         // active shape = the one being morphed to (morphs are exclusive); pick its flag + amount
         // (shape 1 uses the height-gated amount so un-built rings stay as dust)
         float mA = max(max(uMorph0, uM1), uMorph2);
         float flag = uMorph0 >= mA ? aFlag0 : (uM1 >= mA ? aFlag1 : aFlag2);
         float inShape = step(0.5, flag);          // 1 = fill or edge point of the active shape
         float isEdge  = step(1.5, flag);          // 1 = edge point
         // colour: dust -> per-class shape colour as the morph proceeds
         vec3 DUST = vec3(0.722), FILLC = vec3(0.769), EDGEC = vec3(0.200);
         vec3 shapeCol = mix(FILLC, EDGEC, isEdge);
         vCol = mix(DUST, shapeCol, inShape * mA);
         // size: 1.6 dust -> 1.3 fill / 1.9 edge
         float shapeSz = mix(1.3, 1.9, isEdge);
         float sz = mix(size, shapeSz, inShape * mA);
         // background dust drops to 15% opacity once the morph is past 0.4, so the silhouette stands alone
         float dim = (1.0 - inShape) * smoothstep(0.4, 0.6, mA);
         vOpa = mix(1.0, 0.15, dim);`)
        .replace('gl_PointSize = size;', 'gl_PointSize = sz;');
    // fragment: multiply in the per-vertex colour and opacity
    shader.fragmentShader =
      'varying vec3 vCol; varying float vOpa;\n' +
      shader.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );',
        'vec4 diffuseColor = vec4( diffuse * vCol, opacity * vOpa );');
  };

  const cloud = new THREE.Points(geom, material);
  scene.add(cloud);

  // ---- shape placement (normalised -> world) ----
  // shapes are stored height 1, centred; forklift sits ~64vh tall with its right edge at 92vw.
  const PLACE = {
    0: () => {
      const halfW = visH * aspect() * 0.5;
      const s = 0.64 * visH;
      const maxx = shapeBounds[0] ? shapeBounds[0].maxx : 0.4;
      return { s, cx: 0.84 * halfW - maxx * s, cy: 0, cz: 0 };   // right edge at 92vw
    },
    1: () => { const halfW = visH * aspect() * 0.5; return { s: 0.62 * visH, cx: 0.5 * halfW, cy: 0, cz: 0 }; }, // slice stack, right 45%
    2: () => ({ s: 0.46 * visH, cx: 0, cy: 0, cz: 0 }),        // cube outline, centre
  };
  const slicePlace = { lo: -1, hi: 1, cx: 0, cz: 0, s: 1 };
  function placeShape(k) {
    const src = shapeNorm[k]; if (!src) return;
    const p = PLACE[k](); const arr = shapeArrays[k]; const fl = flag[k]; const M = src.length / 4;
    for (let i = 0; i < M && i < maxCount; i++) {
      arr[i * 3]     = src[i * 4] * p.s + p.cx;
      arr[i * 3 + 1] = src[i * 4 + 1] * p.s + p.cy;
      arr[i * 3 + 2] = src[i * 4 + 2] * p.s + p.cz;
      fl[i] = src[i * 4 + 3] > 0.5 ? 2 : 1;   // 2 = edge, 1 = fill
    }
    shapeAttr[k].needsUpdate = true;
    flagAttr[k].needsUpdate = true;
    if (k === 1) {
      // world-y bounds of the slice stack, for the bottom-first build gate + the hairline
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < M && i < maxCount; i++) { const y = arr[i * 3 + 1]; if (y < lo) lo = y; if (y > hi) hi = y; }
      slicePlace.lo = lo; slicePlace.hi = hi; slicePlace.cx = p.cx; slicePlace.cz = p.cz; slicePlace.s = p.s;
      uniforms.uSliceLo.value = lo; uniforms.uSliceHi.value = hi;
    }
  }
  let forcedK = -1;   // shape-debug: force this morph to 1 once its data is placed
  function loadShape(k, url) {
    fetch(url).then((r) => r.arrayBuffer()).then((buf) => {
      const src = new Float32Array(buf);
      shapeNorm[k] = src;
      let maxx = 0; const M = src.length / 4;
      for (let i = 0; i < M; i++) { const x = src[i * 4]; if (x > maxx) maxx = x; }
      shapeBounds[k] = { maxx };
      placeShape(k); shapeLoaded[k] = true;
      if (forcedK === k) uniforms['uMorph' + k].value = 1;   // apply a pending debug force
    }).catch(() => {});
  }
  // shape-debug (?shape=): force one morph fully on (applied now or when its data lands)
  function forceShape(k) { forcedK = k; if (shapeLoaded[k]) { uniforms['uMorph' + k].value = 1; if (k === 1) uniforms.uReveal1.value = 1; } }
  loadShape(0, 'assets/shapes/forklift.bin');
  loadShape(1, 'assets/shapes/slicer.bin');
  loadShape(2, 'assets/shapes/cube.bin');

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = aspect();
    camera.updateProjectionMatrix();
    for (let k = 0; k < 3; k++) if (shapeLoaded[k]) placeShape(k);
  }
  resize();
  window.addEventListener('resize', resize);

  let halved = false;

  function setMorph(k, v) {
    v = shapeLoaded[k] ? Math.min(1, Math.max(0, v)) : 0;   // never morph to an unloaded shape
    uniforms['uMorph' + k].value = v;
  }
  const SLICE_RINGS = 40;
  function setSliceReveal(v) { uniforms.uReveal1.value = Math.min(1, Math.max(0, v)); }
  function sliceTop() {
    // screen y of the current top built ring + its ring index, for the DOM layer hairline
    const rev = uniforms.uReveal1.value;
    const topY = slicePlace.lo + rev * (slicePlace.hi - slicePlace.lo);
    const v = new THREE.Vector3(slicePlace.cx, topY, slicePlace.cz).project(camera);
    return { y: (-v.y * 0.5 + 0.5) * window.innerHeight, ring: Math.max(1, Math.round(rev * SLICE_RINGS)), rings: SLICE_RINGS };
  }
  function morphBox(k) {
    // screen bounding box of shape k's placed points (for the exclusion verifier)
    if (!shapeNorm[k]) return null;
    const p = PLACE[k](); const src = shapeNorm[k]; const M = src.length / 4;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    const w = window.innerWidth, h = window.innerHeight; const v = new THREE.Vector3();
    for (let i = 0; i < M; i += 7) {
      v.set(src[i * 4] * p.s + p.cx, src[i * 4 + 1] * p.s + p.cy, src[i * 4 + 2] * p.s + p.cz).project(camera);
      const X = (v.x * 0.5 + 0.5) * w, Y = (-v.y * 0.5 + 0.5) * h;
      minx = Math.min(minx, X); maxx = Math.max(maxx, X); miny = Math.min(miny, Y); maxy = Math.max(maxy, Y);
    }
    return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
  }

  function frame(now, dt, scrollProgress, moving) {
    if (moving) uniforms.uTime.value = now / 1000;
    const frac = staticDensity != null
      ? staticDensity
      : HERO_DENSITY + (1 - HERO_DENSITY) * Math.min(1, Math.max(0, scrollProgress));
    geom.setDrawRange(0, Math.floor(count * frac));
    renderer.render(scene, camera);
  }

  function halveCount() { if (!halved) { halved = true; count = Math.floor(count / 2); } }
  function capDpr() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); resize(); }

  return { frame, halveCount, capDpr, setMorph, morphBox, setSliceReveal, sliceTop, forceShape,
    morphVal: (k) => uniforms['uMorph' + k].value, getCount: () => count };
}
