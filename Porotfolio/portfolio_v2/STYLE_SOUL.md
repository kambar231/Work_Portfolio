# desk.html — pushing the look toward Pixar's *Soul*

A 90/10 plan for making the desk scene visibly more *intentional* without rewriting it. Companion to `HANDOFF.md`. Read both before touching code.

The thesis: **most of the "this is a Three.js demo" feeling comes from rendering choices, not from the geometry.** The geometry is fine. What's missing is a coherent rendering philosophy. Soul gives us one — stylized characters lit and graded with care, sitting in environments that feel painted, surfaces that breathe.

---

## What "Soul" actually is, when you strip out the marketing

The art-direction research distilled into things we can act on:

- **Stylized characters, near-photoreal environments.** The film deliberately doesn't reconcile them. The mismatch *is* the style. → For us: the *character* gets toon-shaded; the *desk and room* stay closer to PBR.
- **Hands and instruments get *more* detail than usual.** Production studied jazz pianists' fingernails. → Drop the "mitten hand" idea. The hands are where the character lives.
- **Skin is a layered mix of solid colors taken from Harlem Renaissance painters, not one base color with SSS.** → For us: don't chase realistic skin SSS. Two-tone the skin with a stylized ramp.
- **Practicals first, key/fill second.** Jazz-club scenes are driven by stage wash, neon, table lamps doing the heavy lifting. → For us: add a desk lamp that *actually casts light*. It motivates the warm key Kambar already has.
- **Two-mode visual system, hard switch.** NYC = anamorphic, grain, saturated practicals. Great Before = soft, low-contrast, no grain. → For us: the third-person desk shot and the first-person POVs *should look like different rendering modes.* This is a free dramatic device that's already half-built in the architecture.
- **Post is doing a lot of the work.** Soft low-threshold bloom, gentle grain, shallow DoF, atmospheric haze, ACES-adjacent grade. → For us: a small post chain is non-negotiable. We can't get to Soul without it.

Source citations live in §6 at the bottom — the heavy research is documented but pushed out of the path so this brief stays readable.

---

## The eight changes, ranked by impact-per-hour

Roughly: do them in this order. Each is independent — you can stop after #4 and the scene will already feel different.

### 1 · Switch tone mapping ACES Filmic (1 line, ~10% of the look)

```js
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.00; // unchanged
```

Currently using `CineonToneMapping` (chosen earlier because "ACES desaturates reds"). That advice was about an older Three.js + a slightly different palette. ACES Filmic in r148 with the helmet's `RED = 0xb82a18` reads fine and gives the whole scene the warm filmic roll-off that Pixar movies live in. Cineon is cooler and more contrasty — wrong reference for Soul.

Test it. If the helmet still desaturates, push `RED` to `0xc8331e` and the gold to `0xe2b54a` — it's cheaper to art-direct the colors hotter than to fight the tone curve.

### 2 · PMREM environment from a procedural scene (~30 lines, ~25% of the look)

This is the single biggest visual change for the helmet, the gold spine, and any metallic surface. Right now metals render almost matte because there's no `scene.environment` — Three.js metals need *something* to reflect.

```js
const envScene = new THREE.Scene();
envScene.background = new THREE.Color(0xf4ecd8); // warm cream "sky"

// 4-6 large emissive panels around the scene as "soft light blobs"
const warmTop = new THREE.Mesh(
  new THREE.PlaneGeometry(6, 6),
  new THREE.MeshBasicMaterial({ color: 0xffd8a8 })
);
warmTop.position.set(0, 4, 0); warmTop.rotation.x = Math.PI / 2;
envScene.add(warmTop);

const coolLeft = new THREE.Mesh(
  new THREE.PlaneGeometry(4, 6),
  new THREE.MeshBasicMaterial({ color: 0xbcd4ff })
);
coolLeft.position.set(-4, 1, 0); coolLeft.rotation.y = Math.PI / 2;
envScene.add(coolLeft);
// ... a couple more — warm right, cool back, dim floor

const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envMap = pmrem.fromScene(envScene, 0.04).texture; // 0.04 = soft blur
scene.environment = envMap; // applies to all StandardMaterials automatically
pmrem.dispose();
```

The helmet stops looking matte. The gold spine starts catching a colored reflection. The wood desk gets a faint highlight roll. **This is the change that makes the scene stop feeling unlit.**

