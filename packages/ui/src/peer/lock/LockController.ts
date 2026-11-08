// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import { requestFieldLocks } from "./fieldLockContext.ts";
import type { FieldLockSource } from "./FieldLockSource.ts";
import {
  samePeers,
  type PresencePeer
} from "../PresencePeer.ts";

// CONSTANTS
const kNoEditors: readonly PresencePeer[] = Object.freeze([]);

export interface LockHost extends ReactiveControllerHost, HTMLElement {
  path: string | null;
  editors: readonly PresencePeer[];
}

export class LockController implements ReactiveController {
  #host: LockHost;
  #source: FieldLockSource | null = null;
  #unsubscribeSource: (() => void) | null = null;
  #unsubscribeProvider: (() => void) | null = null;
  #claimed: string | null = null;
  #onChange = () => this.#refresh();
  #onFocusIn = () => this.#claim();
  #onFocusOut = () => this.#scheduleRelease();

  constructor(
    host: LockHost
  ) {
    this.#host = host;
    host.addController(this);
  }

  hostConnected(): void {
    this.#host.addEventListener(
      "focusin",
      this.#onFocusIn
    );
    this.#host.addEventListener(
      "focusout",
      this.#onFocusOut
    );

    const { source, subscribe } = requestFieldLocks(this.#host);
    this.#unsubscribeProvider = subscribe?.(
      (next) => this.#attach(next)
    ) ?? null;
    this.#attach(source);
  }

  hostDisconnected(): void {
    this.#host.removeEventListener(
      "focusin",
      this.#onFocusIn
    );
    this.#host.removeEventListener(
      "focusout",
      this.#onFocusOut
    );
    this.#release();
    this.#unsubscribeProvider?.();
    this.#unsubscribeProvider = null;
    this.#attach(null);
  }

  pathChanged(): void {
    if (
      this.#claimed !== null &&
      this.#claimed !== this.#host.path
    ) {
      if (this.#host.matches(":focus-within")) {
        this.#claim();
      }
      else {
        this.#release();
      }
    }
    this.#refresh();
  }

  #attach(
    source: FieldLockSource | null
  ): void {
    if (source === this.#source) {
      return;
    }

    this.#release();
    this.#unsubscribeSource?.();
    this.#source = source;
    this.#unsubscribeSource = source?.subscribe(this.#onChange) ?? null;
    if (
      this.#source !== null &&
      this.#host.matches(":focus-within")
    ) {
      this.#claim();
    }
    this.#refresh();
  }

  #claim(): void {
    const { path } = this.#host;
    if (
      this.#source === null ||
      this.#claimed === path
    ) {
      return;
    }
    if (path === null) {
      this.#release();

      return;
    }

    this.#source.claim(path);
    this.#claimed = path;
    this.#refresh();
  }

  #scheduleRelease(): void {
    queueMicrotask(() => {
      if (
        this.#host.isConnected &&
        this.#host.matches(":focus-within")
      ) {
        return;
      }

      this.#release();
      this.#refresh();
    });
  }

  #release(): void {
    if (
      this.#source === null ||
      this.#claimed === null
    ) {
      return;
    }

    this.#source.release(this.#claimed);
    this.#claimed = null;
  }

  #refresh(): void {
    if (this.#source === null) {
      return;
    }

    const { path } = this.#host;
    const editors = path === null
      ? kNoEditors
      : this.#source.editors(path);
    if (!samePeers(this.#host.editors, editors)) {
      this.#host.editors = editors;
    }
  }
}
