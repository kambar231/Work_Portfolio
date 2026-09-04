# The "not-AI" photo recipe (what actually works)

The fix for the AI look is to stop describing a *nice picture* and start describing
a *specific photograph taken by a specific camera*, with real imperfections.

## Ban these words
cinematic, dramatic, chiaroscuro, hyperreal, 8K, ultra-detailed, masterpiece,
award-winning, product-photography, perfect, flawless, pristine, clean, render.
(They all push toward the glossy CGI look.)

## Always include these 10 things
1. **Camera + lens + ISO** — e.g. "Fujifilm X-T4, 23mm f/2, ISO 3200".
2. **Film grain / noise** — "visible film grain, especially in the shadows".
3. **One light source, with direction + color temp** — "a tungsten desk lamp just
   out of frame top-right, ~3200K, hard falloff to the left".
4. **Environmental grime** — dust, fingerprints, coffee-ring stains, swarf, smudges.
5. **"Used moments ago", candid, a little messy** — not "arranged" or "composed".
6. **A film stock for color** — "Kodak Portra 400 color science" (warm, slightly
   desaturated, creamy highlights, rich shadow detail).
7. **A blurred foreground element** in one corner for real depth.
8. **A photography genre** — "documentary photojournalism still-life".
9. **Optical flaws** — slight vignetting, faint chromatic aberration, edge softness.
10. **Imperfect framing** — "handheld, slightly off-level".

## The 4 that matter even more (added after testing)
11. **Scene logic / a story** — every object must have a *reason* to be there. Don't
    "put a part in a clamp"; the part is in the vise because it's being deburred (a
    file leans against it), and the laptop shows the CAD of *that same part*. Coherence
    is what stops it reading as "random AI stuff".
12. **Restraint** — a few *deliberate* objects on a mostly-clean surface. Tidy, careful
    person — NOT messy. "Most of the surface clean and uncluttered."
13. **Deterministic layout** — dictate exactly what sits where ("left to right: …",
    "in the foreground lower-left: …") so Gemini doesn't improvise a random scene.
14. **A negative prompt** — end with: "no duplicated or warped tools, no scattered
    debris, no melted text on screens, no impossible geometry, no logos, no text".

## Round 3 lessons (machine-shop scene)
15. **Write narrative prose, not keyword lists** — Google's own Nano Banana guide:
    describe the photograph the way a photographer would tell it, in flowing
    sentences. Keyword salads produce keyword-salad images.
16. **Name real equipment** — "a benchtop metal lathe on its steel stand", "a
    Bridgeport-style knee mill", "a machinist's tool chest with drawers", "a cast-iron
    bench vise", "an articulated task lamp with an orange enamel dome shade, bulb
    hidden up inside". Generic props (boxes, brooms) = instant fake. Specific gear =
    instant real.
17. **Use the model's own critique** — Gemini often *tells you* what's physically
    inconsistent in its output ("the lathe is lit by a secondary source…"). Reply
    "fix exactly the inconsistencies you noted, keep everything else identical" — an
    in-context edit that preserves composition and repairs the physics.

## Template (fill the brackets)
> A candid documentary [genre] photo of [subject], taken on a [camera + lens] at
> ISO [800–3200], [film stock] color science. Handheld at a casual angle, slightly
> off-level. The only light is [one source + direction + ~temp] with a hard falloff
> so [area] sinks into shadow. [Subject details — used moments ago, a little messy,
> with real grime: dust, fingerprints, stains]. A slightly out-of-focus [object] in
> the lower-[corner] foreground. Visible film grain in the shadows, slight corner
> vignetting, faint chromatic aberration at high-contrast edges, shallow depth of
> field. Not styled, not cinematic, imperfect framing. No people, no text, no logos.

## The exact prompt that produced the good workbench
> A candid documentary still-life photo of a real engineer's home workbench, taken
> on a Fujifilm X-T4 with a 23mm f/2 lens at ISO 3200, Kodak Portra 400 color
> science (warm, slightly desaturated, creamy highlights, rich shadow detail).
> Handheld at a casual three-quarter angle, slightly off-level, looking down. The
> only light is a warm tungsten desk lamp just out of frame at the top-right,
> throwing light from the right at about 3200K, with a hard falloff so the left side
> sinks into shadow. On the worn, scratched wooden bench, used moments ago and a
> little messy: an aluminum part clamped in a small bench vise with curls of metal
> swarf around it, a grey 3D-printed bracket, steel calipers resting on an open
> spiral notebook with faint pencil sketches, a few loose hex keys, a coffee mug
> leaving a ring stain, a coiled cable. Real grime: dust, fingerprints on the metal,
> a smudge or two. A slightly out-of-focus coil of wire in the extreme lower-left
> foreground framing the shot. Visible film grain especially in the shadows, slight
> corner vignetting, faint chromatic aberration where bright metal meets shadow,
> very shallow depth of field focused on the vise with gentle softness toward the
> edges. Documentary photojournalism, not styled, not cinematic, imperfect framing.
> No people, no text, no logos.
