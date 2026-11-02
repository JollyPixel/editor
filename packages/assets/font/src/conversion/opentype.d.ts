declare module "opentype.js" {
  export interface PathCommand {
    type: string;
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }

  export class Path {
    commands: PathCommand[];

    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    quadraticCurveTo(x1: number, y1: number, x: number, y: number): void;
    close(): void;
  }

  export interface GlyphOptions {
    name: string;
    unicode?: number;
    advanceWidth: number;
    path: Path;
  }

  export class Glyph {
    constructor(options: GlyphOptions);

    readonly path: Path;
    readonly unicode?: number;
    readonly unicodes: number[];
    readonly advanceWidth: number;
    readonly xMin?: number;
    readonly xMax?: number;
  }

  export interface FontOptions {
    familyName: string;
    styleName: string;
    unitsPerEm: number;
    ascender: number;
    descender: number;
    glyphs: Glyph[];
  }

  export class Font {
    constructor(options: FontOptions);

    readonly unitsPerEm: number;
    readonly ascender: number;
    readonly descender: number;
    readonly encoding: {
      readonly cmap: {
        readonly glyphIndexMap: Readonly<Record<string, number>>;
      };
    };
    readonly glyphs: {
      get(index: number): Glyph;
    };
    readonly tables: {
      readonly post: {
        readonly underlinePosition: number;
        readonly underlineThickness: number;
      };
      readonly head: {
        readonly xMin: number;
        readonly xMax: number;
        readonly yMin: number;
        readonly yMax: number;
      };
    };

    getEnglishName(name: string): string;
    toArrayBuffer(): ArrayBuffer;
  }

  export function parse(buffer: ArrayBuffer | Uint8Array): Font;

  const opentype: {
    Font: typeof Font;
    Glyph: typeof Glyph;
    Path: typeof Path;
    parse: typeof parse;
  };

  export default opentype;
}
