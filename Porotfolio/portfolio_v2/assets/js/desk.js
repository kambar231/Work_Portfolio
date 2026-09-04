/* ====================================================================
   Kambar - the desk experience
   Three.js + GSAP. Pure code, no external assets except portrait fallback.
   Renders a sitting engineer at a desk; click a prop to pick it up;
   camera dollies from third-person to first-person POV; POV overlay
   reveals the relevant project content.
   ==================================================================== */
// THREE and gsap are global (loaded via <script> tags in desk.html)

const PAPER = 0xf4f1ea;
const INK   = 0x14171c;
const NAVY  = 0x1f3a99;   // deeper, more punchy navy
const RED   = 0xb82a18;   // saturated lacquer — survives ACES/Cineon desaturation
const GOLD  = 0xd6a72a;
const WOOD  = 0x6d4a2c;   // proper deep walnut
const SKIN  = 0xe6c39a;
const HAIR  = 0x1a1410;   // deep near-black brown

const $ = (s) => document.querySelector(s);
const lerp = (a, b, t) => a + (b - a) * t;

// ----------------------------------------------------------------
// RENDERER + SCENE + CAMERA
// ----------------------------------------------------------------
const stage = $("#stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
// r148 color pipeline — without this every color is gamma-crushed twice.
// All material .color values + maps are authored in sRGB (the default).
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.CineonToneMapping;
renderer.toneMappingExposure = 1.00;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Gradient sky — painted to a canvas so the back of the room doesn't read flat.
// Horizon: #e8e2d4 (warm cream)  →  zenith: #d6cebc (cooler paper-grey).
(function buildSky() {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#d6cebc");   // top
  grad.addColorStop(1, "#e8e2d4");   // horizon
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  tex.needsUpdate = true;
  scene.background = tex;
})();
// Lighter, deeper fog so distant edges fall off without dust-clouding the foreground.
scene.fog = new THREE.Fog(0xe2dccc, 12, 28);

const camera = new THREE.PerspectiveCamera(
  38, window.innerWidth / window.innerHeight, 0.1, 100
);
// Camera A — third-person framing
const CAM_A = { pos: new THREE.Vector3(0, 1.30, 3.80), look: new THREE.Vector3(0, 1.10, 0) };
// Persistent look-at target. The animation loop calls camera.lookAt(camFocus) every frame
// so that tween of camera position OR camFocus produces a smooth, decoupled move.
const camFocus = new THREE.Vector3().copy(CAM_A.look);
camera.position.copy(CAM_A.pos);
camera.lookAt(camFocus);

// Camera B presets per prop (first-person framing)
// Each prop has a unique POV target — head height, looking down to where the prop ends up
// Character eyes at world ~(0, 1.71, -0.6). After pickup the prop ends up roughly
// at (s*0.4, 1.19, 0.12) where s=+1 for right arm (portfolio, cad, mug) and -1 for
// left arm (helmet, letter). POV camera = at the eyes, looking at the prop.
// FRAMING RULE: every POV MUST include a slice of the human — shoulder, helmet
// curve, or the edge of the hand holding the prop. Without that anchor the shot
// becomes a floating still life and the character disappears. Each preset is
// biased OFF-CENTER toward the side OPPOSITE the reaching arm so the working
// shoulder/upper-arm sits as a foreground silhouette on one edge of frame, and
// the head crown clips in from above.
const CAM_B = {
  // Right-arm props (portfolio, cad, mug) — camera nudged LEFT and slightly forward,
  // so the right shoulder rolls into the lower-right corner as a navy-blue mass.
  portfolio: { pos: new THREE.Vector3(-0.22, 2.18, -0.95), look: new THREE.Vector3( 0.30, 1.16,  0.08), fov: 44 },
  cad:       { pos: new THREE.Vector3(-0.22, 2.22, -0.95), look: new THREE.Vector3( 0.30, 1.22,  0.08), fov: 44 },
  mug:       { pos: new THREE.Vector3(-0.22, 2.18, -0.95), look: new THREE.Vector3( 0.30, 1.18,  0.08), fov: 44 },
  // Left-arm props (letter, helmet) — mirror: camera nudged RIGHT.
  letter:    { pos: new THREE.Vector3( 0.22, 2.18, -0.95), look: new THREE.Vector3(-0.30, 1.16,  0.08), fov: 44 },
  // Helmet is larger and held higher — slightly wider FOV, higher cam, look-point
  // lifted so the red dome crowns the frame while the holding hand still reads at
  // the bottom edge.
  helmet:    { pos: new THREE.Vector3( 0.22, 2.24, -0.93), look: new THREE.Vector3(-0.30, 1.26,  0.10), fov: 48 },
};

// ----------------------------------------------------------------
// LIGHTING — 3-light portrait rig + hemisphere ambient
// ----------------------------------------------------------------
// Hemisphere replaces the flat AmbientLight: sky tint above, ground bounce below.
// This is what makes the desk underside and chair cavity read as "in a room"
// instead of the same value as the floor.
const hemi = new THREE.HemisphereLight(0xcfd9e8, 0xc9b89a, 0.20);
scene.add(hemi);

// KEY — warm ~3200K tungsten, camera-left and high. The portrait light.
// 3200K in linear ≈ a creamy peach: r=1.0, g≈0.78, b≈0.54  →  0xffc88a-ish.
const key = new THREE.DirectionalLight(0xffc89a, 1.1);
key.position.set(-3.8, 5.6, 3.2);   // camera-left, high
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

// FILL — cool ~6500K daylight sky bounce from above. Lifts shadow side without colour-clash.
const fill = new THREE.DirectionalLight(0xbcd4ff, 0.35);
fill.position.set(2.2, 5.0, 1.6);   // above and slightly camera-right
scene.add(fill);

// RIM — tight, behind-right, separates the character silhouette from the back wall.
// Slightly cool so it reads as window spill, contrasting the warm key.
const rim = new THREE.DirectionalLight(0xf2f6ff, 0.6);
rim.position.set(2.8, 3.4, -3.6);   // behind-right
scene.add(rim);

// ----------------------------------------------------------------
// MATERIALS — physically calibrated for the portrait rig
// All .color values are authored in sRGB (default in r148).
// ----------------------------------------------------------------
const matPaper  = new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.95, metalness: 0 });
const matInk    = new THREE.MeshStandardMaterial({ color: INK,   roughness: 0.85, metalness: 0 });
const matNavy   = new THREE.MeshStandardMaterial({ color: NAVY,  roughness: 0.55, metalness: 0 });
// Enameled red lacquer — slight metalness gives the wet specular highlight a
// helmet needs to read as enamel rather than plastic. Roughness 0.35 per brief.
const matRed    = new THREE.MeshStandardMaterial({ color: RED,   roughness: 0.25, metalness: 0.20 });
const matGold   = new THREE.MeshStandardMaterial({ color: GOLD,  roughness: 0.38, metalness: 0.55 });
// Oiled walnut — high roughness, no metalness; brief specifies 0.92 / #a07a4e.
const matWood   = new THREE.MeshStandardMaterial({ color: WOOD,  roughness: 0.68, metalness: 0.05 });
// Skin — 2% subsurface fake via warm emissive rim (no SSS in r148 standard mat).
const matSkin   = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.55, metalness: 0 });
const matHair   = new THREE.MeshStandardMaterial({ color: HAIR,  roughness: 0.70, metalness: 0 });
const matAccent = new THREE.MeshStandardMaterial({ color: 0x4d6dd9, roughness: 0.6, metalness: 0.1 });

