// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { fileExtension } from "../file/fileExtension.ts";
import { MissingResourceError } from "./errors/MissingResourceError.ts";

// CONSTANTS
const kBlankPixel = "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const kInlineSchemes = ["data:", "blob:"];
const kImageExtensions = new Set([
  ".bmp",
  ".dds",
  ".gif",
  ".jpeg",
  ".jpg",
  ".ktx2",
  ".png",
  ".tga",
  ".tif",
  ".tiff",
  ".webp"
]);

export class MissingResources {
  readonly manager: THREE.LoadingManager;

  #names = new Set<string>();

  constructor() {
    this.manager = new THREE.LoadingManager()
      .setURLModifier((url) => this.#resolve(url));
  }

  get names(): string[] {
    return [...this.#names];
  }

  #resolve(
    url: string
  ): string {
    if (kInlineSchemes.some((scheme) => url.startsWith(scheme))) {
      return url;
    }

    const name = decodeURIComponent(
      url.slice(url.replaceAll("\\", "/").lastIndexOf("/") + 1)
    );
    this.#names.add(name);
    if (!kImageExtensions.has(fileExtension(name))) {
      throw new MissingResourceError(name);
    }

    return kBlankPixel;
  }
}
