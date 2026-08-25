// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import { requestPresenceSource } from "./presenceContext.ts";
import { resolveLock } from "./resolveLock.ts";
import type { PresenceSource } from "./PresenceSource.ts";
import type { CollaboratorPresence } from "./types.ts";

/**
 * Field state synchronized while a presence source is attached.
 */
export interface LockHost extends ReactiveControllerHost, HTMLElement {
  path: string | null;
  lockedBy: CollaboratorPresence | null;
  peers: CollaboratorPresence[];
}

/**
 * Claims and releases a `JollyField` path as focus changes.
 */
export class LockController implements ReactiveController {
  #host: LockHost;
  #source: PresenceSource | null = null;
  #unsubscribe: (() => void) | null = null;
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

  /** Identity of the local peer, empty when no source answered. */
  get selfId(): string {
    return this.#source?.clientId ?? "";
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

    const { source, subscribe } = requestPresenceSource(this.#host);
    /**
     * Fields may connect before their pane receives a source.
     */
    this.#unsubscribe = subscribe?.((next) => this.#attach(next)) ?? null;
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
    /**
     * A focused field must release its claim when disconnected.
     */
    this.#release();
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#attach(null);
  }

  /**
   * Moves the claim when a consumer re-points a focused field.
   */
  pathChanged(): void {
    if (this.#claimed !== null && this.#claimed !== this.#host.path) {
      this.#release();
      if (this.#host.matches(":focus-within")) {
        this.#claim();
      }
    }
    this.#refresh();
  }

  #attach(
    source: PresenceSource | null
  ): void {
    if (source === this.#source) {
      return;
    }

    this.#release();
    this.#source?.off("change", this.#onChange);
    this.#source = source;
    this.#source?.on("change", this.#onChange);
    if (this.#source !== null && this.#host.matches(":focus-within")) {
      this.#claim();
    }
    this.#refresh();
  }

  #claim(): void {
    const { path } = this.#host;
    if (
      this.#source === null ||
      path === null ||
      this.#claimed === path
    ) {
      return;
    }

    this.#release();
    this.#source.claim(path);
    this.#claimed = path;
    this.#refresh();
  }

  #scheduleRelease(): void {
    /**
     * Wait for focus to settle because `focusout` also fires within the field.
     */
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

    const { lockedBy, peers } = resolveLock(
      this.#source.peers.values(),
      this.#host.path,
      this.#source.clientId
    );
    this.#host.lockedBy = lockedBy;
    this.#host.peers = peers;
  }
}