// Edge-line helper — gives the blueprint-CAD look
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
// GEOMETRY HELPERS — chamfered / rounded boxes
// Three r148 doesn't expose RoundedBoxGeometry as a global, so we build one
// from a rounded-rect Shape with a beveled extrude. Result: a box with
// smoothly chamfered edges on every visible corner.
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
  // Center along Z so geometry origin is the box centre
  geom.translate(0, 0, -((d - bevelT * 2) / 2 + bevelT));
  geom.computeVertexNormals();
  return geom;
}

// Soft block — bigger radius for super-ellipsoid-ish body shapes
function softBlockGeometry(w, h, d, r) {
  return roundedBoxGeometry(w, h, d, r, 4);
}

// ----------------------------------------------------------------
// FLOOR + BACKDROP
// ----------------------------------------------------------------
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: PAPER, roughness: 1, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

const backWall = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 14),
  new THREE.MeshStandardMaterial({ color: 0xdcd4c2, roughness: 1, metalness: 0 })
);
backWall.position.set(0, 6.5, -5);
backWall.receiveShadow = true;
scene.add(backWall);

// Subtle floor grid (blueprint feel)
const grid = new THREE.GridHelper(40, 40, 0xcfc8b8, 0xcfc8b8);
grid.position.y = 0.001;
grid.material.transparent = true;
grid.material.opacity = 0.25;
scene.add(grid);

// ----------------------------------------------------------------
// DESK — single-pedestal writing desk (walnut), thick top with chamfered
// edges, a solid modesty panel up front, side pedestal with a drawer
// stack on the character's right (viewer's left). Soft 6mm chamfer on
// every visible edge: NO sharp 90° corners anywhere on the furniture.
// ----------------------------------------------------------------
const desk = new THREE.Group();

// --- Desk TOP — 40mm thick slab, 6mm chamfer
// (Three's ExtrudeGeometry extrudes in the +Z dir, so the natural rounded
// rectangle lies in XY. We rotate to put thickness on Y and length on X/Z.)
const DESK_W = 2.6, DESK_T = 0.04, DESK_D = 1.2, DESK_Y = 0.78;
const deskTopGeo = roundedBoxGeometry(DESK_W, DESK_D, DESK_T, 0.012, 2);
const deskTop = new THREE.Mesh(deskTopGeo, matWood.clone());
// Lay flat — bring the depth onto Z and thickness onto Y
deskTop.rotation.x = -Math.PI / 2;
deskTop.position.y = DESK_Y;
deskTop.castShadow = true;
deskTop.receiveShadow = true;
desk.add(deskTop);

// --- Front MODESTY panel — single solid board hiding the kneehole from the
// front camera. Tucked just behind the desk's front edge so it reads as a
// proper writing desk, not a four-leg table.
const modesty = new THREE.Mesh(
  roundedBoxGeometry(2.20, 0.55, 0.025, 0.01, 2),
  matWood.clone()
);
// Front face of the top is at z = +DESK_D/2 = +0.60. Tuck modesty
// just inside that, at z ≈ +0.55, hanging down from the top.
modesty.position.set(0, DESK_Y - 0.30, 0.55);
modesty.castShadow = true;
modesty.receiveShadow = true;
desk.add(modesty);

// --- Right-side PEDESTAL (drawer stack). Sits on the character's right
// (negative-x side, viewer's left) so it doesn't fight the leaning arm.
// A single solid box reads as the pedestal cabinet; three thin recessed
// faces simulate the drawer fronts.
const PED_W = 0.42, PED_H = 0.72, PED_D = 1.05;
const PED_X = -1.06;   // outer-left edge of desk top
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

// Drawer fronts — three stacked panels recessed into the pedestal's front
// face (the +z side). Slightly darker tint via roughness bump, with subtle
// chamfers so the seams read.
for (let i = 0; i < 3; i++) {
  const drawer = new THREE.Mesh(
    roundedBoxGeometry(PED_W - 0.04, 0.20, 0.012, 0.008, 2),
    matWood.clone()
  );
  drawer.material.roughness = 0.95;
  drawer.position.set(
    PED_X,
    PED_H - 0.13 - i * 0.22,
    PED_Z + PED_D / 2 + 0.002
  );
  drawer.castShadow = true;
  drawer.receiveShadow = true;
  desk.add(drawer);

  // Drawer pull — small horizontal bar centered on each drawer
  const pull = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.10, 12),
    new THREE.MeshStandardMaterial({ color: 0x1c1815, roughness: 0.45, metalness: 0.65 })
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

// --- Slim RIGHT-side leg (no second pedestal — single-pedestal desk).
// One tapered panel-leg on the character's left (viewer's right) for support.
const sideLeg = new THREE.Mesh(
  roundedBoxGeometry(0.06, PED_H, PED_D * 0.85, 0.012, 2),
  matWood.clone()
);
sideLeg.position.set(1.20, PED_H / 2, PED_Z - 0.02);
sideLeg.castShadow = true;
sideLeg.receiveShadow = true;
desk.add(sideLeg);

// Cross-rail connecting the pedestal to the side leg at the back, so the
// desk reads as one piece of furniture not two floating columns.
const crossRail = new THREE.Mesh(
  roundedBoxGeometry(2.20, 0.05, 0.04, 0.012, 2),
  matWood.clone()
);
crossRail.position.set(0.08, 0.08, -0.50);
crossRail.castShadow = true;
desk.add(crossRail);

scene.add(desk);

// ----------------------------------------------------------------
// CHAIR — curved walnut backrest rising above the shoulders, with two
// dark steel posts framing the spine. Shape is a parametric curved plane
// (BufferGeometry built from a 2-axis grid bent on its z-axis) so the
// silhouette reads as a Hans-Wegner-style shell rather than a flat board.
// ----------------------------------------------------------------
function buildCurvedBackrest(w, h, depth, curvature, segW = 24, segH = 16) {
  // A plane bent into a shallow arc that hugs the back. Z = curvature * (x/halfW)^2
  // so the panel is concave when viewed from the front.
  const geo = new THREE.PlaneGeometry(w, h, segW, segH);
  const pos = geo.attributes.position;
  const halfW = w / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const t = x / halfW;
    pos.setZ(i, curvature * (t * t));
  }
  // Give the shell real thickness so it casts a shadow and reads as a panel
  // rather than a sheet of paper. We achieve this with a second offset face
  // built by extruding via ExtrudeGeometry of a shape... easier: just scale
  // a second copy slightly forward and rely on solid silhouette.
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

