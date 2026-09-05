# Writing rules for the portfolio

Every sentence in `index.html` must pass this. Built from Kambar's own checklist in
`Desktop/Resume/COWORK_APPLY_PROMPT.md` section 4a, the AI-detection paragraph in
`Desktop/Resume/D-Wave Cover Letter Options.md`, and web research on how recruiters and
detectors flag machine-written text (2026).

## Why this exists

Detectors measure how predictable word choice is and how uniform sentence length is.
Recruiters, without any tool, flag generic openings, C-suite vocabulary on an entry-level
writer, missing specifics, and uniform confidence. The fix is not clever wording. It is
concrete detail only Kambar could write, and rhythm that varies the way real speech does.

## Banned words (hard fail on any hit)

excited, thrilled, passionate, leverage, spearheaded, proven track record, robust, seamless,
cutting-edge, innovative, dynamic (as an adjective), foster, empower, elevate, journey,
testament, unlock, harness, showcase, utilize, synergy, world-class, delve, align (as in
"aligns with my values"), paramount, tapestry, realm, meticulous, boasts, game-changer,
vibrant, pivotal, crucial, comprehensive.

## Banned openers and phrases

- "I am writing to..." / "I am excited to..." / "As a passionate..."
- "With X years of experience in..."
- Any sentence that would fit unchanged in another person's portfolio.

## Banned constructions

1. Em dash (U+2014). Use a comma, a period, or rewrite. No semicolon chains either.
2. "not just X, but Y" and "not only X but also Y".
3. Perfectly parallel triplets ("design, build, and test"; "fast, reliable, and scalable").
   Use two items, or four, or break the rhythm.
4. Generic mission praise. Name a specific product, part, standard, or number instead.
5. Hollow closers ("I look forward to...", "Thank you for considering...").

## Positive requirements

- **Sentence length varies hard.** At least one sentence under 6 words and one over 25 words
  in any given entry. Never leave three consecutive sentences within 5 words of each other.
- **Contractions allowed and used** (I've, it's, that's, wasn't).
- **Numbers are specific and non-round** and come from the resume or the source sites
  (14%, 10%, 7% OEE, 2.2 kW, 1200 by 800 mm, 0.1 mm, 1273 K, 600 volunteers, 2000 trees).
  Never invent a number.
- **Details only Kambar could write**: the pressure transducers in the hydraulic manifold,
  the strain-gauge frame validation, the AC steer-differentiation logic, the BorgWarner
  teardown reports for Cummins and Ford, the truncated-octahedron lattice mold shell, the
  Vena Contracta inlet coefficient, the star ground against spindle EMI.
- **Honest gaps stay in.** Where a step has no evidence, one plain line says so. Uniform
  confidence reads as machine-written. A prototype that overheats is left as a prototype
  that overheats.

## Grep check (run before every commit; any hit means not done)

Run from the repo root. Zero output required.

```bash
grep -nE $'—|not just|not only|\\b(excited|thrilled|passionate|leverage|leveraged|leveraging|spearhead|spearheaded|proven track record|robust|seamless|cutting-edge|cutting edge|innovative|foster|empower|elevate|journey|testament|unlock|harness|showcase|utilize|utilise|synergy|world-class|world class|delve|paramount|tapestry|realm|meticulous|boasts|game-changer|vibrant|pivotal|crucial|comprehensive)\b' index.html
```

Note: the pattern is case-insensitive on the word list via `grep -niE` if needed. "Harness"
as a physical wiring harness is allowed only if it ever refers to a real cable harness; today
it does not appear, so treat any hit as a fail.