The procedural env stays in the project's "no external assets" rule. Don't load an HDRI file.

### 3 · MeshToonMaterial with a 3-step gradient on character + props (~20% of the look)

Mix, don't replace. The rule is:

- **Toon-shade:** skin, hair, blazer, shirt, tie, paper, walnut desk, mug ceramic, letter.
- **Keep Standard + env map:** Iron Man helmet (red & gold), gold spine, drawer handles, anything metallic.

Why mix: toon kills specular reflections and makes metals look dead. Soul itself uses different shading for different surfaces — the whole "stylized character / photoreal environment" thing is exactly this distinction at a smaller scale.

```js
function makeRamp(stops = [80, 160, 255]) {
  const data = new Uint8Array(stops.length);
  stops.forEach((v, i) => data[i] = v);
  const tex = new THREE.DataTexture(data, stops.length, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; // sharp bands, not blurred
  tex.needsUpdate = true;
  return tex;
}
const skinRamp  = makeRamp([110, 180, 255]); // softer for skin
const clothRamp = makeRamp([60, 130, 255]);  // crunchier for cloth

const matSkinToon  = new THREE.MeshToonMaterial({ color: SKIN, gradientMap: skinRamp });
const matNavyToon  = new THREE.MeshToonMaterial({ color: NAVY, gradientMap: clothRamp });
// ... swap into the relevant places. Keep the originals as fallback in case.
```

Three stops is the sweet spot. Two looks too retro; four blends back into Standard.

The key/fill/rim rig keeps working — toon respects light direction, just bands the falloff. The rim light will read as a hard edge highlight, which is exactly the Pixar-character look.

### 4 · Inverted-hull outlines on the character only (~15% of the look)

This is the single most "this is a cartoon character" cue. Soul characters have it (subtly — almost an inner glow), Pixar's broader character work has it, every Disney/Pixar-styled portfolio you've seen on awwwards has it.

```js
function addOutline(mesh, thickness = 1.02, color = 0x14171c) {
  const outline = new THREE.Mesh(
    mesh.geometry, // share the geometry — no allocation
    new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
  );
  outline.scale.setScalar(thickness);
  mesh.add(outline);
  return outline;
}
// Apply to character meshes only — not props, not furniture. Props are "real."
```

Two important "don't paint into a corner" notes:

1. **Apply only to the character group**, not the desk or props. The mismatch is the style. If everything gets outlines, it stops reading as a stylized human in a real room and starts reading as a flat cartoon — which kills the Soul thesis.
2. **Procedural Three.js primitives sometimes have non-welded vertex seams.** If you see gaps in the outline at sphere/cylinder joins, that's the cause — fix by either welding the geometry (`BufferGeometryUtils.mergeVertices`) or accepting the soft seam. Don't fix it by adding tiny corrective spheres — that's the kind of shortcut that ossifies later.

Thickness `1.02` is the starting point. Tune per mesh — the head probably needs `1.015` and the hands `1.025`.

### 5 · Small post chain: bloom + vignette + grain (~15% of the look)

⚠ **r148 compatibility note.** Three.js removed the legacy `examples/js/` UMD postprocessing in r148. Three options:

- **Recommended:** keep the core at r148 but load the postprocessing scripts from r147 unpkg URLs. The internal APIs match and people do this. URLs (all confirmed live):

  ```html
  <script src="https://unpkg.com/three@0.147.0/examples/js/shaders/CopyShader.js"></script>
  <script src="https://unpkg.com/three@0.147.0/examples/js/shaders/LuminosityHighPassShader.js"></script>
  <script src="https://unpkg.com/three@0.147.0/examples/js/postprocessing/EffectComposer.js"></script>
  <script src="https://unpkg.com/three@0.147.0/examples/js/postprocessing/RenderPass.js"></script>
  <script src="https://unpkg.com/three@0.147.0/examples/js/postprocessing/ShaderPass.js"></script>
  <script src="https://unpkg.com/three@0.147.0/examples/js/postprocessing/UnrealBloomPass.js"></script>
  ```

- Or downgrade Three.js core to r147. Same API surface for everything you're doing.
- Or write a tiny custom composer (~80 lines: two render targets, ping-pong, one fullscreen quad with a `ShaderMaterial`). Best long-term — no version coupling, no third-party script load order to manage — but most work.