const chairBack = new THREE.Mesh(
  buildCurvedBackrest(0.86, 0.78, 0.10, 0.10, 28, 18),
  matWood.clone()   // walnut, same as the desk family
);
chairBack.material.side = THREE.DoubleSide;
chairBack.material.roughness = 0.85;
// Rises above the shoulders (shoulder y ≈ 1.6 in world; we sit chair top
// near y = 1.9 — center y = 1.5, half-height = 0.39, top ≈ 1.89).
chairBack.position.set(0, 1.50, -0.98);
// Slight backward recline so the top edge leans away from the spine
chairBack.rotation.x = -0.08;
chairBack.castShadow = true;
chairBack.receiveShadow = true;
scene.add(chairBack);

// Backing skin — a second, slightly larger panel behind the first gives the
// shell the appearance of two-ply construction without ExtrudeGeometry cost.
const chairBackOuter = new THREE.Mesh(
  buildCurvedBackrest(0.90, 0.82, 0.10, 0.10, 24, 14),
  matWood.clone()
);
chairBackOuter.material.side = THREE.DoubleSide;
chairBackOuter.material.roughness = 0.92;
chairBackOuter.material.color = new THREE.Color(0x8a663f);   // slightly darker walnut
chairBackOuter.position.set(0, 1.50, -1.005);
chairBackOuter.rotation.x = -0.08;
chairBackOuter.castShadow = true;
chairBackOuter.receiveShadow = true;
scene.add(chairBackOuter);

// Dark steel posts running from the seat up behind the shell
const postMat = new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.4, metalness: 0.6 });
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

// A slim cushion / seat hint — just enough that the chair reads as more than
// a floating backrest. Sits below the desk top so it doesn't poke through.
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
// FACE TEXTURE — procedurally drawn engineer face on a canvas
// ----------------------------------------------------------------
function buildFaceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // 1. Skin base — warm undertone
  ctx.fillStyle = '#e8c4a0';
  ctx.fillRect(0, 0, 512, 512);

  // 2. Cheek blush at 35% and 65% width
  const cheekY = 512 * 0.58;
  for (const cxPct of [0.35, 0.65]) {
    const g = ctx.createRadialGradient(512 * cxPct, cheekY, 0, 512 * cxPct, cheekY, 90);
    g.addColorStop(0, 'rgba(220,140,110,0.18)');
    g.addColorStop(1, 'rgba(220,140,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  }

  // Eye geometry
  const eyeW = 512 * 0.14, eyeH = eyeW * 0.42, eyeGap = 512 * 0.18;
  const eyeCY = 512 * 0.46;
  const leftCX = 256 - eyeGap / 2 - eyeW / 2;
  const rightCX = 256 + eyeGap / 2 + eyeW / 2;
  const tilt = 6 * Math.PI / 180;

  function drawEye(cx, cy, side) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(side * -tilt);
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f6efe4'; ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    const irisR = eyeH * 0.65;
    ctx.beginPath(); ctx.arc(0, 0, irisR, 0, Math.PI * 2);
    ctx.fillStyle = '#3a2418'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, irisR * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0604'; ctx.fill();
    ctx.beginPath(); ctx.arc(-irisR * 0.25, -irisR * 0.25, irisR * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeW / 2, eyeH / 2, 0, Math.PI, Math.PI * 2);
    ctx.strokeStyle = '#1a0f08'; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeW / 2, eyeH / 2, 0, 0, Math.PI);
    ctx.strokeStyle = 'rgba(26,15,8,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
  drawEye(leftCX, eyeCY, -1);
  drawEye(rightCX, eyeCY, +1);

  // Brows
  const browY = eyeCY - 512 * 0.08;
  const browW = eyeW * 1.15;
  function drawBrow(cx, cy, side) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(side * -tilt);
    ctx.strokeStyle = '#1a0f08';
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    const halfW = browW / 2;
    ctx.moveTo(-halfW, 2);
    ctx.quadraticCurveTo(0, -4, halfW, 0);
    ctx.stroke();
    ctx.restore();
  }
  drawBrow(leftCX, browY, -1);
  drawBrow(rightCX, browY, +1);

  // Mouth — open broad smile with upper teeth
  const mouthCX = 256, mouthCY = 512 * 0.74;
  const mouthW = 512 * 0.22, mouthH = mouthW * 0.32;
  ctx.beginPath();
  ctx.moveTo(mouthCX - mouthW / 2, mouthCY);
  ctx.quadraticCurveTo(mouthCX, mouthCY + mouthH * 0.25, mouthCX + mouthW / 2, mouthCY);
  ctx.strokeStyle = '#3b2014'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(mouthCX - mouthW / 2, mouthCY);
  ctx.quadraticCurveTo(mouthCX, mouthCY + mouthH * 0.25, mouthCX + mouthW / 2, mouthCY);
  ctx.quadraticCurveTo(mouthCX, mouthCY + mouthH * 1.15, mouthCX - mouthW / 2, mouthCY);
  ctx.closePath();
  ctx.fillStyle = '#2a1410'; ctx.fill();
  ctx.clip();
  const teethCount = 6;
  const teethRowW = mouthW * 0.86;
  const toothW = teethRowW / teethCount;
  const toothH = mouthH * 0.55;
  const teethStartX = mouthCX - teethRowW / 2;
  ctx.fillStyle = '#f4ece0';
  for (let i = 0; i < teethCount; i++) {
    const tx = teethStartX + i * toothW;
    const gap = 1.2;
    const x = tx + gap / 2, y = mouthCY + 1, w = toothW - gap, h = toothH, r = w * 0.18;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // Lip corner accents
  ctx.fillStyle = '#3b2014';
  ctx.beginPath();
  ctx.arc(mouthCX - mouthW / 2, mouthCY - 1, 1.8, 0, Math.PI * 2);
  ctx.arc(mouthCX + mouthW / 2, mouthCY - 1, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Nose hint
  ctx.strokeStyle = 'rgba(180,120,90,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(256 - 6, 512 * 0.55);
  ctx.quadraticCurveTo(256 - 9, 512 * 0.63, 256, 512 * 0.66);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
const faceTex = buildFaceTexture();

// ----------------------------------------------------------------
// CHARACTER — hierarchical, with arm rig
// Proportions per brief:
//  - Head scaled to ~0.85 of previous (was 0.30 radius reading too big)
//  - Torso is a soft super-ellipsoid (scaled rounded box, edge r~0.08)
//  - Short tapered neck cylinder bridging head and torso (no gap)
//  - Shoulder spheres r=0.11; arms taper r=0.11 → r=0.075 at the wrist
//  - Mitten hands (flattened sphere + palm slab); thumb stub
// ----------------------------------------------------------------
const character = new THREE.Group();
character.position.set(0, -0.30, -0.85);   // sitting behind desk
scene.add(character);

// CONTACT SHADOW — soft dark disc beneath the seated figure so he doesn't
// float above the chair. Flat decal plane, no geometry change.
const contactShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.55, 32),
  new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  })
);
contactShadow.rotation.x = -Math.PI / 2;
contactShadow.position.set(0, 0.02, -0.85);
contactShadow.scale.set(1.15, 1.15, 1);
contactShadow.renderOrder = -1;
scene.add(contactShadow);

