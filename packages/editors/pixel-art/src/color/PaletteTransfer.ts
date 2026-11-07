// Import Third-party Dependencies
import {
  PaletteFile,
  PaletteFormat
} from "@jolly-pixel/color";
import type { ColorPalette } from "@jolly-pixel/pixel-draw.renderer";
import { saveFile } from "@jolly-pixel/utils/dom";

// CONSTANTS
const kAccept = ".gpl,.hex,text/plain";

export class PaletteTransfer {
  static save(
    palette: ColorPalette,
    format: PaletteFormat,
    name: string
  ): void {
    const text = format.serialize(new PaletteFile(palette.toJSON(), name));
    saveFile(
      new Blob([text], { type: "text/plain" }),
      `${name}.${format.extension}`
    );
  }

  static open(): Promise<File | null> {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kAccept;

    const { promise, resolve } = Promise.withResolvers<File | null>();
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();

    return promise;
  }

  static async read(
    file: File
  ): Promise<PaletteFile> {
    return PaletteFormat.fromFileName(file.name).parse(await file.text());
  }
}
