/* ====================================================================
   Kambar - the desk experience  (v2 — Soul-inspired render pass)
   Three.js r148 + GSAP. UMD globals, file:// safe.
   Renders a sitting engineer at a desk; click a prop to pick it up;
   camera dollies from third-person to first-person POV; POV overlay
   reveals the relevant project content.

   v2 differences from v1 (see STYLE_SOUL.md for the rationale on each):
     1.  ACES Filmic tone mapping (was Cineon)
     2.  PMREM-baked environment from a procedural sky/light-blob scene,
         applied as scene.environment so metals (helmet, gold spine,
         drawer pulls) actually reflect a room.
     3.  MeshToonMaterial + 3-step gradient ramps for skin/cloth/wood/
         paper. Standard kept on metals. Mixing, not replacing — the
         Soul thesis is exactly the "stylized character / near-real
         environment" tension.
     4.  Inverted-hull back-face outlines on the character group only
         (not props, not furniture). The single most "this is a
         deliberate cartoon character" cue.
     5.  Small post-processing chain: RenderPass → UnrealBloom (gentle,
         high-threshold) → custom vignette + grain in a single ShaderPass.
         Bloom strength tweens up on POV entry, eases back on return —
         the two-mode visual system from Soul's NYC/Great Before split.
     6.  Canvas value-noise roughness map shared across all Standard
         materials. Kills the perfect-mirror highlight on metals; gives
         the env-map reflections a hand-painted shimmer.
     7.  Fresnel rim glow via onBeforeCompile shader patch — warm rim on
         skin, cool rim on the blazer. Echoes the key/rim light rig.
     8.  Fake-AO contact discs under every prop (the seated character
         already had one in v1; we now add them universally).
     9.  4-finger + thumb hand rebuild. Soul's production specifically
         built jazz-pianist-detailed hands ("hands are where the artist
         lives"); reducing finger detail would have killed the design
         intent. Promoted from HANDOFF.md's A.7 to #1 character upgrade.
   ==================================================================== */
// THREE, gsap, and the r147 examples/js postprocessing scripts are global
// (loaded via <script> tags in desk-v2.html before this file).

const PAPER = 0xf4f1ea;
const INK   = 0x14171c;
const NAVY  = 0x1f3a99;
const RED   = 0xb82a18;
const GOLD  = 0xd6a72a;
const WOOD  = 0x6d4a2c;
const SKIN  = 0xe6c39a;
const HAIR  = 0x1a1410;

const $ = (s) => document.querySelector(s);
const lerp = (a, b, t) => a + (b - a) * t;

// ----------------------------------------------------------------
// RENDERER + SCENE + CAMERA
// ----------------------------------------------------------------
const stage = $("#stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
// v2 change #1 — ACES Filmic. Cineon (v1) was chosen to protect red
// saturation under an older r148 pipeline; ACES is the right reference
// for the Soul/Pixar warm filmic roll-off. If the helmet desaturates
// noticeably, push RED ~ 0xc8331e or GOLD ~ 0xe2b54a at source rather
// than fight the tone curve.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.00;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Gradient sky — painted to a canvas so the back of the room doesn't read flat.
(function buildSky() {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#d6cebc");
  grad.addColorStop(1, "#e8e2d4");
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  tex.needsUpdate = true;
  scene.background = tex;
})();
scene.fog = new THREE.Fog(0xe2dccc, 12, 28);

const camera = new THREE.PerspectiveCamera(
  38, window.innerWidth / window.innerHeight, 0.1, 100
);
const CAM_A = { pos: new THREE.Vector3(0, 1.30, 3.80), look: new THREE.Vector3(0, 1.10, 0) };
const camFocus = new THREE.Vector3().copy(CAM_A.look);
camera.position.copy(CAM_A.pos);
camera.lookAt(camFocus);

const CAM_B = {
  portfolio: { pos: new THREE.Vector3(-0.22, 2.18, -0.95), look: new THREE.Vector3( 0.30, 1.16,  0.08), fov: 44 },
  cad:       { pos: new THREE.Vector3(-0.22, 2.22, -0.95), look: new THREE.Vector3( 0.30, 1.22,  0.08), fov: 44 },
  mug:       { pos: new THREE.Vector3(-0.22, 2.18, -0.95), look: new THREE.Vector3( 0.30, 1.18,  0.08), fov: 44 },
  letter:    { pos: new THREE.Vector3( 0.22, 2.18, -0.95), look: new THREE.Vector3(-0.30, 1.16,  0.08), fov: 44 },
  helmet:    { pos: new THREE.Vector3( 0.22, 2.24, -0.93), look: new THREE.Vector3(-0.30, 1.26,  0.10), fov: 48 },
};

// ----------------------------------------------------------------
// LIGHTING — 3-light portrait rig + hemisphere ambient (unchanged)
// ----------------------------------------------------------------
const hemi = new THREE.HemisphereLight(0xcfd9e8, 0xc9b89a, 0.20);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffc89a, 1.1);
key.position.set(-3.8, 5.6, 3.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -6;
key.shadow.camera.right = 6;
key.shadow.camera.top = 6;
key.shadow.camera.bottom = -6;
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 18;
key.shadow.bias = -0.0006;
key.shadow.normalBias = 0.02;
key.shadow.radius = 3;
scene.add(key);

const fill = new THREE.DirectionalLight(0xbcd4ff, 0.35);
fill.position.set(2.2, 5.0, 1.6);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xf2f6ff, 0.6);
rim.position.set(2.8, 3.4, -3.6);
scene.add(rim);

// ----------------------------------------------------------------
// v2 change #2 — PMREM ENVIRONMENT MAP from a procedural blob scene
// ----------------------------------------------------------------
// MeshStandardMaterial metals need *something* to reflect or they
// render nearly black. We can't ship an HDRI (no external assets
// rule), and RoomEnvironment lives in examples/jsm which is module-
// only. So: build a tiny scene with a few large MeshBasic emissive
// planes acting as "light blobs," bake it through PMREM, and bind
// the resulting cubemap to scene.environment. All Standard materials
// pick it up automatically.
// We bias the blobs toward warm-above / cool-side so the reflections
// echo the key+fill+rim rig and don't fight the lighting.
(function bakeEnvironment() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0xf4ecd8); // warm cream sky baseline

  function blob(color, intensity, w, h, x, y, z, rx, ry) {
    const mat = new THREE.MeshBasicMaterial({ color });
    // Inflate the color past 1.0 by tinting; MeshBasic isn't HDR-aware
    // but PMREM still produces a softly bright reflection at this scale.
    mat.color.multiplyScalar(intensity);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    if (rx !== undefined) m.rotation.x = rx;
    if (ry !== undefined) m.rotation.y = ry;
    envScene.add(m);
  }
  // Warm ceiling — biggest contributor, motivates the key
  blob(0xffd8a8, 1.4, 12, 12, 0, 6, 0, Math.PI / 2, 0);
  // Cool window left — picks up the fill direction
  blob(0xbcd4ff, 1.1, 6, 8, -5, 2.5, 0, 0, Math.PI / 2);
  // Warm back panel — small ambient warmth behind the camera reflection
  blob(0xf4d39a, 0.9, 6, 6, 0, 2.0, 5, 0, Math.PI);
  // Cool rim from behind-right — matches scene.rim
  blob(0xe8eeff, 0.85, 4, 5, 4, 3, -4.5, 0, -Math.PI * 0.65);
  // Dim floor bounce — keeps undersides from going inky
  blob(0xd4c8a8, 0.6, 10, 10, 0, -0.5, 0, -Math.PI / 2, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envMap = pmrem.fromScene(envScene, 0.04).texture; // 0.04 = soft blur
  scene.environment = envMap;
  pmrem.dispose();
  // We deliberately do NOT set scene.background = envMap; we keep the
  // hand-painted gradient sky as the visible backdrop.
})();

