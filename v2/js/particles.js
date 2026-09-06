/* particles.js — the signature background field.
 *
 * A full-viewport fixed THREE.Points cloud (z-index -1). Every point sits ON the de
 * Jong strange attractor's invariant set, so the cloud reads as the crisp multi-lobe
 * pencil-dust ribbons of docs/nirnor-study/lead-film/frame_013.jpg (and dj.png), not as
 * speckle. The set is baked into the buffer ONCE; motion is a GPU vertex-shader warp
 * (uTime) plus a slow global rotation, so we can afford a high point count (120k) for
 * dense, continuous-looking ribbons while keeping the per-frame CPU cost near zero.
 *
 * FINAL ATTRACTOR PARAMETERS (tuned by eye against frame_013.jpg; render in dj.png):
 *   de Jong map:  x' = sin(a*y) - cos(b*x),  y' = sin(c*x) - cos(d*y)
 *   base params:  a = 1.4,  b = -2.3,  c = 2.4,  d = -2.1
 *   points:       120000 (36000 under 760px), burned in 40 iterations onto the set.
 *   warp:         vertex shader displaces each point by ~WARP world units along smooth
 *                 sin/cos of its position + uTime, so whole ribbons undulate like smoke.
 *   rotation:     0.02 rad/s about the view axis (visible drift, not a spin).
 *   world map:    attractor (~[-2,2]) * SCALE fills ~1.3x the larger viewport dimension.
 *   look:         PointsMaterial size 1.3, sizeAttenuation, colour #d9d9d9, opacity .8.
 *
 * Density is tied to scroll via the draw range: 55% of points at the hero, 100% at the
 * bottom of the page.
 */
import * as THREE from 'three';

const A0 = 1.4, B0 = -2.3, C0 = 2.4, D0 = -2.1;
const FOV = 50;
const CAM_D = 450;
const FILL = 1.3;
const ATTR_SPAN = 3.6;
const ROT_SPEED = 0.02;              // rad/s global rotation
const HERO_DENSITY = 0.55;

export function createParticles() {
  const canvas = document.createElement('canvas');
  canvas.id = 'particles-canvas';
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 5000);
  camera.position.z = CAM_D;

  let SCALE = 140;
  function computeScale() {
    const aspect = window.innerWidth / window.innerHeight;
    const visH = 2 * CAM_D * Math.tan((FOV * Math.PI / 180) / 2);
    const visW = visH * aspect;
    SCALE = (FILL * Math.max(visW, visH)) / ATTR_SPAN;
  }
  computeScale();

  const maxCount = window.innerWidth < 760 ? 36000 : 120000;
  let count = maxCount;

  // bake the attractor set into the position buffer once (independent seeds -> the first
  // N of any draw range still sample the whole set)
  const positions = new Float32Array(maxCount * 3);
  let a = A0, b = B0, c = C0, d = D0;
  const sx = new Float32Array(maxCount), sy = new Float32Array(maxCount);
  for (let i = 0; i < maxCount; i++) { sx[i] = (Math.random() * 2 - 1) * 2; sy[i] = (Math.random() * 2 - 1) * 2; }
  for (let s = 0; s < 40; s++) {
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

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setDrawRange(0, Math.floor(count * HERO_DENSITY));

  const WARP = SCALE * 0.03;          // warp amplitude in world units (~4)
  const WFREQ = 2.4 / SCALE;          // spatial frequency so neighbours move together
  const material = new THREE.PointsMaterial({
    color: 0xd9d9d9, size: 1.3, sizeAttenuation: true,
    transparent: true, opacity: 0.8, depthWrite: false,
  });
  let shaderRef = null;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWarp = { value: WARP };
    shader.uniforms.uFreq = { value: WFREQ };
    shader.vertexShader = 'uniform float uTime;\nuniform float uWarp;\nuniform float uFreq;\n' +
      shader.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
         transformed.x += uWarp * sin(transformed.y * uFreq + uTime * 0.35);
         transformed.y += uWarp * cos(transformed.x * uFreq + uTime * 0.31);`);
    shaderRef = shader;
  };

  const cloud = new THREE.Points(geom, material);
  scene.add(cloud);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    computeScale();
  }
  resize();
  window.addEventListener('resize', resize);

  let halved = false;

  function frame(now, dt, scrollProgress, moving) {
    if (moving) {
      if (shaderRef) shaderRef.uniforms.uTime.value = now / 1000;
      cloud.rotation.z += ROT_SPEED * dt;
    }
    const frac = HERO_DENSITY + (1 - HERO_DENSITY) * Math.min(1, Math.max(0, scrollProgress));
    geom.setDrawRange(0, Math.floor(count * frac));
    renderer.render(scene, camera);
  }

  function halveCount() { if (!halved) { halved = true; count = Math.floor(count / 2); } }

  return { frame, halveCount, getCount: () => count };
}