// SUIT & BODY — sharp navy blazer, broader shoulders, lapels, V-collar, tie.
// Replaces the casual t-shirt feel with a young-professional silhouette.
const matBlazer = new THREE.MeshStandardMaterial({
  color: 0x1a2540, roughness: 0.60, metalness: 0.04
});
const matShirt  = new THREE.MeshStandardMaterial({
  color: 0xf8f5ee, roughness: 0.72, metalness: 0
});
const matTie    = new THREE.MeshStandardMaterial({
  color: 0x6b2838, roughness: 0.42, metalness: 0.05
});
const matTiePat = new THREE.MeshStandardMaterial({
  color: 0x3a1820, roughness: 0.45, metalness: 0.05,
  transparent: true, opacity: 0.5
});

const SHOULDER_R = 0.16;
const SHOULDER_X = 0.41;
const SHOULDER_Y = 1.60;

// Torso — blazer body, soft chamfer
const torsoGeo = roundedBoxGeometry(0.77, 0.88, 0.39, 0.07, 4);
const torso = new THREE.Mesh(torsoGeo, matBlazer.clone());
torso.position.y = 1.22;
torso.castShadow = true;
torso.receiveShadow = true;
character.add(torso);

// Waist hem (narrower than torso) — fakes the suit taper
const hemGeo = roundedBoxGeometry(0.77, 0.10, 0.39, 0.05, 3);
const hem = new THREE.Mesh(hemGeo, matBlazer.clone());
hem.position.y = 0.78;
hem.scale.set(0.92, 1.0, 0.98);
hem.castShadow = true;
character.add(hem);

// Shoulders — wider, padded
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

// Lapels — two slabs angled outward at the chest
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

// Shirt V — off-white plane between the lapels
const shirtV = new THREE.Mesh(
  new THREE.PlaneGeometry(0.19, 0.28),
  matShirt.clone()
);
shirtV.position.set(0, 1.48, LAPEL_Z - 0.002);
character.add(shirtV);

// Tie — burgundy slab, slight tilt
const tieGeo = roundedBoxGeometry(0.077, 0.30, 0.022, 0.008, 2);
const tie = new THREE.Mesh(tieGeo, matTie.clone());
tie.position.set(0, 1.40, LAPEL_Z + 0.005);
tie.rotation.set(0, 0, THREE.MathUtils.degToRad(4));
tie.castShadow = true;
character.add(tie);

// Tie pattern overlay
const tiePattern = new THREE.Mesh(
  new THREE.PlaneGeometry(0.060, 0.26),
  matTiePat
);
tiePattern.position.set(0, 1.40, LAPEL_Z + 0.018);
tiePattern.rotation.set(0, 0, THREE.MathUtils.degToRad(4));
character.add(tiePattern);

// Tie knot — at top of tie, hides shirt/tie seam
const tieKnot = new THREE.Mesh(
  roundedBoxGeometry(0.085, 0.07, 0.035, 0.012, 2),
  matTie.clone()
);
tieKnot.position.set(0, 1.58, LAPEL_Z + 0.010);
tieKnot.castShadow = true;
character.add(tieKnot);

// Neck base (skin tone) — tucked behind the tie knot
const neckBase = new THREE.Mesh(
  new THREE.SphereGeometry(0.105, 20, 14),
  matSkin.clone()
);
neckBase.position.set(0, 1.66, 0.02);
neckBase.scale.set(1.0, 0.55, 0.95);
neckBase.castShadow = true;
character.add(neckBase);

const neck = new THREE.Mesh(
  new THREE.CylinderGeometry(0.075, 0.095, 0.13, 18),
  matSkin.clone()
);
neck.position.y = 1.74;
neck.castShadow = true;
character.add(neck);

// HEAD — sphere; the entire head is scaled to 0.85 of its previous read.
// (Previous radius=0.30 + scale (1.0, 1.05, 0.95).  New: same source sphere
// but a tighter master scale, slightly egg-shaped.)
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.30, 32, 24),
  matSkin.clone()
);
const HEAD_SCALE = 0.85;
head.scale.set(1.0 * HEAD_SCALE, 1.05 * HEAD_SCALE, 0.95 * HEAD_SCALE);
// Lower the head so the chin sits just above the neck top (no floating gap).
// Neck top ≈ y = 1.805. Head sphere visual base ≈ y - 0.30*HEAD_SCALE.
// Center head at y = 1.92 → base at ~1.665 (overlap with neck top, no gap).
head.position.y = 1.95;
head.castShadow = true;
character.add(head);

// FACIAL FEATURES — actual 3D geometry on the head sphere, not a decal.
// Head sphere is at (0, 1.95, 0) with scale (0.85, 0.8925, 0.8075) and r=0.30.
// Front face of head sphere is at z ≈ 0.30 * 0.8075 ≈ 0.242. We anchor features
// to that surface and offset slightly outward.
const faceGroup = new THREE.Group();
faceGroup.position.set(0, 1.95, 0);
character.add(faceGroup);

const FACE_Z = 0.235;          // just inside the head sphere front

// Skin tone — matches matSkin
const matFaceFeature = matSkin.clone();

// Materials for the features
const matEyeWhite = new THREE.MeshStandardMaterial({ color: 0xfaf3e6, roughness: 0.55, metalness: 0 });
const matEyePupil = new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.40, metalness: 0 });
const matBrow     = new THREE.MeshStandardMaterial({ color: 0x140d08, roughness: 0.78, metalness: 0 });
const matLip      = new THREE.MeshStandardMaterial({ color: 0x7a2418, roughness: 0.55, metalness: 0 });
const matMouth    = new THREE.MeshStandardMaterial({ color: 0x2a1410, roughness: 0.7, metalness: 0 });
const matTooth    = new THREE.MeshStandardMaterial({ color: 0xf4ece0, roughness: 0.4, metalness: 0 });

// NOSE — small cone protruding forward from the centre of the face.
const nose = new THREE.Mesh(
  new THREE.ConeGeometry(0.032, 0.07, 8),
  matFaceFeature
);
nose.rotation.x = Math.PI / 2;        // point forward
nose.position.set(0, -0.005, FACE_Z + 0.03);
faceGroup.add(nose);
// nose bridge above
const noseBridge = new THREE.Mesh(
  new THREE.BoxGeometry(0.022, 0.06, 0.025),
  matFaceFeature
);
noseBridge.position.set(0, 0.04, FACE_Z + 0.012);
faceGroup.add(noseBridge);