Minimum chain for the Pixar-gentle look:

```js
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));
composer.addPass(new THREE.UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.35,   // strength — gentle
  0.6,    // radius
  0.85    // threshold — only highlights bloom
));
// custom shader pass for vignette + grain in one fragment shader (15 lines)
```

Then call `composer.render()` instead of `renderer.render()` in `tick()`.

**Don't add DoF (BokehPass).** It's polish, it costs perf, and it's easy to over-tune into looking broken. Save for last or skip.

**This is also where the two-mode visual system pays off.** When you tween into a POV, bump the bloom strength to 0.55 and the vignette darker. When you return, ease back. The desk and the POVs will literally feel like different lenses.

### 6 · Canvas-noise roughness map on every Standard material (~10% of the look)

```js
function buildNoiseRoughness(size = 256, low = 0.5, high = 0.85) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d");
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (low + Math.random() * (high - low)) * 255;
    img.data[i] = img.data[i+1] = img.data[i+2] = v; img.data[i+3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}
const noiseRough = buildNoiseRoughness();
// matNavy.roughnessMap = noiseRough; matWood.roughnessMap = noiseRough; ...
```

This is what stops the spheres from looking like spheres. Combined with #2 (env map), every glossy surface picks up *broken* reflections that shimmer slightly as the camera moves — the "hand-painted" feel. Costs almost nothing.

Use real value-noise (3 octaves of Perlin) instead of `Math.random()` for a smoother painted feel. There's a ~30-line value-noise implementation any agent can generate; not worth pasting here.

### 7 · Fresnel rim glow via `onBeforeCompile` (~5%, but punches above its weight)

