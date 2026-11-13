// Import Third-party Dependencies
import {
  PaletteFile,
  PaletteFormat
} from "@jolly-pixel/color";
import type { ColorPalette } from "@jolly-pixel/pixel-draw.renderer";
import {
  pickFiles,
  saveFile
} from "@jolly-pixel/utils/dom";

// CONSTANTS
const kAccept = ".gpl,.hex,text/plain";

export class PaletteTransfer {
  static save(
    palette: ColorPalette,
    format: PaletteFormat,
    name: string
  ): void {
    const text = format.serialize(
      new PaletteFile(palette.toJSON(), name)
    );
    saveFile(
      new Blob([text], { type: "text/plain" }),
      `${name}.${format.extension}`
    );
  }

  static async open(): Promise<File | null> {
    const [file] = await pickFiles({
      accept: kAccept
    });

    return file ?? null;
  }

  static async read(
    file: File
  ): Promise<PaletteFile> {
    return PaletteFormat.fromFileName(
      file.name
    ).parse(await file.text());
  }
}
