# Glossary

- **Unit color**: an `RGBA` with channels from 0 to 1. Most functions read and
  return it.
- **Byte color**: an `RGBA8` with channels from 0 to 255, as stored in
  `ImageData` and pixel-art documents. Functions that read it end in `8`.
- **Color space**: a hue-based model (HSV, OKHSV, HSL, OKHSL, HWB, OKLCH) with
  its conversions to and from a unit color. One `ColorSpace` object each.
- **Powerless channel**: a channel the color does not define, such as the hue
  of a gray or the saturation of black. A color space carries it from a
  previous color when one is given.
- **Gamut mapping**: bringing an OKLCH or OKLab color that sRGB cannot show
  back inside by lowering its chroma.
- **Hue interpolation**: the arc a mix takes around the hue circle: shorter,
  longer, increasing or decreasing.
- **Color sequence**: an endless list of colors read by index or by a hashed
  key, used to tell peers and objects apart.
- **Ink**: the black or white chosen to stay readable over a color.
