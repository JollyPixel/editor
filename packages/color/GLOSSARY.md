# Glossary

- **Unit color**: an `RGBA` with channels from 0 to 1. A `Color` is the
  immutable object form that parses, writes and compares it.
- **Byte color**: an `RGBA8` with channels from 0 to 255, as stored in
  `ImageData` and pixel-art documents. `Color.fromBytes` and `toBytes`
  convert it; `ByteColorInput` also accepts a CSS string.
- **Color space**: a hue-based model (HSV, OKHSV, HSL, OKHSL, HWB, OKLCH) with
  its conversions to and from a unit color. One `ColorSpace` object each.
- **Hue space**: the hue, saturation and level model a color picker moves
  through (HSV, OKHSV, OKHSL). The level is value or lightness. One
  `HueSpace` object each.
- **Powerless channel**: a channel the color does not define, such as the hue
  of a gray or the saturation of black. A color space carries it from a
  previous color when one is given.
- **Gamut mapping**: bringing an OKLCH or OKLab color that sRGB cannot show
  back inside by lowering its chroma.
- **Gradient**: a blend between two colors in one space, read at any amount
  or as evenly spaced steps.
- **Hue interpolation**: the arc a mix takes around the hue circle: shorter,
  longer, increasing or decreasing.
- **Color sequence**: an endless list of colors read by index or by a hashed
  key, used to tell peers and objects apart.
- **Ink**: the black or white chosen to stay readable over a color.