// EYES — small white spheres with smaller dark pupils. Monolid-leaning by
// flattening Y axis slightly and tilting outer corner up (~6°).
const eyeSpacing = 0.062;
const eyeY = 0.062;
function makeEye(side) {
  const grp = new THREE.Group();
  grp.position.set(side * eyeSpacing, eyeY, FACE_Z + 0.005);
  grp.rotation.z = side * -THREE.MathUtils.degToRad(6);   // outer-up tilt
  // Eye socket (slight skin recess so eyes don't pop out flat)
  const white = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 16, 12),
    matEyeWhite
  );
  white.scale.set(1.0, 0.55, 0.7);   // monolid almond shape
  grp.add(white);
  // Iris+pupil — single small dark sphere in front
  const pupil = new THREE.Mesh(
    new THREE.SphereGeometry(0.008, 12, 10),
    matEyePupil
  );
  pupil.position.set(0, 0, 0.012);
  grp.add(pupil);
  // Catchlight — tiny white sphere
  const cl = new THREE.Mesh(
    new THREE.SphereGeometry(0.0022, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  cl.position.set(0.0025, 0.001, 0.018);
  grp.add(cl);
  return grp;
}
faceGroup.add(makeEye(-1));
faceGroup.add(makeEye( 1));

// EYEBROWS — thick black bars angled slightly downward toward the bridge
const browBar = new THREE.BoxGeometry(0.052, 0.0085, 0.012);
const browL2 = new THREE.Mesh(browBar, matBrow);
browL2.position.set(-eyeSpacing, eyeY + 0.034, FACE_Z + 0.010);
browL2.rotation.z = THREE.MathUtils.degToRad(6);
faceGroup.add(browL2);
const browR2 = new THREE.Mesh(browBar, matBrow);
browR2.position.set( eyeSpacing, eyeY + 0.034, FACE_Z + 0.010);
browR2.rotation.z = THREE.MathUtils.degToRad(-6);
faceGroup.add(browR2);

// MOUTH — half-torus for the broad smile + dark mouth interior + teeth strip.
const smile = new THREE.Mesh(
  new THREE.TorusGeometry(0.038, 0.0055, 8, 18, Math.PI),
  matLip
);
smile.rotation.x = Math.PI;            // bottom half of the torus = smile
smile.position.set(0, -0.075, FACE_Z + 0.012);
faceGroup.add(smile);
// Teeth strip — thin white slab inside the smile curve
const teeth = new THREE.Mesh(
  new THREE.BoxGeometry(0.058, 0.012, 0.012),
  matTooth
);
teeth.position.set(0, -0.070, FACE_Z + 0.013);
faceGroup.add(teeth);
// Mouth shadow (dark behind teeth, helps it read as open)
const mouthShadow = new THREE.Mesh(
  new THREE.BoxGeometry(0.060, 0.016, 0.008),
  matMouth
);
mouthShadow.position.set(0, -0.071, FACE_Z + 0.008);
faceGroup.add(mouthShadow);

// EARS — small slabs on either side of the head, partial visibility under hair
const earGeo = new THREE.SphereGeometry(0.030, 12, 10);
const earL = new THREE.Mesh(earGeo, matFaceFeature);
earL.scale.set(0.45, 1.0, 0.55);
earL.position.set(-0.218, -0.010, 0.0);
faceGroup.add(earL);
const earR = new THREE.Mesh(earGeo, matFaceFeature);
earR.scale.set(0.45, 1.0, 0.55);
earR.position.set( 0.218, -0.010, 0.0);
faceGroup.add(earR);

// HAIR — tousled swept-back: 3 stacked flattened spheres + cone tufts.
const hairBaseScale = 0.30;
const hairGroup = new THREE.Group();
hairGroup.position.set(0, 1.95, 0);
character.add(hairGroup);

const hairLayers = [
  // r = sphere radius (scaled by hairBaseScale=0.30 to world units)
  // y = vertical offset above head center; raised so hair sits ABOVE the face
  // flat = vertical squash; depth = forward/back squash so hair doesn't cover the face plane at z=0.30
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

const tuftMat = new THREE.MeshStandardMaterial({
  color: 0x0e0805, roughness: 0.85, metalness: 0.0
});
const tuftCount = 5;
const tuftBaseY = 0.72 * hairBaseScale + 0.10 * hairBaseScale;
for (let i = 0; i < tuftCount; i++) {
  const tuftR = (0.05 + Math.random() * 0.03) * hairBaseScale;
  const tuftH = (0.18 + Math.random() * 0.10) * hairBaseScale;
  const tuft = new THREE.Mesh(
    new THREE.ConeGeometry(tuftR, tuftH, 8),
    tuftMat
  );
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

// SHOULDERS / ARMS — pivot groups so we can rotate at shoulder + elbow.
// Per brief: arms taper from r=0.11 at the shoulder to r=0.075 at the wrist.
// The shoulder sphere lives at SHOULDER_X / SHOULDER_Y; arm pivot matches.
function makeArm(side) {
  const s = side === "L" ? 1 : -1;   // sign for x
  const group = new THREE.Group();   // shoulder pivot
  group.position.set(s * SHOULDER_X, SHOULDER_Y, 0);

  // Upper arm — tapered cylinder, fatter at the deltoid, narrower at the elbow
  const upperArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.105, 0.40, 18, 1, false),
    matNavy.clone()
  );
  // origin at shoulder (top of cylinder pivots from y=0, body hangs below)
  upperArm.geometry.translate(0, -0.20, 0);
  upperArm.castShadow = true;
  group.add(upperArm);

  // Elbow joint sphere — small sphere where the upper-arm meets the forearm
  // so the bend at the elbow doesn't show a pinched seam when the arm rotates.
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

  // Forearm — continues the taper from elbow (0.085) down to wrist (0.075)
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

  // Wrist cuff — thin sleeve-end disc so the hand reads as emerging from a
  // shirt cuff, not a bare stump.
  const cuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.072, 0.025, 18),
    matNavy.clone()
  );
  cuff.position.y = -0.005;
  cuff.castShadow = true;
  wrist.add(cuff);

  // HAND — mitten: flattened sphere (knuckle ball) plus a small palm slab.
  // Together they read as a closed hand at idle; from a distance the
  // silhouette is unmistakably "hand", not "stump".
  const hand = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 20, 16),
    matSkin.clone()
  );
  hand.scale.set(1.15, 0.55, 1.30);   // flat top-to-bottom, longer fore-back
  hand.position.y = -0.06;
  hand.castShadow = true;
  wrist.add(hand);

  // Palm slab — a slim rounded box ahead of the knuckle ball, oriented along
  // the forearm axis. Gives the mitten a definite "front face".
  const palm = new THREE.Mesh(
    roundedBoxGeometry(0.13, 0.045, 0.10, 0.025, 3),
    matSkin.clone()
  );
  palm.position.set(0, -0.075, 0.045);
  palm.castShadow = true;
  wrist.add(palm);

  // Thumb stub on the inside edge (toward the body)
  const thumb = new THREE.Mesh(
    new THREE.SphereGeometry(0.034, 14, 10),
    matSkin.clone()
  );
  thumb.scale.set(1.0, 0.9, 1.3);
  thumb.position.set(-s * 0.072, -0.055, 0.05);
  thumb.castShadow = true;
  wrist.add(thumb);

  // Slot for holding a prop — anything we attach here follows the hand
  const propSlot = new THREE.Group();
  propSlot.position.set(0, -0.06, 0.02);
  wrist.add(propSlot);

  group.userData = { shoulder: group, elbow, wrist, hand, propSlot, side };
  return group;
}
const armL = makeArm("L");   // character's right arm (works to viewer's right)
const armR = makeArm("R");   // character's left arm (works to viewer's left)
character.add(armL);
character.add(armR);

