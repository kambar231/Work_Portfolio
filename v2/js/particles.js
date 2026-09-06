/* particles.js — the signature background field.
 *
 * A full-viewport fixed THREE.Points cloud (z-index -1) whose points each walk a
 * de Jong strange attractor, gliding (not jumping) toward their next mapped point
 * so the cloud traces slow, evolving pencil-dust ribbons like nirnor.jp.
 *
 * FINAL ATTRACTOR PARAMETERS (tuned by eye against docs/nirnor-study/lead-film/frame_013.jpg;
 * these values render the rich multi-lobe ribbon in docs/v2-film/dj.png):
 *   de Jong map:  x' = sin(a*y) - cos(b*x),  y' = sin(c*x) - cos(d*y)
 *   base params:  a = 1.4,  b = -2.3,  c = 2.4,  d = -2.1
 *   glide:        each point interpolates between its current and next map iterate over a
 *                 phase u, advancing PHASE_SPEED (0.045) per 1/60 s, so it glides, not jumps.
 *   slow drift:   a += 0.00020*sin(t*0.05), b += 0.00016*cos(t*0.043),
 *                 c += 0.00018*sin(t*0.037), d += 0.00015*cos(t*0.061)
 *   world map:    attractor space (~[-2,2]) * SCALE fills ~1.3x the larger viewport
 *                 dimension, centred; whole cloud rotates 0.002 rad/s about the view axis.
 *   look:        PointsMaterial size 1.6, sizeAttenuation, colour #d9d9d9, opacity .85.
 *
 * Density is tied to scroll via the geometry draw range: 30% of points at the top,
 * rising linearly to 100% at the bottom of the page.
 */
import * as THREE from 'three';

const A0 = 1.4, B0 = -2.3, C0 = 2.4, D0 = -2.1;
const PHASE_SPEED = 0.045;           // per-point glide speed between successive iterates (per 1/60 s)
const FOV = 50;
const CAM_D = 450;                   // fixed camera distance: keeps point pixel size stable
const FILL = 1.3;                    // attractor fills 1.3x the larger viewport dimension
const ATTR_SPAN = 3.6;              // effective de Jong extent (points cluster inside [-2,2])
const ROT_SPEED = 0.002;             // rad/s global rotation

// With sizeAttenuation the on-screen point size is size * (0.5*canvasHeightPx) / distance,
// so a fixed camera distance (not a far-away one) is what keeps the dots ~1.6 px and visible.

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

  // attractor -> world scale, recomputed on resize so the field fills the viewport
  let SCALE = 140;
  function computeScale() {
    const aspect = window.innerWidth / window.innerHeight;
    const visH = 2 * CAM_D * Math.tan((FOV * Math.PI / 180) / 2);
    const visW = visH * aspect;
    SCALE = (FILL * Math.max(visW, visH)) / ATTR_SPAN;
  }
  computeScale();

  const maxCount = window.innerWidth < 760 ? 12000 : 40000;
  let count = maxCount;

  // Each point is a persistent walker on the FULL de Jong map: it holds its current
  // iterate (px,py), its next iterate (qx,qy), and a phase u in [0,1). Rendering
  // interpolates px->qx by u, and when u passes 1 the point advances one iteration.
  // Because the map is ergodic over its attractor, the 40k walkers always sample the
  // whole rich ribbon structure (never collapsing), while the phase interpolation
  // makes each point glide smoothly instead of teleporting frame to frame.
  const px = new Float32Array(maxCount);
  const py = new Float32Array(maxCount);
  const qx = new Float32Array(maxCount);
  const qy = new Float32Array(maxCount);
  const uu = new Float32Array(maxCount);
  const positions = new Float32Array(maxCount * 3);

  let a = A0, b = B0, c = C0, d = D0;
  function step(x, y) {
    return [Math.sin(a * y) - Math.cos(b * x), Math.sin(c * x) - Math.cos(d * y)];
  }
  // seed randomly, then burn in with the full map so every walker is on the attractor
  for (let i = 0; i < maxCount; i++) {
    px[i] = (Math.random() * 2 - 1) * 2;
    py[i] = (Math.random() * 2 - 1) * 2;
  }
  for (let s = 0; s < 30; s++) {
    for (let i = 0; i < maxCount; i++) {
      const n = step(px[i], py[i]); px[i] = n[0]; py[i] = n[1];
    }
  }
  for (let i = 0; i < maxCount; i++) {
    const n = step(px[i], py[i]); qx[i] = n[0]; qy[i] = n[1];
    uu[i] = Math.random();
    positions[i * 3]     = px[i] * SCALE;
    positions[i * 3 + 1] = py[i] * SCALE;
    positions[i * 3 + 2] = 0;
  }

  const geom = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geom.setAttribute('position', posAttr);
  geom.setDrawRange(0, Math.floor(count * 0.3));

  const material = new THREE.PointsMaterial({
    color: 0xd9d9d9,
    size: 1.6,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });

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
    const t = now / 1000;
    if (moving) {
      // slow parameter drift so the whole ribbon structure evolves over time
      a += 0.00020 * Math.sin(t * 0.05);
      b += 0.00016 * Math.cos(t * 0.043);
      c += 0.00018 * Math.sin(t * 0.037);
      d += 0.00015 * Math.cos(t * 0.061);

      const adv = PHASE_SPEED * (dt * 60);   // phase advance, frame-rate independent
      for (let i = 0; i < count; i++) {
        let u = uu[i] + adv;
        if (u >= 1) {                        // reached the next iterate: advance one step
          u -= 1;
          px[i] = qx[i]; py[i] = qy[i];
          qx[i] = Math.sin(a * py[i]) - Math.cos(b * px[i]);
          qy[i] = Math.sin(c * px[i]) - Math.cos(d * py[i]);
        }
        uu[i] = u;
        // ease-in-out phase: points linger near their attractor iterates and cross the
        // chord between them quickly, so the ribbon structure stays crisp, not smeared.
        const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) * (-2 * u + 2) * 0.5;
        positions[i * 3]     = (px[i] + (qx[i] - px[i]) * e) * SCALE;
        positions[i * 3 + 1] = (py[i] + (qy[i] - py[i]) * e) * SCALE;
      }
      posAttr.needsUpdate = true;
      cloud.rotation.z += ROT_SPEED * dt;
    }

    // density with scroll: 30% -> 100%
    const frac = 0.3 + 0.7 * Math.min(1, Math.max(0, scrollProgress));
    geom.setDrawRange(0, Math.floor(count * frac));

    renderer.render(scene, camera);
  }

  function halveCount() {
    if (halved) return;
    halved = true;
    count = Math.floor(count / 2);
  }

  return { frame, halveCount, getCount: () => count };
}