// ----------------------------------------------------------------
// v2 change #6 — CANVAS NOISE ROUGHNESS MAP (shared)
// ----------------------------------------------------------------
// Three octaves of value noise. Cheap, painted feel. Bound on every
// Standard material's roughnessMap channel so the env-map reflections
// shimmer hand-paintedly instead of mirror-perfectly.
function buildNoiseRoughness(size = 256, octaves = 3) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d");
  const img = g.createImageData(size, size);

  // Pre-compute a small lattice and bilerp-sample it for smooth noise.
  function lattice(scale) {
    const n = Math.max(2, Math.floor(size / scale));
    const grid = new Float32Array(n * n);
    for (let i = 0; i < grid.length; i++) grid[i] = Math.random();
    return { grid, n, scale };
  }
  function sample(L, x, y) {
    const fx = (x / L.scale) % L.n;
    const fy = (y / L.scale) % L.n;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const a = L.grid[(iy * L.n + ix) % L.grid.length];
    const b = L.grid[(iy * L.n + ((ix + 1) % L.n)) % L.grid.length];
    const cc = L.grid[(((iy + 1) % L.n) * L.n + ix) % L.grid.length];
    const d = L.grid[(((iy + 1) % L.n) * L.n + ((ix + 1) % L.n)) % L.grid.length];
    const u = tx * tx * (3 - 2 * tx);
    const v = ty * ty * (3 - 2 * ty);
    return a * (1-u) * (1-v) + b * u * (1-v) + cc * (1-u) * v + d * u * v;
  }
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push(lattice(64 / Math.pow(2, o)));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.5, sum = 0;
      for (const L of layers) { v += sample(L, x, y) * amp; sum += amp; amp *= 0.5; }
      v = (v / sum); // 0..1
      // Bias toward 0.5–0.9 so we never go fully mirror, never matte.
      const out = Math.floor((0.5 + v * 0.4) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i+1] = img.data[i+2] = out;
      img.data[i+3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}
const noiseRough = buildNoiseRoughness();

// ----------------------------------------------------------------
// v2 change #7 — FRESNEL RIM via onBeforeCompile (Standard + Toon)
// ----------------------------------------------------------------
// Adds an additive view-angle rim term to the final fragment colour.
// Works on both MeshStandardMaterial and MeshToonMaterial because both
// declare `vNormal` and `vViewPosition` varyings and both include the
// <dithering_fragment> chunk in their fragment shaders.
function addFresnelRim(material, hex = 0xffd6a8, power = 3.0, intensity = 0.45) {
  // Build the patch callback once and stash the params so clones can
  // re-attach. THREE r148's Material.copy() does NOT copy
  // onBeforeCompile, so without re-attaching, every matSkin.clone()
  // (and there are dozens) would silently drop the rim glow.
  const cb = (shader) => {
    shader.uniforms.fresnelColor = { value: new THREE.Color(hex) };
    shader.uniforms.fresnelPower = { value: power };
    shader.uniforms.fresnelIntensity = { value: intensity };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 fresnelColor;
        uniform float fresnelPower;
        uniform float fresnelIntensity;`)
      .replace('#include <dithering_fragment>', `
        {
          float _fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), fresnelPower);
          gl_FragColor.rgb += _fres * fresnelColor * fresnelIntensity;
        }
        #include <dithering_fragment>`);
  };
  material.onBeforeCompile = cb;
  // customProgramCacheKey must differ from the default so r148 doesn't
  // collide cached programs between the base material and other
  // unpatched materials of the same type.
  material.customProgramCacheKey = () => `fresnel-${hex}-${power}-${intensity}`;
  material.needsUpdate = true;

  // Patch the per-instance clone() so the rim survives every clone.
  const _baseClone = material.clone.bind(material);
  material.clone = function patchedClone() {
    const c = _baseClone();
    c.onBeforeCompile = cb;
    c.customProgramCacheKey = material.customProgramCacheKey;
    c.needsUpdate = true;
    // Chain: clones of clones also keep the patch.
    const _innerClone = c.clone.bind(c);
    c.clone = function() {
      const cc = _innerClone();
      cc.onBeforeCompile = cb;
      cc.customProgramCacheKey = material.customProgramCacheKey;
      cc.needsUpdate = true;
      return cc;
    };
    return c;
  };
  return material;
}

// ----------------------------------------------------------------
// v2 change #3 — TOON RAMPS & MIXED MATERIALS
// ----------------------------------------------------------------
// 3 stops is the Soul sweet spot. NearestFilter is mandatory; linear
// filtering smears the bands and we may as well be back on Standard.
// Two ramps: skin gets a softer step gradient; cloth/hard surfaces get
// a crunchier one with more contrast.
function makeRamp(stops) {
  const data = new Uint8Array(stops);
  const tex = new THREE.DataTexture(data, stops.length, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
const rampSkin  = makeRamp([110, 175, 250]); // softer for skin: not too crunchy
const rampCloth = makeRamp([60, 140, 240]);  // crunchier for cloth/wood/paper

// --- TOON materials (character / soft surfaces) ---
const matPaper  = new THREE.MeshToonMaterial({ color: PAPER, gradientMap: rampCloth });
const matInk    = new THREE.MeshToonMaterial({ color: INK,   gradientMap: rampCloth });
const matNavy   = new THREE.MeshToonMaterial({ color: NAVY,  gradientMap: rampCloth });
const matWood   = new THREE.MeshToonMaterial({ color: WOOD,  gradientMap: rampCloth });
const matSkin   = new THREE.MeshToonMaterial({ color: SKIN,  gradientMap: rampSkin  });
const matHair   = new THREE.MeshToonMaterial({ color: HAIR,  gradientMap: rampCloth });

// --- STANDARD materials (metals / glossy props — keep PBR + env) ---
// These pick up scene.environment automatically for reflections, and
// share the noise roughness map for the painted-shimmer feel.
const matRed    = new THREE.MeshStandardMaterial({ color: RED,   roughness: 0.30, metalness: 0.30, roughnessMap: noiseRough, envMapIntensity: 1.0 });
const matGold   = new THREE.MeshStandardMaterial({ color: GOLD,  roughness: 0.32, metalness: 0.85, roughnessMap: noiseRough, envMapIntensity: 1.2 });
const matAccent = new THREE.MeshStandardMaterial({ color: 0x4d6dd9, roughness: 0.35, metalness: 0.6, roughnessMap: noiseRough });

// Fresnel rims:
//   warm on skin    — echoes the key (warm)
//   cool on blazer  — echoes the rim (cool)
addFresnelRim(matSkin, 0xffdcb5, 3.0, 0.45);
addFresnelRim(matNavy, 0xbcd4ff, 2.5, 0.30);
addFresnelRim(matRed,  0xffe0c0, 3.2, 0.30);

// Edge-line helper — gives the blueprint-CAD look on the cad base + letter sheet.
function addEdges(mesh, color = 0x14171c, opacity = 0.8) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 30);
  const lines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity })
  );
  mesh.add(lines);
  return mesh;
}

// ----------------------------------------------------------------
// GEOMETRY HELPERS — chamfered / rounded boxes (unchanged from v1)
// ----------------------------------------------------------------
function roundedBoxGeometry(w, h, d, r = 0.06, bevelSegments = 3) {
  const maxR = Math.min(w, h, d) * 0.49;
  const cornerR = Math.max(0.001, Math.min(r, maxR));
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + cornerR, y);
  shape.lineTo(x + w - cornerR, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + cornerR);
  shape.lineTo(x + w, y + h - cornerR);
  shape.quadraticCurveTo(x + w, y + h, x + w - cornerR, y + h);
  shape.lineTo(x + cornerR, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - cornerR);
  shape.lineTo(x, y + cornerR);
  shape.quadraticCurveTo(x, y, x + cornerR, y);
  const bevelT = Math.min(cornerR * 0.9, d * 0.45);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(d - bevelT * 2, 0.001),
    bevelEnabled: true,
    bevelThickness: bevelT,
    bevelSize: bevelT,
    bevelSegments,
    curveSegments: 6,
  });
  geom.translate(0, 0, -((d - bevelT * 2) / 2 + bevelT));
  geom.computeVertexNormals();
  return geom;
}
function softBlockGeometry(w, h, d, r) {
  return roundedBoxGeometry(w, h, d, r, 4);
}

// ----------------------------------------------------------------
// v2 change #8 — CONTACT SHADOW DISC helper (used for character + props)
// ----------------------------------------------------------------
const _aoCanvas = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return c;
})();
function makeContactDisc(radius = 0.20, opacity = 0.40) {
  const tex = new THREE.CanvasTexture(_aoCanvas);
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = -1;
  m.userData.noOutline = true; // never outline a flat decal
  return m;
}

// ----------------------------------------------------------------
// FLOOR + BACKDROP
// ----------------------------------------------------------------
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshToonMaterial({ color: PAPER, gradientMap: rampCloth })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

const backWall = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 14),
  new THREE.MeshToonMaterial({ color: 0xdcd4c2, gradientMap: rampCloth })
);
backWall.position.set(0, 6.5, -5);
backWall.receiveShadow = true;
scene.add(backWall);

const grid = new THREE.GridHelper(40, 40, 0xcfc8b8, 0xcfc8b8);
grid.position.y = 0.001;
grid.material.transparent = true;
grid.material.opacity = 0.25;
scene.add(grid);

// ----------------------------------------------------------------
// DESK (toon-walnut)
// ----------------------------------------------------------------
const desk = new THREE.Group();