// IDLE pose — arms resting on the desk
function setIdle() {
  // Arms forward, forearms lying along the desk, hands resting near the surface.
  armL.rotation.set(-1.40, 0, -0.18);
  armL.userData.elbow.rotation.set(0.55, 0, 0);
  armL.userData.wrist.rotation.set(0.35, 0, 0);

  armR.rotation.set(-1.40, 0, 0.18);
  armR.userData.elbow.rotation.set(0.55, 0, 0);
  armR.userData.wrist.rotation.set(0.35, 0, 0);
}
setIdle();


// ----------------------------------------------------------------
// PROPS on the desk
// Each prop: a mesh (or group) tagged with userData = { id, restPos, restRot }
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

// Desk top surface sits at y = DESK_Y + DESK_T/2 = 0.78 + 0.02 = 0.80.
// Every prop's resting position is anchored to that surface.
const DESK_SURFACE_Y = 0.80;

// 1. PORTFOLIO — slim leather book angled 12° off the desk edge, slightly
// lifted on a barely-visible debossed leather cover so the cover edges are
// rounded rather than razor-flat. Sits forward-right of the character.
const portfolio = new THREE.Group();
const cover = new THREE.Mesh(
  roundedBoxGeometry(0.45, 0.045, 0.32, 0.018, 2),
  new THREE.MeshStandardMaterial({ color: 0x2a2520, roughness: 0.55, metalness: 0.1 })
);
const pages = new THREE.Mesh(
  roundedBoxGeometry(0.42, 0.022, 0.30, 0.008, 2),
  new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.95 })
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
portfolio.rotation.y = -0.21;   // ≈ 12° off the desk edge (per brief)
props.add(tagProp(portfolio, "portfolio"));

// 2. IRON MAN HELMET — Mark III silhouette built from faceted geometry.
// NOT a red sphere with stripes. Hard ridges. Hexagonal gold faceplate.
// V-shaped brow ridge. Angled angry-eye slits. Mouth grille across chin.
const helmet = new THREE.Group();

const helmetRed  = new THREE.MeshStandardMaterial({ color: 0x8b0a0a, metalness: 0.90, roughness: 0.25 });
const helmetGold = new THREE.MeshStandardMaterial({ color: 0xcaa14a, metalness: 0.95, roughness: 0.20 });
const slitGlowMat = new THREE.MeshStandardMaterial({
  color: 0xc4f0ff, emissive: 0x7fdfff, emissiveIntensity: 2.5, metalness: 0, roughness: 0.4
});

const S = 0.13;   // helmet size unit

// Cranium — slightly egg-shaped red sphere (back of head + sides)
const cranium = new THREE.Mesh(
  new THREE.SphereGeometry(S * 1.0, 28, 24),
  helmetRed
);
cranium.scale.set(1.0, 1.05, 1.15);
cranium.castShadow = true;
cranium.receiveShadow = true;
helmet.add(cranium);

// FACEPLATE — hexagonal gold mask via 2D Shape extrusion.
// Brow at top forms a SHALLOW V (apex 18° down at center).
// Cheekbones angle outward at ~30°. Chin narrows to a point.
const fpShape = new THREE.Shape();
fpShape.moveTo(-0.62,  0.20);                 // upper-left brow start
fpShape.lineTo(-0.10,  0.32);                 // V brow rises toward center
fpShape.lineTo( 0.00,  0.20);                 // V apex (the iconic dip)
fpShape.lineTo( 0.10,  0.32);                 // V brow other side
fpShape.lineTo( 0.62,  0.20);                 // upper-right
fpShape.lineTo( 0.58, -0.05);                 // cheek down
fpShape.lineTo( 0.40, -0.45);                 // cheekbone angle outward then in
fpShape.lineTo( 0.12, -0.80);                 // narrowing to chin
fpShape.lineTo( 0.00, -0.92);                 // chin point
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
// Center the extrusion so its FRONT face sits OUTSIDE the cranium.
// Cranium front at z = S * 1.15 ≈ 0.15. We want faceplate front at z ≈ 0.17.
// Extrude depth = 0.20 * S = 0.026 (z-thickness). So translate to z = 0.144 so back face is at 0.144 and front at 0.170.
fpGeo.translate(0, 0, S * 1.10);
const faceplate = new THREE.Mesh(fpGeo, helmetGold);
faceplate.castShadow = true;
faceplate.receiveShadow = true;
helmet.add(faceplate);

// BROW RIDGE — two thin boxes forming the V, set just above the faceplate top edge.
// This is the single most recognizable Iron Man cue.
const browGeo = new THREE.BoxGeometry(0.36 * S, 0.020 * S, 0.060 * S);
const browL = new THREE.Mesh(browGeo, helmetGold);
browL.position.set(-0.32 * S, 0.26 * S, S * 1.32);
browL.rotation.z = THREE.MathUtils.degToRad(-12);
helmet.add(browL);
const browR = new THREE.Mesh(browGeo, helmetGold);
browR.position.set( 0.32 * S, 0.26 * S, S * 1.32);
browR.rotation.z = THREE.MathUtils.degToRad(12);
helmet.add(browR);

// EYE SLITS — emissive cyan, angled inward-downward at 15° (angry slant).
const slitGeo = new THREE.PlaneGeometry(0.34 * S, 0.085 * S);
const slitL = new THREE.Mesh(slitGeo, slitGlowMat);
slitL.position.set(-0.27 * S, 0.10 * S, S * 1.34);
slitL.rotation.z = THREE.MathUtils.degToRad(15);
helmet.add(slitL);
const slitR = new THREE.Mesh(slitGeo, slitGlowMat);
slitR.position.set( 0.27 * S, 0.10 * S, S * 1.34);
slitR.rotation.z = THREE.MathUtils.degToRad(-15);
helmet.add(slitR);

// Cyan point light from inside the helmet to enhance the slit glow.
const slitLight = new THREE.PointLight(0x7fdfff, 0.45, 0.5, 2);
slitLight.position.set(0, 0.10 * S, S * 1.10);
helmet.add(slitLight);

// MOUTH GRILLE — gold strip across the chin with 5 vertical slat dividers.
const grilleBase = new THREE.Mesh(
  new THREE.BoxGeometry(0.42 * S, 0.10 * S, 0.04 * S),
  helmetGold
);
grilleBase.position.set(0, -0.62 * S, S * 1.32);
helmet.add(grilleBase);
const darkSlat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.8 });
for (let i = 0; i < 5; i++) {
  const slat = new THREE.Mesh(
    new THREE.BoxGeometry(0.018 * S, 0.085 * S, 0.06 * S),
    darkSlat
  );
  slat.position.set((i - 2) * (0.075 * S), -0.62 * S, S * 1.36);
  helmet.add(slat);
}

