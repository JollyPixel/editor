---
"@jolly-pixel/runtime": minor
---

`Runtime.create()` now accepts a CSS selector in addition to an
`HTMLCanvasElement`, removing the manual `document.querySelector` and
null-check boilerplate from every call site.
