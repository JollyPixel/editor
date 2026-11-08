// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type { TextureFile } from "../file/TextureFile.ts";
import { Ktx2Header } from "./Ktx2Header.ts";

export interface TexturePicture {
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

export type TextureView =
  | {
    readonly status: "empty";
  }
  | {
    readonly status: "loading";
  }
  | {
    readonly status: "ready";
    readonly picture: TexturePicture;
  }
  | {
    readonly status: "header";
    readonly header: Ktx2Header;
  }
  | {
    readonly status: "failed";
    readonly error: string;
  };

type TexturePreviewEvents = {
  change: () => void;
};

export class TexturePreview {
  readonly file: TextureFile;

  #events = new Emitter<TexturePreviewEvents>();
  #loads = 0;
  #view: TextureView = {
    status: "empty"
  };

  constructor(
    file: TextureFile
  ) {
    this.file = file;
  }

  get view(): TextureView {
    return this.#view;
  }

  get picture(): TexturePicture | null {
    return this.#view.status === "ready" ? this.#view.picture : null;
  }

  subscribe(
    event: keyof TexturePreviewEvents,
    listener: () => void
  ): () => void {
    return this.#events.subscribe(event, listener);
  }

  follow(): () => void {
    const unsubscribe = this.file.subscribe(() => {
      void this.#reload();
    });
    void this.#reload();

    return () => {
      unsubscribe();
      this.#loads++;
      this.#show({
        status: "empty"
      });
    };
  }

  async #reload(): Promise<void> {
    const load = ++this.#loads;
    const { bytes } = this.file;
    if (bytes === null) {
      this.#show({
        status: "empty"
      });

      return;
    }

    if (this.#view.status !== "ready") {
      this.#show({
        status: "loading"
      });
    }
    const view = await this.#read(bytes);
    if (load === this.#loads) {
      this.#show(view);
    }
    else if (view.status === "ready") {
      URL.revokeObjectURL(view.picture.url);
    }
  }

  async #read(
    bytes: Uint8Array
  ): Promise<TextureView> {
    try {
      if (this.file.extension === ".ktx2") {
        return {
          status: "header",
          header: Ktx2Header.parse(bytes)
        };
      }

      return {
        status: "ready",
        picture: await decodePicture(bytes, this.file.mimeType)
      };
    }
    catch (error) {
      return {
        status: "failed",
        error: errorMessage(error)
      };
    }
  }

  #show(
    view: TextureView
  ): void {
    const previous = this.picture;
    this.#view = view;
    if (previous !== null && previous !== this.picture) {
      URL.revokeObjectURL(previous.url);
    }
    this.#events.emit("change");
  }
}

async function decodePicture(
  bytes: Uint8Array,
  type: string
): Promise<TexturePicture> {
  const url = URL.createObjectURL(
    new Blob([bytes.slice()], { type })
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    return {
      url,
      width: image.naturalWidth,
      height: image.naturalHeight
    };
  }
  catch (error) {
    URL.revokeObjectURL(url);
    throw new Error("The browser could not decode this image.", {
      cause: error
    });
  }
}
