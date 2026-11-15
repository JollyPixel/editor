// Import Third-party Dependencies
import {
  Zip,
  ZipDeflate,
  ZipPassThrough
} from "fflate";

// CONSTANTS
const kCompressedTypes = /^(?:image|audio|video)\/(?!svg)|^model\/gltf-binary$/;

export class ZipStream {
  #chunks: Uint8Array[] = [];
  #zip = new Zip((error, chunk) => {
    if (error !== null) {
      throw error;
    }
    this.#chunks.push(chunk);
  });

  add(
    name: string,
    bytes: Uint8Array,
    type?: string
  ): Uint8Array[] {
    const file = type !== undefined && kCompressedTypes.test(type) ?
      new ZipPassThrough(name) :
      new ZipDeflate(name);
    this.#zip.add(file);
    file.push(bytes, true);

    return this.#drain();
  }

  end(): Uint8Array[] {
    this.#zip.end();

    return this.#drain();
  }

  #drain(): Uint8Array[] {
    const chunks = this.#chunks;
    this.#chunks = [];

    return chunks;
  }
}
