/* manifesto.js — the wireframe cube stack beside the dark manifesto band.
 * A small self-contained THREE scene: three stacked cubes drawn as white EdgesGeometry
 * line segments, slowly rotating, on a transparent background so the #1a1a1a band shows.
 */
import * as THREE from 'three';

export function initManifestoStack(el, animate) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  el.appendChild(renderer.domElement);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  const group = new THREE.Group();
  scene.add(group);
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.6, 1.6, 1.6));
  const ys = [-1.9, 0, 1.9];
  for (let i = 0; i < 3; i++) {
    const lines = new THREE.LineSegments(edges, mat);
    lines.position.y = ys[i];
    lines.rotation.set(0.3 + i * 0.2, 0.4 + i * 0.3, 0);
    group.add(lines);
  }

  function resize() {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  function frame(now) {
    if (animate) {
      const t = now / 1000;
      group.rotation.y = t * 0.18;
      group.children.forEach((c, i) => { c.rotation.x = 0.3 + i * 0.2 + t * 0.12; });
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
