---
"@jolly-pixel/ui": minor
---

`jolly-dialog` gains `headingEditable`, which renders the heading as a
content-sized title input and emits `jolly-heading-change` on commit.
The header now carries a faint `--jolly-dialog-chrome-bg` tint, and both header
and footer take the density-scaled `--jolly-dialog-chrome-padding`.
Fields gain `--jolly-field-inset-start`, and a field's description no longer
inherits the text alignment that a reflected `align` attribute hints at.
