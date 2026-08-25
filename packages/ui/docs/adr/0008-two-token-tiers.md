---
status: accepted
---

# Two token tiers: private ramps, public semantics

Tier one is OKLCH ramps (`--jolly-neutral-*`, `--jolly-accent-*`, danger/warning/success), never
read by a component. Tier two is roughly thirty semantic aliases, the only names components use and
the only names consumers override; light and dark select ramp indices through `var()` rather than
inlining hand-picked pairs. Ramp privacy is conventional, not enforced.

The accent is seeded from `#4488ff` (used 24 times across voxel-map and voxel-model) and is split in
two, because one value cannot do both jobs: `#3a6fc2` measures 3.5:1 as text on `#131b24` but 5.0:1
beneath white. Peer colours rotate hue on the golden angle at fixed lightness and chroma, so any
number of peers stay mutually distinguishable and equally legible.

## Considered Options

- **A single flat tier.** Thirteen names do not stretch to 45 components with eight states, and
  light and dark drift apart.
- **A third tier of per-component tokens.** About 180 public names to document and keep stable, for
  a library maintained by a small team.
- **Hand-authored hex ramps.** Perceptual spacing drifts between steps, and every peer colour needs
  hand checking.
- **One accent token for fill and text.** Measured above; it cannot satisfy both.
- **Seeding the accent from pixel-art's blue.** It would shift a blue used four times more often.