const DESK_W = 2.6, DESK_T = 0.04, DESK_D = 1.2, DESK_Y = 0.78;
const deskTopGeo = roundedBoxGeometry(DESK_W, DESK_D, DESK_T, 0.012, 2);
const deskTop = new THREE.Mesh(deskTopGeo, matWood.clone());
deskTop.rotation.x = -Math.PI / 2;
deskTop.position.y = DESK_Y;
deskTop.castShadow = true;
deskTop.receiveShadow = true;
desk.add(deskTop);

const modesty = new THREE.Mesh(
  roundedBoxGeometry(2.20, 0.55, 0.025, 0.01, 2),
  matWood.clone()
);
modesty.position.set(0, DESK_Y - 0.30, 0.55);
modesty.castShadow = true;
modesty.receiveShadow = true;
desk.add(modesty);

const PED_W = 0.42, PED_H = 0.72, PED_D = 1.05;
const PED_X = -1.06;
const PED_Y = PED_H / 2;
const PED_Z = -0.02;

const pedestal = new THREE.Mesh(
  roundedBoxGeometry(PED_W, PED_H, PED_D, 0.015, 2),
  matWood.clone()
);
pedestal.position.set(PED_X, PED_Y, PED_Z);
pedestal.castShadow = true;
pedestal.receiveShadow = true;
desk.add(pedestal);

for (let i = 0; i < 3; i++) {
  const drawer = new THREE.Mesh(
    roundedBoxGeometry(PED_W - 0.04, 0.20, 0.012, 0.008, 2),
    matWood.clone()
  );
  drawer.position.set(
    PED_X,
    PED_H - 0.13 - i * 0.22,
    PED_Z + PED_D / 2 + 0.002
  );
  drawer.castShadow = true;
  drawer.receiveShadow = true;
  desk.add(drawer);

  // Pull stays Standard (metal — pulls reflect a bit).
  const pull = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.10, 12),
    new THREE.MeshStandardMaterial({
      color: 0x1c1815, roughness: 0.45, metalness: 0.65,
      roughnessMap: noiseRough, envMapIntensity: 0.8
    })
  );
  pull.rotation.z = Math.PI / 2;
  pull.position.set(
    PED_X,
    PED_H - 0.13 - i * 0.22,
    PED_Z + PED_D / 2 + 0.018
  );
  pull.castShadow = true;
  desk.add(pull);
}

const sideLeg = new THREE.Mesh(
  roundedBoxGeometry(0.06, PED_H, PED_D * 0.85, 0.012, 2),
  matWood.clone()
);
sideLeg.position.set(1.20, PED_H / 2, PED_Z - 0.02);
sideLeg.castShadow = true;
sideLeg.receiveShadow = true;
desk.add(sideLeg);

const crossRail = new THREE.Mesh(
  roundedBoxGeometry(2.20, 0.05, 0.04, 0.012, 2),
  matWood.clone()
);
crossRail.position.set(0.08, 0.08, -0.50);
crossRail.castShadow = true;
desk.add(crossRail);

scene.add(desk);

// ----------------------------------------------------------------
// CHAIR
// ----------------------------------------------------------------
function buildCurvedBackrest(w, h, depth, curvature, segW = 24, segH = 16) {
  const geo = new THREE.PlaneGeometry(w, h, segW, segH);
  const pos = geo.attributes.position;
  const halfW = w / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const t = x / halfW;
    pos.setZ(i, curvature * (t * t));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

const chairBack = new THREE.Mesh(
  buildCurvedBackrest(0.86, 0.78, 0.10, 0.10, 28, 18),
  matWood.clone()
);
chairBack.material.side = THREE.DoubleSide;
chairBack.position.set(0, 1.50, -0.98);
chairBack.rotation.x = -0.08;
chairBack.castShadow = true;
chairBack.receiveShadow = true;
scene.add(chairBack);

const chairBackOuter = new THREE.Mesh(
  buildCurvedBackrest(0.90, 0.82, 0.10, 0.10, 24, 14),
  matWood.clone()
);
chairBackOuter.material.side = THREE.DoubleSide;
chairBackOuter.material.color = new THREE.Color(0x8a663f);
chairBackOuter.position.set(0, 1.50, -1.005);
chairBackOuter.rotation.x = -0.08;
chairBackOuter.castShadow = true;
chairBackOuter.receiveShadow = true;
scene.add(chairBackOuter);

// Posts stay STANDARD (visible metallic posts).
const postMat = new THREE.MeshStandardMaterial({
  color: 0x1c1f26, roughness: 0.42, metalness: 0.6,
  roughnessMap: noiseRough, envMapIntensity: 0.7
});
const post = new THREE.Mesh(
  new THREE.CylinderGeometry(0.022, 0.022, 1.10, 14),
  postMat
);
post.position.set(-0.40, 1.05, -1.05);
post.castShadow = true;
scene.add(post);
const post2 = post.clone();
post2.position.set(0.40, 1.05, -1.05);
scene.add(post2);

const chairSeat = new THREE.Mesh(
  roundedBoxGeometry(0.78, 0.06, 0.62, 0.025, 2),
  matWood.clone()
);
chairSeat.material.color = new THREE.Color(0x6d4f30);
chairSeat.position.set(0, 0.78 - 0.30, -0.78);
chairSeat.castShadow = true;
chairSeat.receiveShadow = true;
scene.add(chairSeat);


// ----------------------------------------------------------------
// FACE TEXTURE (unchanged from v1 — used only as a fallback / reference;
// the face features are 3D primitives in v2 just as in v1)
// ----------------------------------------------------------------
function buildFaceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e8c4a0'; ctx.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
const faceTex = buildFaceTexture();

// ----------------------------------------------------------------
// CHARACTER
// ----------------------------------------------------------------
const character = new THREE.Group();
character.position.set(0, -0.30, -0.85);
scene.add(character);

// Contact shadow under the seated figure (unchanged from v1).
const contactShadow = makeContactDisc(0.55, 0.40);
contactShadow.position.set(0, 0.02, -0.85);
contactShadow.scale.set(1.15, 1.15, 1);
scene.add(contactShadow);

// SUIT & BODY — toon materials, blazer/shirt/tie.
const matBlazer = new THREE.MeshToonMaterial({ color: 0x1a2540, gradientMap: rampCloth });
const matShirt  = new THREE.MeshToonMaterial({ color: 0xf8f5ee, gradientMap: rampCloth });
const matTie    = new THREE.MeshToonMaterial({ color: 0x6b2838, gradientMap: rampCloth });
const matTiePat = new THREE.MeshToonMaterial({
  color: 0x3a1820, gradientMap: rampCloth,
  transparent: true, opacity: 0.5
});
addFresnelRim(matBlazer, 0xbcd4ff, 2.5, 0.30);

const SHOULDER_R = 0.16;
const SHOULDER_X = 0.41;
const SHOULDER_Y = 1.60;

const torsoGeo = roundedBoxGeometry(0.77, 0.88, 0.39, 0.07, 4);
const torso = new THREE.Mesh(torsoGeo, matBlazer.clone());
torso.position.y = 1.22;
torso.castShadow = true;
torso.receiveShadow = true;
character.add(torso);

const hemGeo = roundedBoxGeometry(0.77, 0.10, 0.39, 0.05, 3);
const hem = new THREE.Mesh(hemGeo, matBlazer.clone());
hem.position.y = 0.78;
hem.scale.set(0.92, 1.0, 0.98);
hem.castShadow = true;
character.add(hem);

const shoulderGeo = new THREE.SphereGeometry(SHOULDER_R, 16, 16);
const shoulderL = new THREE.Mesh(shoulderGeo, matBlazer.clone());
shoulderL.position.set( SHOULDER_X, SHOULDER_Y, 0);
shoulderL.scale.set(1.0, 0.70, 0.90);
shoulderL.castShadow = true;
character.add(shoulderL);
const shoulderR = new THREE.Mesh(shoulderGeo, matBlazer.clone());
shoulderR.position.set(-SHOULDER_X, SHOULDER_Y, 0);
shoulderR.scale.set(1.0, 0.70, 0.90);
shoulderR.castShadow = true;
character.add(shoulderR);

const lapelGeo = roundedBoxGeometry(0.14, 0.50, 0.03, 0.012, 2);
const LAPEL_TILT = THREE.MathUtils.degToRad(12);
const LAPEL_Y = 1.42;
const LAPEL_Z = 0.205;
const lapelL = new THREE.Mesh(lapelGeo, matBlazer.clone());
lapelL.position.set( 0.10, LAPEL_Y, LAPEL_Z);
lapelL.rotation.set(0, 0, -LAPEL_TILT);
lapelL.castShadow = true;
character.add(lapelL);
const lapelR = new THREE.Mesh(lapelGeo, matBlazer.clone());
lapelR.position.set(-0.10, LAPEL_Y, LAPEL_Z);
lapelR.rotation.set(0, 0,  LAPEL_TILT);
lapelR.castShadow = true;
character.add(lapelR);

const shirtV = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.28), matShirt.clone());
shirtV.position.set(0, 1.48, LAPEL_Z - 0.002);
character.add(shirtV);