```js
function addFresnelRim(material, color = 0xffd6a8, power = 3.0, intensity = 0.6) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.fresnelColor = { value: new THREE.Color(color) };
    shader.uniforms.fresnelPower = { value: power };
    shader.uniforms.fresnelIntensity = { value: intensity };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 fresnelColor;
        uniform float fresnelPower;
        uniform float fresnelIntensity;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), fresnelPower);
        gl_FragColor.rgb += fres * fresnelColor * fresnelIntensity;`);
  };
}
// addFresnelRim(matSkinToon, 0xffdcb5, 3.0, 0.4);
// addFresnelRim(matNavyToon, 0xbcd4ff, 2.5, 0.3); // cool rim on blazer
```

The "alive" silhouette glow. Use a warm tone on skin (echoes the key), a cool tone on the blazer (echoes the rim light). This is the cheapest possible signal that the character isn't a static cutout.

### 8 · Fake AO contact shadows under the character/props (~3%)

```js
function addContactShadow(parent, radius = 0.4, opacity = 0.35) {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, `rgba(0,0,0,${opacity})`);
  grad.addColorStop(1, `rgba(0,0,0,0)`);
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.001; // just above the floor
  parent.add(disc);
}
```

One under the character's seat, one under each prop, one under the desk legs. The scene grounds. Almost free.

---

## A note on the *character*

The Soul research has one finding that should override the HANDOFF.md roadmap:

> **Hands get *more* detail than usual. Reducing finger detail would kill the design intent.**

Right now the hands are mittens. The Soul-correct move is to **build proper 4-finger-plus-thumb hands.** It's the one piece of geometry that is worth doing in detail. The handoff doc lists this as direction A.7; it should be the #1 character upgrade, not the last.

Everything else on the character (head shape, hair tufts, lapels, cuffs) gets carried by the rendering changes above — toon shading + outlines + rim light will *automatically* make the existing simple geometry read as deliberate stylization rather than as low-effort. Don't rebuild the head into a LatheGeometry profile until you've seen how it looks under the new shading. You may decide it doesn't need it.

---

## What we are *not* doing (and why)

These are the shortcuts that ossify and are worth resisting:

- **Loading a Ready Player Me GLB head.** The HANDOFF doc mentions this. Don't. It will look pasted in next to procedural primitives, and once you add it you can't undo the inconsistency. Soul's whole point is shape-language consistency.
- **Skipping the env map and just turning up the lights.** Looks brighter, not better. Metals stay matte.
- **Hand-tuning materials per-mesh without a system.** Build the four or five reusable toon-material factories and apply them everywhere. Otherwise the file becomes a maze.
- **Adding bloom without thresholding.** Will bleach everything. The `0.85` threshold matters.
- **Adding DoF early.** Looks broken until perfectly tuned. Save for last.

---

## Suggested order of operations

Two sittings of an hour each gets you to the new look.

**Sitting 1 — the core (1 hour):**
1. Change tone mapping to ACES Filmic (1 min)
2. Add PMREM env map (15 min)
3. Build the toon-material factories, swap into skin/cloth/wood/paper (30 min)
4. Add the inverted-hull outline helper, apply to character group (15 min)

**Sitting 2 — the polish (1 hour):**
5. Wire up the post chain (bloom + vignette/grain shader pass) (30 min)
6. Noise roughness map across Standard materials (10 min)
7. Fresnel rim on skin + blazer (10 min)
8. Contact shadow discs (10 min)

After both sittings the scene will read closer to *Soul* than to *Three.js demo*. If you only do sitting 1, you'll still get a visible step-change.

**Then, separately**, do the proper 4-finger hands. That's a geometry change, not a rendering one, but it's the single most Soul-correct character upgrade per the research.

---

## §6 — Sources

Pixar's Soul:

- [Art Director Daniel López Muñoz on Finding Pixar's "Soul" — Motion Picture Association](https://www.motionpictures.org/2020/12/art-director-daniel-lopez-munoz-on-finding-pixars-soul/)
- [Designing the Illusory: Souls, Counselors, and The Great Before — AWN](https://www.awn.com/animationworld/designing-illusory-souls-counselors-and-great-soul)
- [Soul: Pixar Designed a Tactile New York and an Ethereal Great Before — IndieWire](https://www.indiewire.com/awards/industry/soul-pixar-design-new-york-great-before-1234610371/)
- [Cinematography with Soul — Pixar RenderMan](https://renderman.pixar.com/stories/cinematography-with-soul)
- [Making Souls: Methods and a Pipeline for Volumetric Characters — Pixar Graphics / SIGGRAPH 2021 (PDF)](https://graphics.pixar.com/library/SoulVolumetricChars/paper.pdf)
- [Pixar Deep Dive on SSS — fxguide](https://www.fxguide.com/fxfeatured/pixar-deep-dive-on-sss-siggraph-preview/)
- [Soul Cinematography (Matt Aspbury) — Go Creative Show](https://gocreativeshow.com/soul-cinematography-with-matt-aspbury/)

Three.js stylized rendering (r148):

- [MeshToonMaterial docs](https://threejs.org/docs/pages/MeshToonMaterial.html)
- [PMREMGenerator docs](https://threejs.org/docs/pages/PMREMGenerator.html)
- [UnrealBloomPass docs](https://threejs.org/docs/pages/UnrealBloomPass.html)
- [examples/js removed in r148 — discourse thread](https://discourse.threejs.org/t/the-examples-js-directory-will-be-removed-with-r148/45349)
- [Three.js r148 release notes](https://github.com/mrdoob/three.js/releases/tag/r148)
- [Dusan Bosnjak: extending Three.js materials](https://medium.com/@pailhead011/extending-three-js-materials-with-glsl-78ea7bbb9270)
- [Three.js Journey: modified materials](https://threejs-journey.com/lessons/modified-materials)
- [Codrops: magical marbles](https://tympanus.net/codrops/2021/08/02/magical-marbles-in-three-js/)
- [Maya Nedeljkovich: custom toon shader](https://www.maya-ndljk.com/blog/threejs-basic-toon-shader)
- [Josh Marinacci: cartoon outline](https://medium.com/@joshmarinacci/cartoon-outline-effect-6c4e95545537)
- [Omar Shehata: outlines in WebGL](https://omar-shehata.medium.com/how-to-render-outlines-in-webgl-8253c14724f9)
- [Tone mapping overview — discourse](https://discourse.threejs.org/t/tone-mapping-overview/75204)

Note: one Soul attribution that gets repeated online (Hilma af Klint / Pierre Bonnard as direct influences) could not be confirmed in primary sources. The documented art references are Picasso (counselors' line faces), Harlem Renaissance painters (skin color), and Swedish sculpture/nature/light (Great Before). Treat the others as fan analysis.