// SIDE TEMPLE PANELS — small red wedges between the gold faceplate edge and the cranium
const tplGeo = new THREE.BoxGeometry(0.10 * S, 0.45 * S, 0.18 * S);
const templeL = new THREE.Mesh(tplGeo, helmetRed);
templeL.position.set(-0.78 * S, 0.0 * S, S * 0.60);
templeL.rotation.y = THREE.MathUtils.degToRad(-22);
helmet.add(templeL);
const templeR = new THREE.Mesh(tplGeo, helmetRed);
templeR.position.set( 0.78 * S, 0.0 * S, S * 0.60);
templeR.rotation.y = THREE.MathUtils.degToRad(22);
helmet.add(templeR);

// JAW HINGE — small dark slit between cheek and chin showing the actuator break
const hingeGeo = new THREE.BoxGeometry(0.012 * S, 0.30 * S, 0.04 * S);
const hingeMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.7 });
const hingeL = new THREE.Mesh(hingeGeo, hingeMat);
hingeL.position.set(-0.55 * S, -0.30 * S, S * 1.20);
hingeL.rotation.z = THREE.MathUtils.degToRad(-10);
helmet.add(hingeL);
const hingeR = new THREE.Mesh(hingeGeo, hingeMat);
hingeR.position.set( 0.55 * S, -0.30 * S, S * 1.20);
hingeR.rotation.z = THREE.MathUtils.degToRad(10);
helmet.add(hingeR);

helmet.position.set(-0.72, DESK_SURFACE_Y + 0.05, -0.05);
helmet.rotation.y = 0.0;     // facing camera so the gold faceplate reads
props.add(tagProp(helmet, "helmet"));

// 3. CAD MODEL — torus-knot on a small base, slight angle
const cad = new THREE.Group();
const cadKnot = new THREE.Mesh(
  new THREE.TorusKnotGeometry(0.08, 0.025, 80, 14),
  new THREE.MeshStandardMaterial({ color: 0x4d6dd9, roughness: 0.35, metalness: 0.6 })
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

// 4. RECOMMENDATION LETTER — paper sheet, corner peeking under the portfolio
const letter = new THREE.Group();
const sheet = new THREE.Mesh(
  new THREE.BoxGeometry(0.28, 0.005, 0.22),
  new THREE.MeshStandardMaterial({ color: 0xfdfbf6, roughness: 1 })
);
sheet.position.y = 0.0025;
letter.add(addEdges(sheet, 0xb5ad99, 0.6));
for (let i = 0; i < 6; i++) {
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.0008, 0.005),
    new THREE.MeshStandardMaterial({ color: 0x6b6256 })
  );
  line.position.set(-0.02, 0.006, -0.07 + i * 0.025);
  letter.add(line);
}
letter.position.set(0.34, DESK_SURFACE_Y + 0.003, 0.34);
letter.rotation.y = 0.42;
props.add(tagProp(letter, "letter"));

// 5. COFFEE MUG — on a coaster
const mug = new THREE.Group();
const mugBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.06, 0.05, 0.13, 24),
  new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.9 })
);
mugBody.position.y = 0.065;
mug.add(addEdges(mugBody, INK, 0.4));
const coffee = new THREE.Mesh(
  new THREE.CircleGeometry(0.05, 24),
  new THREE.MeshStandardMaterial({ color: 0x3a261a, roughness: 0.4 })
);
coffee.rotation.x = -Math.PI / 2;
coffee.position.y = 0.128;
mug.add(coffee);
const mugRim = new THREE.Mesh(
  new THREE.TorusGeometry(0.06, 0.005, 8, 24),
  new THREE.MeshStandardMaterial({ color: 0xebe6dc, roughness: 0.8 })
);
mugRim.rotation.x = Math.PI / 2;
mugRim.position.y = 0.13;
mug.add(mugRim);
const handle = new THREE.Mesh(
  new THREE.TorusGeometry(0.035, 0.012, 8, 18, Math.PI),
  new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.9 })
);
handle.position.set(0.06, 0.06, 0);
handle.rotation.y = Math.PI / 2;
mug.add(handle);

const mugCoaster = new THREE.Mesh(
  new THREE.CylinderGeometry(0.085, 0.085, 0.008, 24),
  new THREE.MeshStandardMaterial({ color: 0x2a2520, roughness: 0.95 })
);
mugCoaster.position.set(1.00, DESK_SURFACE_Y + 0.004, -0.10);
mugCoaster.receiveShadow = true;
props.add(mugCoaster);

mug.position.set(1.00, DESK_SURFACE_Y + 0.008, -0.10);
mug.rotation.y = -0.22;
props.add(tagProp(mug, "mug"));

// Build the propMap for click routing & external pickup helpers
const propsList = ["portfolio", "helmet", "cad", "letter", "mug"];
const propMap = {};
props.children.forEach((g) => { if (g.userData && g.userData.id) propMap[g.userData.id] = g; });

// ----------------------------------------------------------------
// RAYCASTER + INTERACTION
// ----------------------------------------------------------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null;
let state = "idle";          // idle | picking | pov | returning
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
// CAMERA TWEEN — staggered: focus leads, position next, FOV trails
// ----------------------------------------------------------------
const gsap = window.gsap;
function tweenCamera(targetPos, targetLook, fov = 38, dur = 1.45) {
  // focus leads at t=0 — power3.out, slightly shorter
  gsap.to(camFocus, {
    x: targetLook.x, y: targetLook.y, z: targetLook.z,
    duration: dur * 0.95, ease: "power3.out"
  });
  // camera position starts at +0.10s — expo.inOut, full dur
  gsap.to(camera.position, {
    x: targetPos.x, y: targetPos.y, z: targetPos.z,
    duration: dur, delay: 0.10, ease: "expo.inOut"
  });
  // FOV trails at +0.15s — power2.inOut, slightly longer so the lens settles last
  const live = { fov: camera.fov };
  gsap.to(live, {
    fov, duration: dur * 1.05, delay: 0.15, ease: "power2.inOut",
    onUpdate: () => { camera.fov = live.fov; camera.updateProjectionMatrix(); }
  });
  return dur + 0.15;
}

function chooseArm(prop) {
  // armL pivot is at +x (right side from viewer); armR at -x
  return prop.position.x >= 0 ? armL : armR;
}

