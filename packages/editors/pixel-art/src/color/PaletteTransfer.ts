// Import Third-party Dependencies
import {
  PaletteFile,
  type PaletteFormat
} from "@jolly-pixel/color";
import type { ColorPalette } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { downloadBlob } from "../shared/dom.ts";

// CONSTANTS
const kAccept = ".gpl,.hex,text/plain";

export class PaletteTransfer {
  static format(
    fileName: string
  ): PaletteFormat {
    return fileName.toLowerCase().endsWith(".hex") ? "hex" : "gpl";
  }

  static save(
    palette: ColorPalette,
    format: PaletteFormat,
    name: string
  ): void {
    const text = new PaletteFile(palette.toJSON(), name).serialize(format);
    downloadBlob(
      new Blob([text], { type: "text/plain" }),
      `${name}.${format}`
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
    return PaletteFile.parse(await file.text(), PaletteTransfer.format(file.name));
  }
}
