// Import Third-party Dependencies
import type { AssetPreview } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import type { PreviewSource } from "../shell/assets/AssetPreviewCache.ts";
import {
  PREVIEW_IMAGE_TYPE,
  parsePreviewReply,
  type PreviewRequest
} from "./protocol.ts";

// CONSTANTS
const kTimeoutMs = 20_000;

interface QueuedRender {
  readonly id: number;
  readonly assetId: string;
  readonly done: PromiseWithResolvers<AssetPreview>;
}

export interface PreviewQueueOptions {
  port: MessagePort;
  /**
   * Edge of the square image to ask for, in device pixels.
   */
  size: () => number;
  /**
   * @default 20_000
   */
  timeoutMs?: number;
}

export class PreviewQueue implements PreviewSource {
  readonly #port: MessagePort;
  readonly #size: () => number;
  readonly #timeoutMs: number;
  readonly #waiting: QueuedRender[] = [];
  #active: QueuedRender | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #nextId = 0;
  #disposed = false;

  constructor(
    options: PreviewQueueOptions
  ) {
    this.#port = options.port;
    this.#size = options.size;
    this.#timeoutMs = options.timeoutMs ?? kTimeoutMs;
    this.#port.addEventListener("message", this.#onMessage);
    this.#port.start();
  }

  preview(
    assetId: string
  ): Promise<AssetPreview> {
    if (this.#disposed) {
      return Promise.reject(new Error("The preview frame closed."));
    }

    this.#nextId += 1;
    const render: QueuedRender = {
      id: this.#nextId,
      assetId,
      done: Promise.withResolvers<AssetPreview>()
    };
    this.#waiting.push(render);
    this.#next();

    return render.done.promise;
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    clearTimeout(this.#timer);
    this.#port.removeEventListener("message", this.#onMessage);
    this.#port.close();

    const closed = new Error("The preview frame closed.");
    for (const render of [this.#active, ...this.#waiting.splice(0)]) {
      render?.done.reject(closed);
    }
    this.#active = null;
  }

  #next(): void {
    if (this.#active !== null) {
      return;
    }
    const render = this.#waiting.shift();
    if (render === undefined) {
      return;
    }

    this.#active = render;
    this.#timer = setTimeout(
      () => this.#settle(
        render.id,
        new Error(`Rendering "${render.assetId}" timed out.`)
      ),
      this.#timeoutMs
    );
    this.#post({
      id: render.id,
      assetId: render.assetId,
      size: this.#size()
    });
  }

  #settle(
    id: number,
    result: AssetPreview | Error
  ): void {
    const render = this.#active;
    if (render === null || render.id !== id) {
      return;
    }

    clearTimeout(this.#timer);
    this.#active = null;
    if (result instanceof Error) {
      render.done.reject(result);
    }
    else {
      render.done.resolve(result);
    }
    this.#next();
  }

  #post(
    request: PreviewRequest
  ): void {
    this.#port.postMessage(request);
  }

  readonly #onMessage = (
    event: MessageEvent
  ): void => {
    const reply = parsePreviewReply(event.data);
    switch (reply?.type) {
      case "rendered":
        this.#settle(reply.id, {
          type: PREVIEW_IMAGE_TYPE,
          bytes: reply.bytes
        });
        break;
      case "failed":
        this.#settle(reply.id, new Error(reply.reason));
        break;
      default:
        break;
    }
  };
}
