---
"@jolly-pixel/ui": minor
---

`AmbientThemeController` takes an `onChange` option that receives the resolved ambient theme when it changes, instead of writing the host's `theme` attribute.
Add `resolveAmbientTheme()` and `DocumentTheme`, which follows the page theme outside Lit elements.