const tieGeo = roundedBoxGeometry(0.077, 0.30, 0.022, 0.008, 2);
const tie = new THREE.Mesh(tieGeo, matTie.clone());
tie.position.set(0, 1.40, LAPEL_Z + 0.005);
tie.rotation.set(0, 0, THREE.MathUtils.degToRad(4));
tie.castShadow = true;
character.add(tie);

const tiePattern = new THREE.Mesh(new THREE.PlaneGeometry(0.060, 0.26), matTiePat);
tiePattern.position.set(0, 1.40, LAPEL_Z + 0.018);
tiePattern.rotation.set(0, 0, THREE.MathUtils.degToRad(4));
character.add(tiePattern);

const tieKnot = new THREE.Mesh(roundedBoxGeometry(0.085, 0.07, 0.035, 0.012, 2), matTie.clone());
tieKnot.position.set(0, 1.58, LAPEL_Z + 0.010);
tieKnot.castShadow = true;
character.add(tieKnot);

const neckBase = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 14), matSkin.clone());
neckBase.position.set(0, 1.66, 0.02);
neckBase.scale.set(1.0, 0.55, 0.95);
neckBase.castShadow = true;
character.add(neckBase);

const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.13, 18), matSkin.clone());
neck.position.y = 1.74;
neck.castShadow = true;
character.add(neck);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.30, 32, 24), matSkin.clone());
const HEAD_SCALE = 0.85;
head.scale.set(1.0 * HEAD_SCALE, 1.05 * HEAD_SCALE, 0.95 * HEAD_SCALE);
head.position.y = 1.95;
head.castShadow = true;
character.add(head);

// FACIAL FEATURES
const faceGroup = new THREE.Group();
faceGroup.position.set(0, 1.95, 0);
character.add(faceGroup);

const FACE_Z = 0.235;
const matFaceFeature = matSkin.clone();
const matEyeWhite = new THREE.MeshToonMaterial({ color: 0xfaf3e6, gradientMap: rampSkin });
const matEyePupil = new THREE.MeshToonMaterial({ color: 0x1a1208, gradientMap: rampSkin });
const matBrow     = new THREE.MeshToonMaterial({ color: 0x140d08, gradientMap: rampCloth });
const matLip      = new THREE.MeshToonMaterial({ color: 0x7a2418, gradientMap: rampSkin });
const matMouth    = new THREE.MeshToonMaterial({ color: 0x2a1410, gradientMap: rampCloth });
const matTooth    = new THREE.MeshToonMaterial({ color: 0xf4ece0, gradientMap: rampSkin });

const nose = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.07, 8), matFaceFeature);
nose.rotation.x = Math.PI / 2;
nose.position.set(0, -0.005, FACE_Z + 0.03);
faceGroup.add(nose);
const noseBridge = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.06, 0.025), matFaceFeature);
noseBridge.position.set(0, 0.04, FACE_Z + 0.012);
faceGroup.add(noseBridge);

const eyeSpacing = 0.062;
const eyeY = 0.062;
function makeEye(side) {
  const grp = new THREE.Group();
  grp.position.set(side * eyeSpacing, eyeY, FACE_Z + 0.005);
  grp.rotation.z = side * -THREE.MathUtils.degToRad(6);
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), matEyeWhite);
  white.scale.set(1.0, 0.55, 0.7);
  grp.add(white);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 10), matEyePupil);
  pupil.position.set(0, 0, 0.012);
  grp.add(pupil);
  // Catchlight stays MeshBasic (it's an emissive specular dot, not a lit surface).
  const cl = new THREE.Mesh(
    new THREE.SphereGeometry(0.0022, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  cl.position.set(0.0025, 0.001, 0.018);
  cl.userData.noOutline = true; // don't outline a 2mm sphere
  grp.add(cl);
  return grp;
}
faceGroup.add(makeEye(-1));
faceGroup.add(makeEye( 1));

const browBar = new THREE.BoxGeometry(0.052, 0.0085, 0.012);
const browL2 = new THREE.Mesh(browBar, matBrow);
browL2.position.set(-eyeSpacing, eyeY + 0.034, FACE_Z + 0.010);
browL2.rotation.z = THREE.MathUtils.degToRad(6);
faceGroup.add(browL2);
const browR2 = new THREE.Mesh(browBar, matBrow);
browR2.position.set( eyeSpacing, eyeY + 0.034, FACE_Z + 0.010);
browR2.rotation.z = THREE.MathUtils.degToRad(-6);
faceGroup.add(browR2);

const smile = new THREE.Mesh(
  new THREE.TorusGeometry(0.038, 0.0055, 8, 18, Math.PI),
  matLip
);
smile.rotation.x = Math.PI;
smile.position.set(0, -0.075, FACE_Z + 0.012);
faceGroup.add(smile);
const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.012, 0.012), matTooth);
teeth.position.set(0, -0.070, FACE_Z + 0.013);
faceGroup.add(teeth);
const mouthShadow = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.016, 0.008), matMouth);
mouthShadow.position.set(0, -0.071, FACE_Z + 0.008);
faceGroup.add(mouthShadow);

const earGeo = new THREE.SphereGeometry(0.030, 12, 10);
const earL = new THREE.Mesh(earGeo, matFaceFeature);
earL.scale.set(0.45, 1.0, 0.55);
earL.position.set(-0.218, -0.010, 0.0);
faceGroup.add(earL);
const earR = new THREE.Mesh(earGeo, matFaceFeature);
earR.scale.set(0.45, 1.0, 0.55);
earR.position.set( 0.218, -0.010, 0.0);
faceGroup.add(earR);

// HAIR
const hairBaseScale = 0.30;
const hairGroup = new THREE.Group();
hairGroup.position.set(0, 1.95, 0);
character.add(hairGroup);

const hairLayers = [
  { r: 0.95, y: 0.50, flat: 0.55, depth: 0.65 },
  { r: 0.85, y: 0.62, flat: 0.50, depth: 0.65 },
  { r: 0.65, y: 0.72, flat: 0.45, depth: 0.65 },
];
hairLayers.forEach((layer) => {
  const geom = new THREE.SphereGeometry(layer.r * hairBaseScale, 24, 16);
  const mesh = new THREE.Mesh(geom, matHair.clone());
  mesh.material.color.set(0x0e0805);
  mesh.position.set(
    0,
    layer.y * hairBaseScale + 0.10 * hairBaseScale,
    0.15 * hairBaseScale
  );
  mesh.scale.set(1.0, layer.flat, layer.depth || 1.0);
  mesh.castShadow = true;
  hairGroup.add(mesh);
});

const tuftMat = new THREE.MeshToonMaterial({ color: 0x0e0805, gradientMap: rampCloth });
const tuftCount = 5;
const tuftBaseY = 0.72 * hairBaseScale + 0.10 * hairBaseScale;
for (let i = 0; i < tuftCount; i++) {
  const tuftR = (0.05 + Math.random() * 0.03) * hairBaseScale;
  const tuftH = (0.18 + Math.random() * 0.10) * hairBaseScale;
  const tuft = new THREE.Mesh(new THREE.ConeGeometry(tuftR, tuftH, 8), tuftMat);
  const angle = (i / tuftCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
  const radius = (0.18 + Math.random() * 0.12) * hairBaseScale;
  tuft.position.set(
    Math.cos(angle) * radius,
    tuftBaseY + tuftH * 0.25,
    Math.sin(angle) * radius + 0.05 * hairBaseScale
  );
  tuft.rotation.set(
    (Math.random() - 0.5) * 0.9,
    Math.random() * Math.PI * 2,
    (Math.random() - 0.5) * 0.9
  );
  hairGroup.add(tuft);
}
const hair = hairGroup;

// ----------------------------------------------------------------
// v2 change #9 — ARMS with 4-FINGER + THUMB HANDS
// ----------------------------------------------------------------
// Soul's production specifically built jazz-pianist-detailed fingers
// because "hands are where the artist lives." v1 used mitten geometry;
// v2 replaces it with a proper palm + 4 finger groups + an opposable
// thumb. Each finger lives in its own group so future passes can
// animate per-finger curl (e.g., for the helmet grasp or the mug
// handle clutch). Keep finger geometry low-radius so the silhouette
// reads as "hand" not as "spider."
function makeFinger({ baseR = 0.012, tipR = 0.008, len = 0.045, segments = 8 } = {}) {
  const finger = new THREE.Group();
  // Base segment (proximal phalanx)
  const lower = new THREE.Mesh(
    new THREE.CylinderGeometry(baseR, baseR * 0.92, len, segments),
    matSkin.clone()
  );
  lower.geometry.translate(0, -len / 2, 0);
  lower.castShadow = true;
  finger.add(lower);
  // Mid knuckle ball
  const knuckle = new THREE.Mesh(
    new THREE.SphereGeometry(baseR * 0.95, 10, 8),
    matSkin.clone()
  );
  knuckle.position.y = -len;
  finger.add(knuckle);
  // Distal segment pivots from the knuckle — separate group so it can
  // be curled later without rebuilding geometry.
  const distal = new THREE.Group();
  distal.position.y = -len;
  finger.add(distal);
  const upper = new THREE.Mesh(
    new THREE.CylinderGeometry(baseR * 0.85, tipR, len * 0.78, segments),
    matSkin.clone()
  );
  upper.geometry.translate(0, -len * 0.39, 0);
  upper.castShadow = true;
  distal.add(upper);
  // Fingertip cap
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(tipR * 1.05, 10, 8),
    matSkin.clone()
  );
  tip.position.y = -len * 0.78;
  distal.add(tip);
  finger.userData = { distal };
  return finger;
}

