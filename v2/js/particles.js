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
  // per-point flag: 1 if this point is part of shape k (so non-shape dust can shrink away)
  const isShape = [new Float32Array(maxCount), new Float32Array(maxCount), new Float32Array(maxCount)];
  const isShapeAttr = isShape.map((arr) => { const at = new THREE.BufferAttribute(arr, 1); at.setUsage(THREE.DynamicDrawUsage); return at; });
  const shapeNorm = [null, null, null];   // normalised source data once fetched
  const shapeLoaded = [false, false, false];

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('aShape0', shapeAttr[0]);
  geom.setAttribute('aShape1', shapeAttr[1]);
  geom.setAttribute('aShape2', shapeAttr[2]);
  geom.setAttribute('aIs0', isShapeAttr[0]);
  geom.setAttribute('aIs1', isShapeAttr[1]);
  geom.setAttribute('aIs2', isShapeAttr[2]);
  geom.setAttribute('aHash', new THREE.BufferAttribute(hash, 1));
  geom.setDrawRange(0, Math.floor(count * HERO_DENSITY));

  const WARP = SCALE * 0.03, WFREQ = 2.4 / SCALE, NOISE = SCALE * 0.9;
  const material = new THREE.PointsMaterial({
    color: 0xb8b8b8, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false,
  });
  const uniforms = { uTime: { value: 0 }, uWarp: { value: WARP }, uFreq: { value: WFREQ }, uNoise: { value: NOISE },
    uMorph0: { value: 0 }, uMorph1: { value: 0 }, uMorph2: { value: 0 } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      'uniform float uTime,uWarp,uFreq,uNoise,uMorph0,uMorph1,uMorph2;\n' +
      'attribute vec3 aShape0; attribute vec3 aShape1; attribute vec3 aShape2; attribute float aHash,aIs0,aIs1,aIs2;\n' +
      'varying float vKeep;\n' +
      shader.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
         float m = clamp(uMorph0 + uMorph1 + uMorph2, 0.0, 1.0);
         // warped attractor, warp fades as the form assembles
         vec3 base = transformed;
         base.x += uWarp * sin(base.y * uFreq + uTime * 0.35) * (1.0 - m);
         base.y += uWarp * cos(base.x * uFreq + uTime * 0.31) * (1.0 - m);
         vec3 pos = base;
         pos = mix(pos, aShape0, uMorph0);
         pos = mix(pos, aShape1, uMorph1);
         pos = mix(pos, aShape2, uMorph2);
         // swirl from dust: peaks mid-transition, zero at both ends
         float swirl = m * (1.0 - m) * 4.0;
         vec3 n = vec3(fract(sin(aHash*91.7)*4372.1), fract(sin(aHash*38.3)*1934.7), fract(sin(aHash*17.1)*271.3)) - 0.5;
         pos += n * uNoise * swirl;
         transformed = pos;
         // background dust (points not in the active shape) shrinks away during morph
         vKeep = clamp(1.0 - uMorph0*(1.0-aIs0) - uMorph1*(1.0-aIs1) - uMorph2*(1.0-aIs2), 0.0, 1.0);`)
        .replace('gl_PointSize = size;', 'gl_PointSize = size * (0.25 + 0.75 * vKeep);');
  };

  const cloud = new THREE.Points(geom, material);
  scene.add(cloud);

  // ---- shape placement (normalised -> world) ----
  const PLACE = {
    0: () => { const hw = visH * aspect() * 0.5; return { s: 0.85 * visH, cx: 0.56 * hw, cy: 0, cz: 0 }; }, // forklift, ~62vh, right 45%
    1: () => ({ s: 0.52 * visH, cx: 0, cy: 0, cz: 0 }),        // slicer stack, centre
    2: () => ({ s: 0.46 * visH, cx: 0, cy: 0, cz: 0 }),        // cube outline, centre
  };
  function placeShape(k) {
    const src = shapeNorm[k]; if (!src) return;
    const p = PLACE[k](); const arr = shapeArrays[k]; const flag = isShape[k]; const M = src.length / 3;
    for (let i = 0; i < M && i < maxCount; i++) {
      arr[i * 3]     = src[i * 3] * p.s + p.cx;
      arr[i * 3 + 1] = src[i * 3 + 1] * p.s + p.cy;
      arr[i * 3 + 2] = src[i * 3 + 2] * p.s + p.cz;
      flag[i] = 1;
    }
    shapeAttr[k].needsUpdate = true;
    isShapeAttr[k].needsUpdate = true;
  }
  function loadShape(k, url) {
    fetch(url).then((r) => r.arrayBuffer()).then((buf) => {
      shapeNorm[k] = new Float32Array(buf);
      placeShape(k); shapeLoaded[k] = true;
    }).catch(() => {});
  }
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
  function morphBox(k) {
    // screen bounding box of shape k's placed points (for the exclusion verifier)
    if (!shapeNorm[k]) return null;
    const p = PLACE[k](); const src = shapeNorm[k]; const M = src.length / 3;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    const w = window.innerWidth, h = window.innerHeight; const v = new THREE.Vector3();
    for (let i = 0; i < M; i += 7) {
      v.set(src[i * 3] * p.s + p.cx, src[i * 3 + 1] * p.s + p.cy, src[i * 3 + 2] * p.s + p.cz).project(camera);
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

  return { frame, halveCount, capDpr, setMorph, morphBox, getCount: () => count };
}
