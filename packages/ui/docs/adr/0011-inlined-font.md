---
status: accepted
---

# Roboto Mono is inlined as a base64 data URI, one weight

The package builds with bare `tsc` and has no asset pipeline that could rewrite a `.woff2` URL for a
consumer's bundler, so the latin subset of Roboto Mono 400 (Apache-2.0) ships as a `data:` URI in
`src/theme/font.ts`, roughly 16KB. `@font-face` is ignored inside a shadow root, so
`ensureFontFace()` registers it against the document; importing `themeStyles` calls it, and without
it the family falls back to the system mono stack.

One weight only — a second would roughly double those bytes — so hierarchy is expressed through tint
and letter-spacing rather than a bolder face that would otherwise be synthesised.