// ----------------------------------------------------------------
// 4-BEAT PICKUP — settle, anticipate, reach (elbow leads, wrist trails), lift
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

  const arm = chooseArm(prop);
  const isLeft = (arm === armL);          // armL = right side from viewer
  const dir = isLeft ? 1 : -1;            // +1 reaches to +x, -1 to -x
  const otherArm = isLeft ? armR : armL;
  const slot = arm.userData.propSlot;

  const tl = gsap.timeline();

  // BEAT 1 — SETTLE (180ms, power2.out): head + shoulders settle toward prop
  tl.to(character.rotation, { y: dir * 0.14, duration: 0.18, ease: "power2.out" }, 0);
  tl.to(head.rotation, {
    y: dir * 0.38, x: 0.22, duration: 0.18, ease: "power2.out"
  }, 0);
  tl.to(torso.rotation, { z: dir * 0.05, duration: 0.18, ease: "power2.out" }, 0);

  // BEAT 2 — ANTICIPATE (120ms, power2.in): arm pulls 15° BACK from rest
  // Rest pose: arm.rotation.x ≈ -1.40. Pull BACK = less negative = -1.40 + 0.26 = -1.14
  tl.to(arm.rotation, { x: -1.14, duration: 0.12, ease: "power2.in" }, 0.18);
  tl.to(arm.userData.elbow.rotation, { x: 0.30, duration: 0.12, ease: "power2.in" }, 0.18);
  tl.to(otherArm.rotation, { z: dir * 0.04, duration: 0.12, ease: "power2.in" }, 0.18);

  // BEAT 3 — REACH (380ms, power2.out): elbow leads, wrist trails 60ms
  tl.to(arm.rotation, {
    x: -2.10, y: dir * 0.25, z: dir * 0.15,
    duration: 0.38, ease: "power2.out"
  }, 0.30);
  // Elbow leads — starts at 0.30, ends 0.30+0.34 = 0.64 (40ms before arm)
  tl.to(arm.userData.elbow.rotation, {
    x: 0.45, duration: 0.34, ease: "power2.out"
  }, 0.30);
  // Wrist trails — starts at 0.36 (60ms later), ends 0.66
  tl.to(arm.userData.wrist.rotation, {
    x: -0.20, duration: 0.30, ease: "power2.out"
  }, 0.36);

  // GRAB at t=0.68 — attach prop to slot (re-parent keeping world transform)
  tl.add(() => {
    prop.userData.worldRest = prop.matrixWorld.clone();
    THREE.Object3D.prototype.attach.call(slot, prop);
    gsap.to(prop.position, { x: 0, y: 0, z: 0, duration: 0.20, ease: "power2.out" });
    gsap.to(prop.rotation, { x: 0, y: 0, z: 0, duration: 0.20, ease: "power2.out" });
  }, 0.68);

  // BEAT 4 — LIFT (280ms, power2.inOut): prop rises, opposite shoulder counter-rotates
  tl.to(arm.rotation, {
    x: -2.50, duration: 0.28, ease: "power2.inOut"
  }, 0.72);
  tl.to(arm.userData.elbow.rotation, {
    x: 1.10, duration: 0.28, ease: "power2.inOut"
  }, 0.72);
  // Opposite shoulder counter-rotation for balance
  tl.to(otherArm.rotation, {
    z: -dir * 0.10, duration: 0.28, ease: "power2.inOut"
  }, 0.72);
  // Head tilts down to look at prop in hand
  tl.to(head.rotation, {
    x: 0.38, duration: 0.28, ease: "power2.inOut"
  }, 0.72);

  // 40ms HOLD at apex (t = 1.00 → 1.04) — implicit gap before camera takes over

  // CAMERA DOLLY — fires at t=1.04, total ~1.45s
  const cam = CAM_B[prop.userData.id];
  const camDur = 1.45;
  tl.add(() => { tweenCamera(cam.pos, cam.look, cam.fov, camDur); }, 1.04);

  // POV overlay reveals at 92% of camera position channel (which has delay 0.10s)
  const overlayAt = 1.04 + 0.10 + camDur * 0.92;
  tl.add(() => {
    state = "pov";
    showPovOverlay(prop.userData.id);
    $("#back").hidden = false;
  }, overlayAt);
}

// ----------------------------------------------------------------
// RETURN — 0.9s, power4.out, decisive (faster than going in)
// ----------------------------------------------------------------
function returnToDesk() {
  state = "returning";
  hidePovOverlay();
  $("#back").hidden = true;
  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(camFocus);
  gsap.killTweensOf(camera);

  const rDur = 0.9;
  // Camera retreats — different ease (power4.out) than the way in (expo.inOut + power3.out)
  gsap.to(camera.position, { x: CAM_A.pos.x, y: CAM_A.pos.y, z: CAM_A.pos.z, duration: rDur, ease: "power4.out" });
  gsap.to(camFocus, { x: CAM_A.look.x, y: CAM_A.look.y, z: CAM_A.look.z, duration: rDur, ease: "power4.out" });
  const live = { fov: camera.fov };
  gsap.to(live, {
    fov: 38, duration: rDur, ease: "power4.out",
    onUpdate: () => { camera.fov = live.fov; camera.updateProjectionMatrix(); }
  });

  // Detach prop, return to rest
  const prop = currentProp;
  if (prop) {
    THREE.Object3D.prototype.attach.call(props, prop);
    gsap.to(prop.position, { x: prop.userData.restPos.x, y: prop.userData.restPos.y, z: prop.userData.restPos.z, duration: rDur, ease: "power4.out" });
    gsap.to(prop.rotation, { x: prop.userData.restRot.x, y: prop.userData.restRot.y, z: prop.userData.restRot.z, duration: rDur, ease: "power4.out" });
  }

  // Arms + body unwind (faster than going in)
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
// AMBIENT IDLE — breathing on torso + micro head sway
// ----------------------------------------------------------------
const T0 = performance.now();
const HEAD_BASE_Y = head.position.y;
const TORSO_BASE_Y = torso.position.y;

function ambientIdle() {
  const t = (performance.now() - T0) / 1000;
  // Breathing — y-scale ±0.4% on a 3.2s sine. Runs in ALL states (humans don't stop breathing).
  const breath = Math.sin((t * Math.PI * 2) / 3.2);
  torso.scale.y = 1.0 + breath * 0.004;
  // Head rides the swell up slightly so the neck doesn't compress
  head.position.y = HEAD_BASE_Y + breath * 0.0017;

  // Head sway — only when idle. ±0.4° yaw on 4s + phase-shifted pitch at 0.6x amp.
  if (state === "idle") {
    const yawTarget = Math.sin((t * Math.PI * 2) / 4.0) * (0.4 * Math.PI / 180);
    const pitchTarget = Math.sin((t * Math.PI * 2) / 4.0 + Math.PI / 3) * (0.4 * Math.PI / 180) * 0.6;
    head.rotation.y = lerp(head.rotation.y, yawTarget, 0.04);
    head.rotation.x = lerp(head.rotation.x, pitchTarget, 0.04);
  }
}

// ----------------------------------------------------------------
// ANIMATION LOOP
// ----------------------------------------------------------------
function tick() {
  cx += (tx - cx) * 0.28;
  cy += (ty - cy) * 0.28;
  if (cursor) cursor.style.transform = `translate3d(${cx}px,${cy}px,0) translate(-50%,-50%)`;
  ambientIdle();
  camera.lookAt(camFocus);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ----------------------------------------------------------------
// RESIZE
// ----------------------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
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
renderer.render(scene, camera);
tick();
dismissCurtain();
