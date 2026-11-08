// Import Third-party Dependencies
import type { AssetPreview } from "@jolly-pixel/asset-server/client";
import {
  parseFrameMessage,
  type CatalogShare,
  type LaunchIdentity,
  type LaunchMessage,
  type ShellMessage
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { PreviewSource } from "../shell/assets/AssetPreviewCache.ts";
import { PreviewQueue } from "./PreviewQueue.ts";
import {
  PREVIEW_REQUESTS,
  PREVIEW_TARGET,
  type PreviewRequests
} from "./protocol.ts";

// CONSTANTS
const kPreviewSize = 256;
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
  #element: HTMLIFrameElement | null = null;
  #queue: PreviewQueue;
  #unsentRequests: MessagePort | null;
  #stopCatalog: (() => void) | null = null;
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

  preview(
    assetId: string
  ): Promise<AssetPreview> {
    if (this.#element === null && !this.#disposed) {
      this.#element = this.#createElement();
    }

    return this.#queue.preview(assetId);
  }

  notifySessionRenewed(): void {
    this.#post({
      type: "jolly-session-renewed"
    });
  }

  dispose(): void {
    this.#disposed = true;
    this.#listening.abort();
    this.#queue.dispose();
    this.#unsentRequests?.close();
    this.#unsentRequests = null;
    this.#stopCatalog?.();
    this.#stopCatalog = null;
    this.#element?.remove();
    this.#element = null;
  }

  #createElement(): HTMLIFrameElement {
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

    return element;
  }

  #createQueue(
    port: MessagePort
  ): PreviewQueue {
    return new PreviewQueue({
      port,
      size: () => Math.round(kPreviewSize * window.devicePixelRatio)
    });
  }

  #launch(): void {
    let requests = this.#unsentRequests;
    if (requests === null) {
      const channel = new MessageChannel();
      this.#queue.dispose();
      this.#queue = this.#createQueue(channel.port1);
      requests = channel.port2;
    }
    this.#unsentRequests = null;

    this.#stopCatalog?.();
    const catalog = new MessageChannel();
    this.#stopCatalog = this.#options.share.serve(catalog.port1);
    const launch: LaunchMessage = {
      type: "jolly-launch",
      target: PREVIEW_TARGET,
      identity: this.#options.identity(),
      preferences: {},
      ports: {
        catalog: catalog.port2
      }
    };
    const opened: PreviewRequests = {
      type: PREVIEW_REQUESTS,
      port: requests
    };
    this.#post(launch, [catalog.port2]);
    this.#post(opened, [requests]);
  }

  #post(
    message: LaunchMessage | PreviewRequests | ShellMessage,
    transfer: Transferable[] = []
  ): void {
    this.#element?.contentWindow?.postMessage(message, this.#origin, transfer);
  }

  readonly #onMessage = (
    event: MessageEvent
  ): void => {
    if (
      event.source !== this.#element?.contentWindow ||
      event.origin !== this.#origin
    ) {
      return;
    }

    const message = parseFrameMessage(event.data);
    if (message?.type === "jolly-ready") {
      this.#launch();
    }
    else if (message?.type === "jolly-session-refused") {
      this.#options.onRefused();
    }
  };
}