function makeArm(side) {
  const s = side === "L" ? 1 : -1;
  const group = new THREE.Group();
  group.position.set(s * SHOULDER_X, SHOULDER_Y, 0);

  const upperArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.105, 0.40, 18, 1, false),
    matNavy.clone()
  );
  upperArm.geometry.translate(0, -0.20, 0);
  upperArm.castShadow = true;
  group.add(upperArm);

  const elbowBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.078, 16, 12),
    matNavy.clone()
  );
  elbowBall.position.set(0, -0.40, 0);
  elbowBall.castShadow = true;
  group.add(elbowBall);

  const elbow = new THREE.Group();
  elbow.position.set(0, -0.40, 0);
  group.add(elbow);

  const forearm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.085, 0.40, 18, 1, false),
    matNavy.clone()
  );
  forearm.geometry.translate(0, -0.20, 0);
  forearm.castShadow = true;
  elbow.add(forearm);

  const wrist = new THREE.Group();
  wrist.position.set(0, -0.40, 0);
  elbow.add(wrist);

  // Shirt cuff peeking from the sleeve end — toon white.
  const cuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.072, 0.025, 18),
    matShirt.clone()
  );
  cuff.position.y = -0.005;
  cuff.castShadow = true;
  wrist.add(cuff);

  // PALM — a proper soft block oriented along the forearm. Slightly
  // wider on the thumb side; gives the hand a definite "back of the
  // hand" plane.
  const palm = new THREE.Mesh(
    roundedBoxGeometry(0.105, 0.045, 0.115, 0.028, 3),
    matSkin.clone()
  );
  palm.position.set(0, -0.06, 0.025);
  palm.castShadow = true;
  wrist.add(palm);

  // FINGERS — 4 across the palm front edge. Pinky shortest, index
  // longest. Slight fan so they don't look like a paddle.
  // Inside vs. outside: thumb sits at -s on x (toward the body).
  const fingerSpecs = [
    // [xOff (fraction of palm half-width), len, baseR, tipR, fan(rad)]
    [ -0.42, 0.045, 0.0115, 0.0085, -0.10 ],  // pinky
    [ -0.14, 0.052, 0.0125, 0.0090, -0.04 ],  // ring
    [  0.14, 0.055, 0.0130, 0.0095,  0.02 ],  // middle (longest)
    [  0.42, 0.050, 0.0120, 0.0090,  0.08 ],  // index
  ];
  const fingerGroups = [];
  fingerSpecs.forEach(([xf, len, br, tr, fan]) => {
    const f = makeFinger({ baseR: br, tipR: tr, len, segments: 8 });
    f.position.set(
      s * xf * 0.105,         // mirror x by arm side
      -0.075,                 // below palm
      0.085                   // forward of palm centre
    );
    // Fan outward across the palm, plus a tiny forward droop so they
    // don't read as rigidly straight.
    f.rotation.set(0.12, 0, s * fan);
    wrist.add(f);
    fingerGroups.push(f);
  });

  // THUMB — opposable, set on the inside of the palm, separate so it
  // pivots from a thumb metacarpal joint at the base of the palm.
  const thumbMC = new THREE.Group();
  thumbMC.position.set(-s * 0.052, -0.045, 0.045);
  thumbMC.rotation.set(0.30, s * -0.20, s * 0.55); // splay
  wrist.add(thumbMC);
  const thumb = makeFinger({ baseR: 0.014, tipR: 0.010, len: 0.038, segments: 8 });
  thumbMC.add(thumb);

  // Slot for held props — kept at the same logical position as v1 so
  // CAM_B presets and the prop attach point line up without retuning.
  const propSlot = new THREE.Group();
  propSlot.position.set(0, -0.06, 0.02);
  wrist.add(propSlot);

  group.userData = {
    shoulder: group, elbow, wrist, hand: palm, propSlot, side,
    fingers: fingerGroups, thumb
  };
  return group;
}
const armL = makeArm("L");
const armR = makeArm("R");
character.add(armL);
character.add(armR);

function setIdle() {
  armL.rotation.set(-1.40, 0, -0.18);
  armL.userData.elbow.rotation.set(0.55, 0, 0);
  armL.userData.wrist.rotation.set(0.35, 0, 0);

  armR.rotation.set(-1.40, 0, 0.18);
  armR.userData.elbow.rotation.set(0.55, 0, 0);
  armR.userData.wrist.rotation.set(0.35, 0, 0);
}
setIdle();


// ----------------------------------------------------------------
// PROPS
// ----------------------------------------------------------------
const props = new THREE.Group();
scene.add(props);

function tagProp(obj, id) {
  obj.userData.id = id;
  obj.userData.restPos = obj.position.clone();
  obj.userData.restRot = obj.rotation.clone();
  obj.traverse((c) => { if (c.isMesh) { c.userData.propId = id; c.castShadow = true; } });
  return obj;
}

const DESK_SURFACE_Y = 0.80;

// PORTFOLIO — toon cover/pages, Standard gold spine.
const portfolio = new THREE.Group();
const cover = new THREE.Mesh(
  roundedBoxGeometry(0.45, 0.045, 0.32, 0.018, 2),
  new THREE.MeshToonMaterial({ color: 0x2a2520, gradientMap: rampCloth })
);
const pages = new THREE.Mesh(
  roundedBoxGeometry(0.42, 0.022, 0.30, 0.008, 2),
  new THREE.MeshToonMaterial({ color: 0xf4f1ea, gradientMap: rampCloth })
);
pages.position.y = 0.002;
const spine = new THREE.Mesh(
  roundedBoxGeometry(0.04, 0.05, 0.32, 0.012, 2),
  matGold.clone()
);
spine.position.x = -0.205;
spine.position.y = 0.003;
portfolio.add(cover);
portfolio.add(pages);
portfolio.add(spine);
portfolio.position.set(0.58, DESK_SURFACE_Y + 0.025, 0.10);
portfolio.rotation.y = -0.21;
props.add(tagProp(portfolio, "portfolio"));

// IRON MAN HELMET — stays largely Standard PBR so it picks up the new
// env map. With PMREM env bound, the red/gold actually reflect a room
// and stop reading as matte plastic — this is the single biggest
// per-prop win in v2.
const helmet = new THREE.Group();

const helmetRed  = new THREE.MeshStandardMaterial({
  color: 0x8b0a0a, metalness: 0.90, roughness: 0.28,
  roughnessMap: noiseRough, envMapIntensity: 1.2
});
const helmetGold = new THREE.MeshStandardMaterial({
  color: 0xcaa14a, metalness: 0.95, roughness: 0.22,
  roughnessMap: noiseRough, envMapIntensity: 1.4
});
const slitGlowMat = new THREE.MeshStandardMaterial({
  color: 0xc4f0ff, emissive: 0x7fdfff, emissiveIntensity: 2.5, metalness: 0, roughness: 0.4
});
// Cool fresnel on the helmet red so the silhouette pops
addFresnelRim(helmetRed, 0xffe0c0, 3.2, 0.25);

const S = 0.13;

const cranium = new THREE.Mesh(new THREE.SphereGeometry(S * 1.0, 28, 24), helmetRed);
cranium.scale.set(1.0, 1.05, 1.15);
cranium.castShadow = true;
cranium.receiveShadow = true;
helmet.add(cranium);

const fpShape = new THREE.Shape();
fpShape.moveTo(-0.62,  0.20);
fpShape.lineTo(-0.10,  0.32);
fpShape.lineTo( 0.00,  0.20);
fpShape.lineTo( 0.10,  0.32);
fpShape.lineTo( 0.62,  0.20);
fpShape.lineTo( 0.58, -0.05);
fpShape.lineTo( 0.40, -0.45);
fpShape.lineTo( 0.12, -0.80);
fpShape.lineTo( 0.00, -0.92);
fpShape.lineTo(-0.12, -0.80);
fpShape.lineTo(-0.40, -0.45);
fpShape.lineTo(-0.58, -0.05);
fpShape.lineTo(-0.62,  0.20);

