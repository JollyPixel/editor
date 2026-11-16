// Import Internal Dependencies
import type { EnvironmentDocument } from "./EnvironmentDocument.ts";
import type { EnvironmentFile } from "../network/types.ts";

export interface EnvironmentLease {
  readonly document: EnvironmentDocument;
  release(): void;
}

export type EnvironmentOpener = (assetId: string) => EnvironmentLease | null;

export type EnvironmentListener = (
  file: Readonly<EnvironmentFile> | null
) => void;

export class EnvironmentLink {
  #open: EnvironmentOpener;
  #listener: EnvironmentListener;
  #assetId: string | null | undefined;
  #release: (() => void) | null = null;

  constructor(
    open: EnvironmentOpener,
    listener: EnvironmentListener
  ) {
    this.#open = open;
    this.#listener = listener;
  }

  get assetId(): string | null {
    return this.#assetId ?? null;
  }

  link(
    assetId: string | null
  ): void {
    if (assetId === this.#assetId) {
      return;
    }

    this.#unlink();
    const lease = assetId === null ? null : this.#open(assetId);
    this.#assetId = lease === null ? null : assetId;
    if (lease === null) {
      this.#listener(null);

      return;
    }

    const { document } = lease;
    const show = (): void => this.#listener(document.file);
    const unsubscribe = [
      document.subscribe("change", show),
      document.subscribe("reset", show)
    ];
    this.#release = () => {
      for (const stop of unsubscribe) {
        stop();
      }
      lease.release();
    };
    show();
  }

  dispose(): void {
    this.#unlink();
  }

  #unlink(): void {
    this.#release?.();
    this.#release = null;
  }
}
