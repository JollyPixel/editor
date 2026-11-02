// Import Third-party Dependencies
import opentype from "opentype.js";

export function blockLetterFont(): Uint8Array {
  const block = new opentype.Path();
  block.moveTo(100, 0);
  block.lineTo(100, 700);
  block.lineTo(500, 700);
  block.close();

  const font = new opentype.Font({
    familyName: "Fixture",
    styleName: "Regular",
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs: [
      new opentype.Glyph({
        name: ".notdef",
        advanceWidth: 650,
        path: new opentype.Path()
      }),
      new opentype.Glyph({
        name: "space",
        unicode: 32,
        advanceWidth: 300,
        path: new opentype.Path()
      }),
      new opentype.Glyph({
        name: "A",
        unicode: 65,
        advanceWidth: 650,
        path: block
      })
    ]
  });

  return new Uint8Array(font.toArrayBuffer());
}