const fpGeo = new THREE.ExtrudeGeometry(fpShape, {
  depth: 0.20,
  bevelEnabled: true, bevelThickness: 0.020, bevelSize: 0.018, bevelSegments: 4,
  curveSegments: 2
});
fpGeo.scale(S * 0.95, S * 0.95, S);
fpGeo.translate(0, 0, S * 1.10);
const faceplate = new THREE.Mesh(fpGeo, helmetGold);
faceplate.castShadow = true;
faceplate.receiveShadow = true;
helmet.add(faceplate);

const browGeo = new THREE.BoxGeometry(0.36 * S, 0.020 * S, 0.060 * S);
const browL = new THREE.Mesh(browGeo, helmetGold);
browL.position.set(-0.32 * S, 0.26 * S, S * 1.32);
browL.rotation.z = THREE.MathUtils.degToRad(-12);
helmet.add(browL);
const browR = new THREE.Mesh(browGeo, helmetGold);
browR.position.set( 0.32 * S, 0.26 * S, S * 1.32);
browR.rotation.z = THREE.MathUtils.degToRad(12);
helmet.add(browR);

const slitGeo = new THREE.PlaneGeometry(0.34 * S, 0.085 * S);
const slitL = new THREE.Mesh(slitGeo, slitGlowMat);
slitL.position.set(-0.27 * S, 0.10 * S, S * 1.34);
slitL.rotation.z = THREE.MathUtils.degToRad(15);
helmet.add(slitL);
const slitR = new THREE.Mesh(slitGeo, slitGlowMat);
slitR.position.set( 0.27 * S, 0.10 * S, S * 1.34);
slitR.rotation.z = THREE.MathUtils.degToRad(-15);
helmet.add(slitR);

const slitLight = new THREE.PointLight(0x7fdfff, 0.45, 0.5, 2);
slitLight.position.set(0, 0.10 * S, S * 1.10);
helmet.add(slitLight);

const grilleBase = new THREE.Mesh(new THREE.BoxGeometry(0.42 * S, 0.10 * S, 0.04 * S), helmetGold);
grilleBase.position.set(0, -0.62 * S, S * 1.32);
helmet.add(grilleBase);
const darkSlat = new THREE.MeshStandardMaterial({
  color: 0x1a1410, roughness: 0.8, roughnessMap: noiseRough
});
for (let i = 0; i < 5; i++) {
  const slat = new THREE.Mesh(new THREE.BoxGeometry(0.018 * S, 0.085 * S, 0.06 * S), darkSlat);
  slat.position.set((i - 2) * (0.075 * S), -0.62 * S, S * 1.36);
  helmet.add(slat);
}

const tplGeo = new THREE.BoxGeometry(0.10 * S, 0.45 * S, 0.18 * S);
const templeL = new THREE.Mesh(tplGeo, helmetRed);
templeL.position.set(-0.78 * S, 0.0 * S, S * 0.60);
templeL.rotation.y = THREE.MathUtils.degToRad(-22);
helmet.add(templeL);
const templeR = new THREE.Mesh(tplGeo, helmetRed);
templeR.position.set( 0.78 * S, 0.0 * S, S * 0.60);
templeR.rotation.y = THREE.MathUtils.degToRad(22);
helmet.add(templeR);

const hingeGeo = new THREE.BoxGeometry(0.012 * S, 0.30 * S, 0.04 * S);
const hingeMat = new THREE.MeshStandardMaterial({
  color: 0x1a1410, roughness: 0.7, roughnessMap: noiseRough
});
const hingeL = new THREE.Mesh(hingeGeo, hingeMat);
hingeL.position.set(-0.55 * S, -0.30 * S, S * 1.20);
hingeL.rotation.z = THREE.MathUtils.degToRad(-10);
helmet.add(hingeL);
const hingeR = new THREE.Mesh(hingeGeo, hingeMat);
hingeR.position.set( 0.55 * S, -0.30 * S, S * 1.20);
hingeR.rotation.z = THREE.MathUtils.degToRad(10);
helmet.add(hingeR);

helmet.position.set(-0.72, DESK_SURFACE_Y + 0.05, -0.05);
helmet.rotation.y = 0.0;
props.add(tagProp(helmet, "helmet"));

// CAD MODEL
const cad = new THREE.Group();
const cadKnot = new THREE.Mesh(
  new THREE.TorusKnotGeometry(0.08, 0.025, 80, 14),
  new THREE.MeshStandardMaterial({
    color: 0x4d6dd9, roughness: 0.35, metalness: 0.6,
    roughnessMap: noiseRough, envMapIntensity: 1.0
  })
);
cadKnot.position.y = 0.12;
cad.add(cadKnot);
const cadBase = new THREE.Mesh(
  new THREE.BoxGeometry(0.18, 0.02, 0.18),
  matPaper.clone()
);
cadBase.position.y = 0.01;
cad.add(addEdges(cadBase, INK, 0.7));
cad.position.set(0.10, DESK_SURFACE_Y + 0.005, -0.18);
cad.rotation.y = 0.18;
props.add(tagProp(cad, "cad"));

// RECOMMENDATION LETTER
const letter = new THREE.Group();
const sheet = new THREE.Mesh(
  new THREE.BoxGeometry(0.28, 0.005, 0.22),
  new THREE.MeshToonMaterial({ color: 0xfdfbf6, gradientMap: rampCloth })
);
sheet.position.y = 0.0025;
letter.add(addEdges(sheet, 0xb5ad99, 0.6));
for (let i = 0; i < 6; i++) {
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.0008, 0.005),
    new THREE.MeshToonMaterial({ color: 0x6b6256, gradientMap: rampCloth })
  );
  line.position.set(-0.02, 0.006, -0.07 + i * 0.025);
  letter.add(line);
}
letter.position.set(0.34, DESK_SURFACE_Y + 0.003, 0.34);
letter.rotation.y = 0.42;
props.add(tagProp(letter, "letter"));

// COFFEE MUG
const mug = new THREE.Group();
const mugBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.06, 0.05, 0.13, 24),
  new THREE.MeshToonMaterial({ color: 0xf4f1ea, gradientMap: rampCloth })
);
mugBody.position.y = 0.065;
mug.add(addEdges(mugBody, INK, 0.4));
const coffee = new THREE.Mesh(
  new THREE.CircleGeometry(0.05, 24),
  new THREE.MeshStandardMaterial({
    color: 0x3a261a, roughness: 0.4, metalness: 0.05,
    roughnessMap: noiseRough, envMapIntensity: 0.8
  })
);
coffee.rotation.x = -Math.PI / 2;
coffee.position.y = 0.128;
mug.add(coffee);
const mugRim = new THREE.Mesh(
  new THREE.TorusGeometry(0.06, 0.005, 8, 24),
  new THREE.MeshToonMaterial({ color: 0xebe6dc, gradientMap: rampCloth })
);
mugRim.rotation.x = Math.PI / 2;
mugRim.position.y = 0.13;
mug.add(mugRim);
const handle = new THREE.Mesh(
  new THREE.TorusGeometry(0.035, 0.012, 8, 18, Math.PI),
  new THREE.MeshToonMaterial({ color: 0xf4f1ea, gradientMap: rampCloth })
);
handle.position.set(0.06, 0.06, 0);
handle.rotation.y = Math.PI / 2;
mug.add(handle);

const mugCoaster = new THREE.Mesh(
  new THREE.CylinderGeometry(0.085, 0.085, 0.008, 24),
  new THREE.MeshToonMaterial({ color: 0x2a2520, gradientMap: rampCloth })
);
mugCoaster.position.set(1.00, DESK_SURFACE_Y + 0.004, -0.10);
mugCoaster.receiveShadow = true;
props.add(mugCoaster);

mug.position.set(1.00, DESK_SURFACE_Y + 0.008, -0.10);
mug.rotation.y = -0.22;
props.add(tagProp(mug, "mug"));

const propsList = ["portfolio", "helmet", "cad", "letter", "mug"];
const propMap = {};
props.children.forEach((g) => { if (g.userData && g.userData.id) propMap[g.userData.id] = g; });

// ----------------------------------------------------------------
// v2 change #8 (continued) — per-prop AO contact discs
// ----------------------------------------------------------------
// One small dark radial-gradient disc just above the desk surface
// under each prop. Reads as ambient occlusion contact at almost zero
// cost. Discs don't get outlines (userData.noOutline = true inside
// makeContactDisc).
(function addPropContactDiscs() {
  const discs = [
    { id: "portfolio", r: 0.30, op: 0.35 },
    { id: "helmet",    r: 0.22, op: 0.45 },
    { id: "cad",       r: 0.15, op: 0.30 },
    { id: "letter",    r: 0.20, op: 0.30 },
    { id: "mug",       r: 0.13, op: 0.40 },
  ];
  discs.forEach(({ id, r, op }) => {
    const prop = propMap[id]; if (!prop) return;
    const d = makeContactDisc(r, op);
    d.position.set(prop.position.x, DESK_SURFACE_Y + 0.001, prop.position.z);
    d.scale.setScalar(1.05);
    scene.add(d);
  });
})();

