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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth > 1920 ? 1.5 : 2));

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
  // slots 0..2 = forklift / slicer / cube (baked .bin); slot 3 = the hero portrait (PNG-sampled)
  const shapeArrays = [new Float32Array(positions), new Float32Array(positions), new Float32Array(positions), new Float32Array(positions)];
  const shapeAttr = shapeArrays.map((arr) => { const at = new THREE.BufferAttribute(arr, 3); at.setUsage(THREE.DynamicDrawUsage); return at; });
  // per-point flag for shape k: 0 = not in the shape (background dust), 1 = FILL point,
  // 2 = EDGE point. Drives per-class colour + size and lets non-shape dust fade away.
  const flag = [new Float32Array(maxCount), new Float32Array(maxCount), new Float32Array(maxCount), new Float32Array(maxCount)];
  const flagAttr = flag.map((arr) => { const at = new THREE.BufferAttribute(arr, 1); at.setUsage(THREE.DynamicDrawUsage); return at; });
  // per-point darkness (0..1) for the portrait shape: tie/hair/suit near 1, shirt/face near 0.
  const shade3 = new Float32Array(maxCount);
  let shade3Attr = new THREE.BufferAttribute(shade3, 1); shade3Attr.setUsage(THREE.DynamicDrawUsage);
  // per-point colour (rgb 0..1) sampled from the portrait photo, so the dots can carry the
  // real photo colour at the top of the hero and drain to the field grey as it scatters.
  const color3 = new Float32Array(maxCount * 3);
  let color3Attr = new THREE.BufferAttribute(color3, 3); color3Attr.setUsage(THREE.DynamicDrawUsage);
  const shapeNorm = [null, null, null, null];   // normalised source data once fetched (stride 4: x,y,z,cls)
  const shapeLoaded = [false, false, false, false];
  const shapeBounds = [null, null, null, null]; // {minx,maxx,miny,maxy} of the normalised shape, for placement

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('aShape0', shapeAttr[0]);
  geom.setAttribute('aShape1', shapeAttr[1]);
  geom.setAttribute('aShape2', shapeAttr[2]);
  geom.setAttribute('aShape3', shapeAttr[3]);
  geom.setAttribute('aFlag0', flagAttr[0]);
  geom.setAttribute('aFlag1', flagAttr[1]);
  geom.setAttribute('aFlag2', flagAttr[2]);
  geom.setAttribute('aFlag3', flagAttr[3]);
  geom.setAttribute('aShade3', shade3Attr);
  geom.setAttribute('aColor3', color3Attr);
  geom.setAttribute('aHash', new THREE.BufferAttribute(hash, 1));
  geom.setDrawRange(0, Math.floor(count * HERO_DENSITY));

  const WARP = SCALE * 0.03, WFREQ = 2.4 / SCALE, NOISE = SCALE * 0.9;
  const material = new THREE.PointsMaterial({
    color: 0xffffff, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false,
  });
  const uniforms = { uTime: { value: 0 }, uWarp: { value: WARP }, uFreq: { value: WFREQ }, uNoise: { value: NOISE },
    uMorph0: { value: 0 }, uMorph1: { value: 0 }, uMorph2: { value: 0 }, uMorph3: { value: 0 },
    // slice stack builds bottom-first: shape-1 points below uReveal1 (fraction of stack height) are placed
    uReveal1: { value: 1 }, uSliceLo: { value: -1 }, uSliceHi: { value: 1 },
    // dark stripe: uDark tints every point white; the cube outline (shape 2) spins about
    // its centre in the shader (the target set rotates, not the points)
    uDark: { value: 0 }, uCubeSpin: { value: 0 }, uCubeCx: { value: 0 }, uCubeCz: { value: 0 },
    // portrait: uPortraitColor 1 = dots wear the photo colour, 0 = field grey. uPortraitDrift
    // pushes the portrait points a little outward from its centre as the colour drains.
    uPortraitColor: { value: 1 }, uPortraitDrift: { value: 0 }, uPortCx: { value: 0 }, uPortCy: { value: 0 } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    // vertex: warp -> morph -> swirl, plus per-class colour/size and background dimming
    shader.vertexShader =
      'uniform float uTime,uWarp,uFreq,uNoise,uMorph0,uMorph1,uMorph2,uMorph3,uReveal1,uSliceLo,uSliceHi,uDark,uCubeSpin,uCubeCx,uCubeCz,uPortraitColor,uPortraitDrift,uPortCx,uPortCy;\n' +
      'attribute vec3 aShape0; attribute vec3 aShape1; attribute vec3 aShape2; attribute vec3 aShape3; attribute vec3 aColor3; attribute float aHash,aFlag0,aFlag1,aFlag2,aFlag3,aShade3;\n' +
      'varying vec3 vCol; varying float vOpa;\n' +
      shader.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
         // slice stack builds bottom ring first: a shape-1 point is placed only once the
         // build line uReveal1 has risen past its height fraction within the stack.
         float hFrac1 = clamp((aShape1.y - uSliceLo) / max(0.0001, uSliceHi - uSliceLo), 0.0, 1.0);
         float built1 = aFlag1 > 0.5 ? step(hFrac1, uReveal1) : 1.0;
         float uM1 = uMorph1 * built1;
         float m = clamp(uMorph0 + uM1 + uMorph2 + uMorph3, 0.0, 1.0);
         // warped attractor, warp fades as the form assembles
         vec3 base = transformed;
         base.x += uWarp * sin(base.y * uFreq + uTime * 0.35) * (1.0 - m);
         base.y += uWarp * cos(base.x * uFreq + uTime * 0.31) * (1.0 - m);
         vec3 pos = base;
         // crossfade forklift (0) and slice stack (1): blend the two forms by their
         // relative weight, then blend up from dust by the total. At 50/50 the point
         // sits midway between the two forms, never falling back to the plain field.
         float sum01 = uMorph0 + uM1;
         float ratio01 = uM1 / max(0.0001, sum01);
         float amt01 = clamp(sum01, 0.0, 1.0);
         vec3 form01 = mix(aShape0, aShape1, ratio01);
         pos = mix(pos, form01, amt01);
         // cube outline: rotate the target set about its centre (Y axis) so the wireframe spins
         vec3 s2 = aShape2;
         vec2 rel2 = vec2(s2.x - uCubeCx, s2.z - uCubeCz);
         float ca = cos(uCubeSpin), sa = sin(uCubeSpin);
         s2.x = uCubeCx + rel2.x * ca - rel2.y * sa;
         s2.z = uCubeCz + rel2.x * sa + rel2.y * ca;
         pos = mix(pos, s2, uMorph2);
         // hero portrait: an independent morph. At uMorph3 == 1 the point sits exactly on the
         // portrait (m == 1 -> swirl zero, crisp); as it falls the point scatters back to the
         // attractor through the per-point noise below, so the face turns to dust. A small
         // outward drift (uPortraitDrift) nudges each portrait point away from the portrait
         // centre so the colour-drain phase reads as the face loosening before it scatters.
         vec3 s3 = aShape3;
         vec2 d3 = s3.xy - vec2(uPortCx, uPortCy);
         s3.xy += normalize(d3 + 1e-4) * uPortraitDrift * uNoise * 0.35;
         pos = mix(pos, s3, uMorph3);
         // swirl from dust: peaks mid-transition, ZERO at both ends (so a formed shape is crisp)
         float swirl = m * (1.0 - m) * 2.6;
         vec3 n = vec3(fract(sin(aHash*91.7)*4372.1), fract(sin(aHash*38.3)*1934.7), fract(sin(aHash*17.1)*271.3)) - 0.5;
         pos += n * uNoise * swirl;
         transformed = pos;
         // active shape = the one being morphed to (morphs are exclusive); pick its flag + amount
         // (shape 1 uses the height-gated amount so un-built rings stay as dust)
         float mA = max(max(uMorph0, uM1), max(uMorph2, uMorph3));
         float flag = uMorph3 >= mA ? aFlag3 : (uMorph0 >= mA ? aFlag0 : (uM1 >= mA ? aFlag1 : aFlag2));
         float inShape = step(0.5, flag);          // 1 = fill or edge point of the active shape
         float isEdge  = step(1.5, flag);          // 1 = edge point
         // colour: dust -> per-class shape colour as the morph proceeds
         vec3 DUST = vec3(0.722), FILLC = vec3(0.769), EDGEC = vec3(0.200);
         vec3 shapeCol = mix(FILLC, EDGEC, isEdge);
         vCol = mix(DUST, shapeCol, inShape * mA);
         // portrait colour: for the active portrait points, blend from the field grey toward the
         // photo's own pixel colour by uPortraitColor (1 = full photo colour, 0 = grey dust).
         // Hue is preserved at full colour so the tie, suit and skin read as themselves.
         float isPort = step(0.001, uMorph3) * inShape;
         vec3 portCol = mix(DUST, aColor3, uPortraitColor);
         vCol = mix(vCol, portCol, isPort);
         // size: 1.6 dust -> 1.3 fill / 1.9 edge (portrait is fill class, so no boost)
         float shapeSz = mix(1.3, 1.9, isEdge);
         float sz = mix(size, shapeSz, inShape * mA);
         // background dust drops to 15% opacity once the morph is past 0.4, so the silhouette stands alone
         float dim = (1.0 - inShape) * smoothstep(0.4, 0.6, mA);
         vOpa = mix(1.0, 0.15, dim);
         // portrait alpha: darkness drives opacity so the structure reads as tone, not a flat
         // sheet. hair/suit/tie (dark) opaque, face medium, shirt faint: a = 0.25 + 0.75 * darkness.
         vOpa *= mix(1.0, 0.25 + 0.75 * aShade3, isPort);
         // dark stripe: every point turns white so it reads on the #1a1a1a band
         vCol = mix(vCol, vec3(1.0), uDark);`)
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
  // place shape k so its bounding-box centre projects to screen fraction (fx, fy) and its
  // height covers hFrac of the viewport, at any aspect ratio. The attractor field is untouched.
  function placeAt(k, fx, fy, hFrac) {
    const halfW = visH * aspect() * 0.5;
    const b = shapeBounds[k];
    const hNorm = b ? Math.max(1e-4, b.maxy - b.miny) : 1;
    const ncx = b ? (b.minx + b.maxx) * 0.5 : 0;
    const ncy = b ? (b.miny + b.maxy) * 0.5 : 0;
    const s = (hFrac * visH) / hNorm;
    const targetX = (2 * fx - 1) * halfW;          // screen frac -> world x at z=0
    const targetY = (1 - 2 * fy) * (visH * 0.5);   // screen frac from top -> world y at z=0
    return { s, cx: targetX - ncx * s, cy: targetY - ncy * s, cz: 0 };
  }
  // per-shape depth correction: a shape with z-depth (the slice stack's rings) projects taller
  // than its world height under perspective, so calibrate() tunes this until the ON-SCREEN
  // height matches the 62vh target. A flat shape (forklift) converges to ~1.
  const adj = [1, 1, 1, 1];
  const calTarget = [0.62, 0.62, 0.62, 0.62];   // on-screen height fraction each shape calibrates to
  const PLACE = {
    0: () => placeAt(0, 0.62, 0.50, 0.62 * adj[0]),   // forklift, centred at 62vw/50vh, 62vh tall
    1: () => placeAt(1, 0.62, 0.50, 0.62 * adj[1]),   // slice stack, same box (crossfades with forklift)
    2: () => { const halfW = visH * aspect() * 0.5; return { s: 0.55 * visH, cx: 0.48 * halfW, cy: 0, cz: 0 }; }, // cube outline, right half, 55vh
    3: () => placeAt(3, 0.80, 0.40, 0.34),            // hero portrait: full-image box 34vh tall, centred at 80vw/40vh (exactly under the <img>)
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
    if (k === 2) { uniforms.uCubeCx.value = p.cx; uniforms.uCubeCz.value = p.cz; }
    if (k === 3) {
      // drift centre = centre of the placed full-image box (the subject sits centred in it)
      const b3 = shapeBounds[3];
      const ncx = (b3.minx + b3.maxx) * 0.5, ncy = (b3.miny + b3.maxy) * 0.5;
      uniforms.uPortCx.value = ncx * p.s + p.cx;
      uniforms.uPortCy.value = ncy * p.s + p.cy;
    }
  }
  let forcedK = -1;   // shape-debug: force this morph to 1 once its data is placed
  function loadShape(k, url) {
    fetch(url).then((r) => r.arrayBuffer()).then((buf) => {
      const src = new Float32Array(buf);
      const M = src.length / 4;
      let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      for (let i = 0; i < M; i++) {
        const x = src[i * 4], y = src[i * 4 + 1];
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
      shapeBounds[k] = { minx, maxx, miny, maxy };
      // Spatially coherent correspondence for the crossfade: sort every shape's samples by the
      // SAME key (12 horizontal bands bottom-first, then x within the band) before they are
      // assigned to point indices. Index i of shape 0 and index i of shape 1 then land at
      // matching spatial slots, so the 50/50 midpoint is a solid in-between blob rather than
      // scattered dust. (Height-gated reveal still keys off aShape1.y, so it is unaffected.)
      const BANDS = 12, yr = (maxy - miny) || 1;
      const bandOf = (i) => Math.min(BANDS - 1, Math.max(0, Math.floor((src[i * 4 + 1] - miny) / yr * BANDS)));
      const order = new Array(M);
      for (let i = 0; i < M; i++) order[i] = i;
      order.sort((p, q) => { const bp = bandOf(p), bq = bandOf(q); return bp !== bq ? bp - bq : src[p * 4] - src[q * 4]; });
      const sorted = new Float32Array(src.length);
      for (let i = 0; i < M; i++) { const o = order[i]; sorted[i * 4] = src[o * 4]; sorted[i * 4 + 1] = src[o * 4 + 1]; sorted[i * 4 + 2] = src[o * 4 + 2]; sorted[i * 4 + 3] = src[o * 4 + 3]; }
      shapeNorm[k] = sorted;
      placeShape(k); calibrate(k); placeShape(k); shapeLoaded[k] = true;
      if (forcedK === k) uniforms['uMorph' + k].value = 1;   // apply a pending debug force
    }).catch(() => {});
  }
  // shape-debug (?shape=): force one morph fully on (applied now or when its data lands)
  function forceShape(k) { forcedK = k; if (shapeLoaded[k]) { uniforms['uMorph' + k].value = 1; if (k === 1) uniforms.uReveal1.value = 1; } }
  // The hero portrait is not a baked .bin: it is sampled from a greyscale PNG at load time.
  // Points are drawn with probability proportional to (1 - luminance)^1.6 so the hair, suit
  // and tie are dense and the shirt and face are light; the studio backdrop is keyed out via
  // the PNG alpha. The samples are stored stride-4 (x,y,z,cls) like the other shapes, plus a
  // parallel darkness value per point, and sorted by the SAME y-band/x key for coherent
  // crossfades. y is flipped so the portrait stands upright.
  const PORTRAIT_TARGET = Math.min(90000, maxCount);
  function loadPortraitShape(k, url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cw = img.width, ch = img.height;
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, cw, ch).data;
      const xs = [], ys = [], sh = [], cr = [], cg = [], cb = [];
      const guardMax = PORTRAIT_TARGET * 60;
      let guard = 0;
      while (xs.length < PORTRAIT_TARGET && guard < guardMax) {
        guard++;
        const px = (Math.random() * cw) | 0;
        const py = (Math.random() * ch) | 0;
        const idx = (py * cw + px) * 4;
        if (data[idx + 3] < 20) continue;                      // backdrop keyed out by alpha
        const r = data[idx], g = data[idx + 1], bch = data[idx + 2];
        const lum = (0.299 * r + 0.587 * g + 0.114 * bch) / 255;
        const dark = Math.min(1, Math.max(0, 1 - lum));
        // biased to the darks so hair/suit/tie stay densest while the face and shirt still
        // read: p = 0.4 + 0.6 * darkness^1.3 over the matted silhouette.
        if (Math.random() > 0.4 + 0.6 * Math.pow(dark, 1.3)) continue;
        xs.push(px + 0.5);
        ys.push(-(py + 0.5));                                   // flip: image is top-down, world is y-up
        sh.push(dark);
        cr.push(r / 255); cg.push(g / 255); cb.push(bch / 255);
      }
      const M = xs.length;
      let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      for (let i = 0; i < M; i++) {
        if (xs[i] < minx) minx = xs[i]; if (xs[i] > maxx) maxx = xs[i];
        if (ys[i] < miny) miny = ys[i]; if (ys[i] > maxy) maxy = ys[i];
      }
      // placement frame is the FULL image rectangle (not the sampled subject bounds), so the
      // dots land exactly under the <img> element that shows the same file at the same box.
      shapeBounds[k] = { minx: 0.5, maxx: cw - 0.5, miny: -(ch - 0.5), maxy: -0.5 };
      // same coherent-crossfade key as loadShape: 12 horizontal bands bottom-first, then x
      const BANDS = 12, yr = (maxy - miny) || 1;
      const order = new Array(M);
      for (let i = 0; i < M; i++) order[i] = i;
      const bandOf = (i) => Math.min(BANDS - 1, Math.max(0, Math.floor((ys[i] - miny) / yr * BANDS)));
      order.sort((p, q) => { const bp = bandOf(p), bq = bandOf(q); return bp !== bq ? bp - bq : xs[p] - xs[q]; });
      const sorted = new Float32Array(M * 4);
      for (let i = 0; i < M; i++) {
        const o = order[i];
        sorted[i * 4] = xs[o]; sorted[i * 4 + 1] = ys[o]; sorted[i * 4 + 2] = 0; sorted[i * 4 + 3] = 0;   // cls 0 = fill
        shade3[i] = sh[o];
        color3[i * 3] = cr[o]; color3[i * 3 + 1] = cg[o]; color3[i * 3 + 2] = cb[o];
      }
      for (let i = M; i < maxCount; i++) { shade3[i] = 0; color3[i * 3] = color3[i * 3 + 1] = color3[i * 3 + 2] = 0; }
      shade3Attr.needsUpdate = true;
      color3Attr.needsUpdate = true;
      shapeNorm[k] = sorted;
      placeShape(k); calibrate(k); placeShape(k);
      shapeLoaded[k] = true;
      if (forcedK === k) uniforms['uMorph' + k].value = 1;
      // the portrait loads async; let the hero driver re-assert its morph for the current
      // scroll position (setMorph is a no-op until the shape is loaded).
      try { window.dispatchEvent(new CustomEvent('v2:portrait-ready')); } catch (e) {}
    };
    img.src = url;
  }
  loadShape(0, 'assets/shapes/forklift.bin');
  loadShape(1, 'assets/shapes/slicer.bin');
  loadShape(2, 'assets/shapes/cube.bin');
  loadPortraitShape(3, 'assets/shapes/portrait-color.png');

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = aspect();
    camera.updateProjectionMatrix();
    for (let k = 0; k < 4; k++) if (shapeLoaded[k]) { placeShape(k); calibrate(k); placeShape(k); }
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

  // tune adj[k] so the shape's projected screen height converges on the 62vh target
  function calibrate(k) {
    if (k === 3) return;   // portrait is a flat shape placed by its full-image box; no depth to correct
    if (!shapeNorm[k]) return;
    const tgt = calTarget[k];
    adj[k] = 1;
    for (let it = 0; it < 6; it++) {
      const box = morphBox(k); if (!box) break;
      const hf = box.h / window.innerHeight;
      if (Math.abs(hf - tgt) < 0.008 || hf <= 0) break;
      adj[k] *= tgt / hf;
    }
  }

  function setDark(v) { uniforms.uDark.value = Math.min(1, Math.max(0, v)); }
  function setPortraitColor(v) { uniforms.uPortraitColor.value = Math.min(1, Math.max(0, v)); }
  function setPortraitDrift(v) { uniforms.uPortraitDrift.value = Math.min(1, Math.max(0, v)); }
  // verification: distribution of portrait points over the vertical extent (10 bands, top-first)
  function portraitStats() {
    const src = shapeNorm[3]; if (!src) return null;
    const M = src.length / 4;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < M; i++) { const y = src[i * 4 + 1]; if (y < lo) lo = y; if (y > hi) hi = y; }
    const range = (hi - lo) || 1, NB = 10;
    const bands = new Array(NB).fill(0);
    for (let i = 0; i < M; i++) {
      const topFrac = (hi - src[i * 4 + 1]) / range;           // 0 = very top, 1 = bottom
      bands[Math.min(NB - 1, Math.max(0, Math.floor(topFrac * NB)))]++;
    }
    const top22 = (bands[0] + bands[1] + bands[2] * 0.2) / M;    // fraction in the top 22%
    let densest = 0; for (let b = 1; b < NB; b++) if (bands[b] > bands[densest]) densest = b;
    return { M, bands, top22, densestBand: densest };
  }
  function frame(now, dt, scrollProgress, moving) {
    if (moving) uniforms.uTime.value = now / 1000;
    // cube outline spins while the dark stripe is active (target set rotates, not the points)
    if (uniforms.uMorph2.value > 0.001) uniforms.uCubeSpin.value = (now / 1000) * 0.15;
    const frac = staticDensity != null
      ? staticDensity
      : HERO_DENSITY + (1 - HERO_DENSITY) * Math.min(1, Math.max(0, scrollProgress));
    geom.setDrawRange(0, Math.floor(count * frac));
    renderer.render(scene, camera);
  }

  function halveCount() { if (!halved) { halved = true; count = Math.floor(count / 2); } }
  function capDpr() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); resize(); }

  return { frame, halveCount, capDpr, setMorph, morphBox, setSliceReveal, sliceTop, forceShape, setDark,
    setPortraitColor, setPortraitDrift, portraitStats,
    _nudgeSize: () => { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h - 1, false); resize(); },
    _resetGL: () => { try { renderer.resetState(); } catch (e) {} },
    _reupload: () => { shapeAttr[3].needsUpdate = true; flagAttr[3].needsUpdate = true; shade3Attr.needsUpdate = true; color3Attr.needsUpdate = true; },
    _recreate: () => {
      const mk = (arr, n) => { const at = new THREE.BufferAttribute(arr, n); at.setUsage(THREE.DynamicDrawUsage); return at; };
      geom.deleteAttribute('aColor3'); color3Attr = mk(color3, 3); geom.setAttribute('aColor3', color3Attr);
      geom.deleteAttribute('aFlag3'); flagAttr[3] = mk(flag[3], 1); geom.setAttribute('aFlag3', flagAttr[3]);
    },
    debugPortraitColor: () => {
      const src = shapeNorm[3]; if (!src) return null; const M = src.length / 4;
      // index correlates with the y-band sort (low = bottom/suit, high = top/head)
      const seg = (lo, hi) => { let r = 0, g = 0, b = 0, y = 0, f0 = 0, n = 0; for (let i = lo; i < hi; i++) { r += color3[i*3]; g += color3[i*3+1]; b += color3[i*3+2]; y += src[i*4+1]; if (flag[3][i] < 0.5) f0++; n++; } return { rgb: [r/n, g/n, b/n], meanY: y/n, flagZeroFrac: f0/n }; };
      return { M, flagLen: flag[3].length, bottom: seg(0, 5000), mid: seg(Math.floor(M/2), Math.floor(M/2)+5000), top: seg(M - 5000, M) };
    },
    morphVal: (k) => uniforms['uMorph' + k].value,
    portraitColorVal: () => uniforms.uPortraitColor.value, portraitDriftVal: () => uniforms.uPortraitDrift.value,
    getCount: () => count };
}
