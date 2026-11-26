// Import Third-party Dependencies
import type { AssetPreview } from "@jolly-pixel/asset-server/client";
import {
  parseFrameMessage,
  type CatalogShare,
  type LaunchIdentity
} from "@jolly-pixel/editor.host";
import {
  delay,
  withTimeout
} from "@jolly-pixel/utils";

// Import Internal Dependencies
import { EditorFrame } from "../tabs/EditorFrame.ts";
import { PreviewQueue } from "./PreviewQueue.ts";
import {
  PREVIEW_REQUESTS,
  PREVIEW_TARGET,
  type PreviewRequests,
  type PreviewSource
} from "./protocol.ts";

// CONSTANTS
const kPreviewSize = 256;
const kRequestHoldMs = 400;
const kEditorBootWaitMs = 5_000;
const kNoScopes: ReadonlySet<string> = new Set();
const kHiddenStyle = [
  "position: fixed",
  "right: 0",
  "bottom: 0",
  "width: 1px",
  "height: 1px",
  "border: 0",
  "opacity: 0",
  "pointer-events: none"
].join("; ");

export interface PreviewFrameOptions {
  url: string;
  share: Pick<CatalogShare, "serve">;
  identity: () => LaunchIdentity | null;
  onRefused: () => void;
  editorsIdle: () => Promise<void>;
  /**
   * @default document.body
   */
  container?: HTMLElement;
  /**
   * @default location.origin
   */
  launchOrigin?: string;
}

export class PreviewFrame implements PreviewSource {
  readonly #options: PreviewFrameOptions;
  readonly #origin: string;
  readonly #listening = new AbortController();
  #frame: EditorFrame | null = null;
  #queue: PreviewQueue;
  #unsentRequests: MessagePort | null;
  #disposed = false;

  constructor(
    options: PreviewFrameOptions
  ) {
    this.#options = options;
    this.#origin = options.launchOrigin ?? location.origin;
    const requests = new MessageChannel();
    this.#queue = this.#createQueue(requests.port1);
    this.#unsentRequests = requests.port2;
  }

  async preview(
    assetId: string
  ): Promise<AssetPreview> {
    await this.#holdForEditors();
    if (this.#frame === null && !this.#disposed) {
      this.#frame = this.#createFrame();
    }

    return this.#queue.preview(assetId);
  }

  notifySessionRenewed(): void {
    this.#frame?.post({
      type: "jolly-session-renewed"
    });
  }

  dispose(): void {
    this.#disposed = true;
    this.#listening.abort();
    this.#queue.dispose();
    this.#unsentRequests?.close();
    this.#unsentRequests = null;
    this.#frame?.dispose();
    this.#frame = null;
  }

  async #holdForEditors(): Promise<void> {
    await delay(kRequestHoldMs);
    await withTimeout(
      this.#options.editorsIdle(),
      kEditorBootWaitMs,
      "An editor tab is still booting."
    ).catch(() => undefined);
  }

  #createFrame(): EditorFrame {
    const element = document.createElement("iframe");
    element.title = "Asset preview";
    element.tabIndex = -1;
    element.setAttribute("aria-hidden", "true");
    element.style.cssText = kHiddenStyle;
    element.src = this.#options.url;
    window.addEventListener("message", this.#onMessage, {
      signal: this.#listening.signal
    });
    (this.#options.container ?? document.body).append(element);

    return new EditorFrame({
      id: PREVIEW_TARGET,
      element,
      reads: kNoScopes,
      origin: this.#origin
    });
  }

  #createQueue(
    port: MessagePort
  ): PreviewQueue {
    return new PreviewQueue({
      port,
      size: () => Math.round(kPreviewSize * window.devicePixelRatio)
    });
  }

  #launch(
    frame: EditorFrame
  ): void {
    let requests = this.#unsentRequests;
    if (requests === null) {
      const channel = new MessageChannel();
      this.#queue.dispose();
      this.#queue = this.#createQueue(channel.port1);
      requests = channel.port2;
    }
    this.#unsentRequests = null;

    frame.closePorts();
    const catalog = new MessageChannel();
    frame.launch({
      type: "jolly-launch",
      target: frame.id,
      identity: this.#options.identity(),
      preferences: {},
      ports: {
        catalog: catalog.port2
      }
    }, [this.#options.share.serve(catalog.port1)]);
    const opened: PreviewRequests = {
      type: PREVIEW_REQUESTS,
      port: requests
    };
    frame.element.contentWindow?.postMessage(opened, this.#origin, [requests]);
  }

  readonly #onMessage = (
    event: MessageEvent
  ): void => {
    const frame = this.#frame;
    if (frame === null || !frame.accepts(event)) {
      return;
    }

    const message = parseFrameMessage(event.data);
    if (message?.type === "jolly-ready") {
      this.#launch(frame);
    }
    else if (message?.type === "jolly-session-refused") {
      this.#options.onRefused();
    }
  };
}