// ----------------------------------------------------------------
// v2 change #4 — INVERTED-HULL OUTLINES on the character group
// ----------------------------------------------------------------
// Clone each mesh, scale slightly along normals, render back-face only
// in flat black. The Soul-correct subtle "drawn line" silhouette.
// IMPORTANT: only applied to the character group — props and furniture
// stay outline-free so the stylized-character / real-environment
// tension reads. Meshes with userData.noOutline = true are skipped
// (catchlights, AO discs, etc.).
const _outlineMat = new THREE.MeshBasicMaterial({
  color: 0x14171c, side: THREE.BackSide, fog: false
});
function addOutlinesToGroup(group, thicknessByName = {}, defaultThickness = 1.022) {
  const outlines = [];
  group.traverse((node) => {
    if (!node.isMesh) return;
    if (node.userData && node.userData.noOutline) return;
    // Don't outline the eye catchlight (already skipped), the cone tufts
    // (too thin — outlines fight each other), or anything tinier than
    // a finger segment.
    const bb = new THREE.Box3().setFromBufferAttribute(node.geometry.attributes.position);
    const sz = bb.getSize(new THREE.Vector3());
    if (Math.max(sz.x, sz.y, sz.z) < 0.005) return;
    const t = thicknessByName[node.name] || defaultThickness;
    const hull = new THREE.Mesh(node.geometry, _outlineMat);
    hull.scale.setScalar(t);
    hull.userData.noOutline = true;
    hull.renderOrder = -2;
    node.add(hull);
    outlines.push(hull);
  });
  return outlines;
}
// Tuned per region: thicker on hands (small geometry, needs the bump),
// thinner on the head (a thick outline on a face reads cartoony-cheap).
addOutlinesToGroup(character, {}, 1.018);

// ----------------------------------------------------------------
// RAYCASTER + INTERACTION (unchanged from v1)
// ----------------------------------------------------------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null;
let state = "idle";
let currentProp = null;

const captions = {
  portfolio: "the portfolio — open it",
  helmet:    "the helmet — put it on",
  cad:       "the FEA study — examine it",
  letter:    "the letter — read it",
  mug:       "the coffee — pick it up",
};

function setCaption(t) {
  const el = $("#caption");
  if (!el) return;
  el.classList.add("is-hidden");
  setTimeout(() => { el.textContent = t; el.classList.remove("is-hidden"); }, 180);
}

function pickPropAt(clientX, clientY) {
  if (state !== "idle") return null;
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObject(props, true);
  if (!hits.length) return null;
  let n = hits[0].object;
  while (n && !n.userData.id) n = n.parent;
  return n;
}

window.addEventListener("pointermove", (e) => {
  const p = pickPropAt(e.clientX, e.clientY);
  if (p && p !== hovered) {
    hovered = p;
    setCaption(captions[p.userData.id] || "pick it up");
    if (cursor) cursor.classList.add("is-hover");
  } else if (!p && hovered) {
    hovered = null;
    setCaption("Pick something up");
    if (cursor) cursor.classList.remove("is-hover");
  }
});

window.addEventListener("click", (e) => {
  if (state !== "idle") return;
  const p = pickPropAt(e.clientX, e.clientY);
  if (p) triggerPickup(p);
});

function goBack() { if (state === "pov") returnToDesk(); }
window.addEventListener("keydown", (e) => { if (e.key === "Escape") goBack(); });
$("#back").addEventListener("click", goBack);

// ----------------------------------------------------------------
// CUSTOM CURSOR
// ----------------------------------------------------------------
const cursor = document.createElement("div");
cursor.className = "cursor";
document.body.appendChild(cursor);
let cx = 0, cy = 0, tx = 0, ty = 0;
window.addEventListener("mousemove", (e) => { tx = e.clientX; ty = e.clientY; });

// ----------------------------------------------------------------
// v2 change #5 — POST-PROCESSING (composer + bloom + vignette/grain)
// ----------------------------------------------------------------
// Bloom: gentle, high-threshold so only true highlights bloom — the
//        helmet's gold edges, the cyan eye slits, the warmest hair
//        catchlight. Not "everything is glowing."
// Vignette + grain: combined in a single shader pass (one full-screen
//        fragment, fed by tDiffuse from the bloom output).
// The vignette and bloom strength tween in/out on POV entry, giving
// the two-mode visual switch that Soul does between NYC and the Great
// Before.
const composer = new THREE.EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new THREE.RenderPass(scene, camera));

const bloom = new THREE.UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.35,   // strength
  0.65,   // radius
  0.85    // threshold — protects the cream backdrop from glowing
);
composer.addPass(bloom);

// Vignette + grain shader pass (single fragment, one pass)
const VignetteGrainShader = {
  uniforms: {
    tDiffuse:  { value: null },
    uVignette: { value: 0.45 },   // 0 = none, 1 = strong corners
    uGrain:    { value: 0.030 },  // 0..1; 0.03 ≈ a barely-there film grain
    uTime:     { value: 0 }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uTime;
    varying vec2 vUv;
    // hash-based noise — cheap, no texture needed
    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p + 19.19);
      return fract((p.x + p.y) * p.x);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // Vignette — soft radial darkening from the corners.
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      float vig = 1.0 - smoothstep(0.20, 0.90, r2 * 2.0) * uVignette;
      c.rgb *= vig;
      // Grain — sub-pixel jitter modulated by time for a film cell flicker.
      float g = (hash(vUv * vec2(1920.0, 1080.0) + uTime) - 0.5) * uGrain;
      c.rgb += g;
      gl_FragColor = c;
    }
  `
};
const vigPass = new THREE.ShaderPass(VignetteGrainShader);
vigPass.renderToScreen = true;
composer.addPass(vigPass);

// ----------------------------------------------------------------
// CAMERA TWEEN (unchanged)
// ----------------------------------------------------------------
const gsap = window.gsap;
function tweenCamera(targetPos, targetLook, fov = 38, dur = 1.45) {
  gsap.to(camFocus, {
    x: targetLook.x, y: targetLook.y, z: targetLook.z,
    duration: dur * 0.95, ease: "power3.out"
  });
  gsap.to(camera.position, {
    x: targetPos.x, y: targetPos.y, z: targetPos.z,
    duration: dur, delay: 0.10, ease: "expo.inOut"
  });
  const live = { fov: camera.fov };
  gsap.to(live, {
    fov, duration: dur * 1.05, delay: 0.15, ease: "power2.inOut",
    onUpdate: () => { camera.fov = live.fov; camera.updateProjectionMatrix(); }
  });
  return dur + 0.15;
}

function chooseArm(prop) {
  return prop.position.x >= 0 ? armL : armR;
}

// ----------------------------------------------------------------
// 4-BEAT PICKUP + two-mode post tween
// ----------------------------------------------------------------
function triggerPickup(prop) {
  state = "picking";
  currentProp = prop;
  hovered = null;
  if (cursor) cursor.classList.remove("is-hover");
  setCaption("");
  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(camFocus);
  gsap.killTweensOf(camera);
  gsap.killTweensOf(bloom);
  gsap.killTweensOf(vigPass.uniforms.uVignette);

  const arm = chooseArm(prop);
  const isLeft = (arm === armL);
  const dir = isLeft ? 1 : -1;
  const otherArm = isLeft ? armR : armL;
  const slot = arm.userData.propSlot;

  const tl = gsap.timeline();

  // BEAT 1 — SETTLE
  tl.to(character.rotation, { y: dir * 0.14, duration: 0.18, ease: "power2.out" }, 0);
  tl.to(head.rotation, { y: dir * 0.38, x: 0.22, duration: 0.18, ease: "power2.out" }, 0);
  tl.to(torso.rotation, { z: dir * 0.05, duration: 0.18, ease: "power2.out" }, 0);

  // BEAT 2 — ANTICIPATE
  tl.to(arm.rotation, { x: -1.14, duration: 0.12, ease: "power2.in" }, 0.18);
  tl.to(arm.userData.elbow.rotation, { x: 0.30, duration: 0.12, ease: "power2.in" }, 0.18);
  tl.to(otherArm.rotation, { z: dir * 0.04, duration: 0.12, ease: "power2.in" }, 0.18);

  // BEAT 3 — REACH
  tl.to(arm.rotation, {
    x: -2.10, y: dir * 0.25, z: dir * 0.15,
    duration: 0.38, ease: "power2.out"
  }, 0.30);
  tl.to(arm.userData.elbow.rotation, { x: 0.45, duration: 0.34, ease: "power2.out" }, 0.30);
  tl.to(arm.userData.wrist.rotation, { x: -0.20, duration: 0.30, ease: "power2.out" }, 0.36);

  // GRAB
  tl.add(() => {
    prop.userData.worldRest = prop.matrixWorld.clone();
    THREE.Object3D.prototype.attach.call(slot, prop);
    gsap.to(prop.position, { x: 0, y: 0, z: 0, duration: 0.20, ease: "power2.out" });
    gsap.to(prop.rotation, { x: 0, y: 0, z: 0, duration: 0.20, ease: "power2.out" });
  }, 0.68);

  // BEAT 4 — LIFT
  tl.to(arm.rotation, { x: -2.50, duration: 0.28, ease: "power2.inOut" }, 0.72);
  tl.to(arm.userData.elbow.rotation, { x: 1.10, duration: 0.28, ease: "power2.inOut" }, 0.72);
  tl.to(otherArm.rotation, { z: -dir * 0.10, duration: 0.28, ease: "power2.inOut" }, 0.72);
  tl.to(head.rotation, { x: 0.38, duration: 0.28, ease: "power2.inOut" }, 0.72);

  // CAMERA DOLLY at t=1.04, total ~1.45s
  const cam = CAM_B[prop.userData.id];
  const camDur = 1.45;
  tl.add(() => { tweenCamera(cam.pos, cam.look, cam.fov, camDur); }, 1.04);

  // POV-mode post tween: bloom up, vignette deeper. Echoes Soul's
  // "different lens for different worlds." Helmet POV gets the most
  // dramatic push because it's the most cinematic moment.
  const isHelmet = prop.userData.id === "helmet";
  gsap.to(bloom, {
    strength: isHelmet ? 0.85 : 0.55,
    duration: camDur, delay: 1.04, ease: "power2.inOut"
  });
  gsap.to(vigPass.uniforms.uVignette, {
    value: isHelmet ? 0.75 : 0.60,
    duration: camDur, delay: 1.04, ease: "power2.inOut"
  });

  const overlayAt = 1.04 + 0.10 + camDur * 0.92;
  tl.add(() => {
    state = "pov";
    showPovOverlay(prop.userData.id);
    $("#back").hidden = false;
  }, overlayAt);
}

// ----------------------------------------------------------------
// RETURN — also unwinds the post-mode push.
// ----------------------------------------------------------------
function returnToDesk() {
  state = "returning";
  hidePovOverlay();
  $("#back").hidden = true;
  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(camFocus);
  gsap.killTweensOf(camera);
  gsap.killTweensOf(bloom);
  gsap.killTweensOf(vigPass.uniforms.uVignette);

  const rDur = 0.9;
  gsap.to(camera.position, { x: CAM_A.pos.x, y: CAM_A.pos.y, z: CAM_A.pos.z, duration: rDur, ease: "power4.out" });
  gsap.to(camFocus, { x: CAM_A.look.x, y: CAM_A.look.y, z: CAM_A.look.z, duration: rDur, ease: "power4.out" });
  const live = { fov: camera.fov };
  gsap.to(live, {
    fov: 38, duration: rDur, ease: "power4.out",
    onUpdate: () => { camera.fov = live.fov; camera.updateProjectionMatrix(); }
  });
  // Ease post chain back to third-person values
  gsap.to(bloom, { strength: 0.35, duration: rDur, ease: "power4.out" });
  gsap.to(vigPass.uniforms.uVignette, { value: 0.45, duration: rDur, ease: "power4.out" });

  const prop = currentProp;
  if (prop) {
    THREE.Object3D.prototype.attach.call(props, prop);
    gsap.to(prop.position, { x: prop.userData.restPos.x, y: prop.userData.restPos.y, z: prop.userData.restPos.z, duration: rDur, ease: "power4.out" });
    gsap.to(prop.rotation, { x: prop.userData.restRot.x, y: prop.userData.restRot.y, z: prop.userData.restRot.z, duration: rDur, ease: "power4.out" });
  }

  gsap.to(armL.rotation, { x: -1.40, y: 0, z: -0.18, duration: rDur, ease: "power4.out" });
  gsap.to(armL.userData.elbow.rotation, { x: 0.55, y: 0, z: 0, duration: rDur, ease: "power4.out" });
  gsap.to(armL.userData.wrist.rotation, { x: 0.35, y: 0, z: 0, duration: rDur, ease: "power4.out" });
  gsap.to(armR.rotation, { x: -1.40, y: 0, z: 0.18, duration: rDur, ease: "power4.out" });
  gsap.to(armR.userData.elbow.rotation, { x: 0.55, y: 0, z: 0, duration: rDur, ease: "power4.out" });
  gsap.to(armR.userData.wrist.rotation, { x: 0.35, y: 0, z: 0, duration: rDur, ease: "power4.out" });
  gsap.to(character.rotation, { y: 0, duration: rDur, ease: "power4.out" });
  gsap.to(head.rotation, { x: 0, y: 0, duration: rDur, ease: "power4.out" });
  gsap.to(torso.rotation, { z: 0, duration: rDur, ease: "power4.out" });

  gsap.delayedCall(rDur, () => {
    state = "idle";
    currentProp = null;
    setCaption("Pick something up");
  });
}

function showPovOverlay(id) {
  const map = { portfolio: "#povPortfolio", helmet: "#povHelmet", cad: "#povCad", letter: "#povLetter", mug: "#povMug" };
  const sel = map[id]; if (!sel) return;
  const el = document.querySelector(sel); if (el) el.hidden = false;
}
function hidePovOverlay() {
  ["#povPortfolio", "#povHelmet", "#povCad", "#povLetter", "#povMug"].forEach((s) => {
    const el = document.querySelector(s); if (el) el.hidden = true;
  });
}

// ----------------------------------------------------------------
// AMBIENT IDLE
// ----------------------------------------------------------------
const T0 = performance.now();
const HEAD_BASE_Y = head.position.y;
const TORSO_BASE_Y = torso.position.y;

function ambientIdle() {
  const t = (performance.now() - T0) / 1000;
  const breath = Math.sin((t * Math.PI * 2) / 3.2);
  torso.scale.y = 1.0 + breath * 0.004;
  head.position.y = HEAD_BASE_Y + breath * 0.0017;

  if (state === "idle") {
    const yawTarget = Math.sin((t * Math.PI * 2) / 4.0) * (0.4 * Math.PI / 180);
    const pitchTarget = Math.sin((t * Math.PI * 2) / 4.0 + Math.PI / 3) * (0.4 * Math.PI / 180) * 0.6;
    head.rotation.y = lerp(head.rotation.y, yawTarget, 0.04);
    head.rotation.x = lerp(head.rotation.x, pitchTarget, 0.04);
  }
}

// ----------------------------------------------------------------
// ANIMATION LOOP — render through the composer
// ----------------------------------------------------------------
function tick() {
  cx += (tx - cx) * 0.28;
  cy += (ty - cy) * 0.28;
  if (cursor) cursor.style.transform = `translate3d(${cx}px,${cy}px,0) translate(-50%,-50%)`;
  ambientIdle();
  camera.lookAt(camFocus);
  vigPass.uniforms.uTime.value = (performance.now() - T0) * 0.001;
  composer.render();
  requestAnimationFrame(tick);
}

// ----------------------------------------------------------------
// RESIZE — composer + bloom + camera
// ----------------------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
});

// ----------------------------------------------------------------
// PRELOADER DISMISS
// ----------------------------------------------------------------
function dismissCurtain() {
  const c = $("#curtain"); const cc = $("#curtainCount");
  let n = 0;
  const id = setInterval(() => {
    n = Math.min(100, n + 6 + Math.random() * 8);
    if (cc) cc.textContent = `building the desk · ${String(Math.floor(n)).padStart(2,"0")}%`;
    if (n >= 100) {
      clearInterval(id);
      setTimeout(() => c && c.classList.add("is-done"), 200);
    }
  }, 60);
}

// ----------------------------------------------------------------
// WINDOW DEBUG GLOBALS
// ----------------------------------------------------------------
window.__scene__ = scene;
window.__camera__ = camera;
window.__composer__ = composer;
window.__bloom__ = bloom;
window.__vig__ = vigPass;
window.__getState = function() { return state; };
window.__pickById = function(id) {
  const prop = propMap[id];
  if (!prop) { console.warn("No prop", id); return; }
  if (state !== "idle") { console.warn("Not idle:", state); return; }
  triggerPickup(prop);
};
window.__backToDesk = function() { if (state === "pov") returnToDesk(); };

// ----------------------------------------------------------------
// BOOT
// ----------------------------------------------------------------
setIdle();
composer.render();
tick();
dismissCurtain();
