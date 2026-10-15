// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { StorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { LanternSeen } from "./seen/LanternSeen.ts";
import { LanternSession } from "./session/LanternSession.ts";
import { UnknownTourError } from "./tour/errors/UnknownTourError.ts";
import type { Tour } from "./tour/Tour.ts";

export type LanternEvents = {
  change: () => void;
};

export interface LanternOptions {
  storage: StorageAdapter;
  present?: (session: LanternSession) => void;
  /**
   * @default document
   */
  page?: Document;
  /**
   * @default console.warn
   */
  warn?: (message: string) => void;
  /**
   * When false, `offer` never starts a tour.
   * @default true
   */
  autoStart?: boolean;
}

export interface LanternStartOptions {
  at?: string;
}

export class Lantern extends Emitter<
  LanternEvents
> implements Iterable<Tour> {
  readonly seen: LanternSeen;

  #autoStart: boolean;
  #tours = new Map<string, Tour>();
  #session: LanternSession | null = null;
  #unfollow: (() => void) | null = null;
  #present: (session: LanternSession) => void;
  #page: Document | undefined;
  #warn: ((message: string) => void) | undefined;

  constructor(
    options: LanternOptions
  ) {
    super();

    this.seen = new LanternSeen(options.storage);
    this.#autoStart = options.autoStart ?? true;
    this.#present = options.present ?? (() => undefined);
    this.#page = options.page;
    this.#warn = options.warn;
  }

  get session(): LanternSession | null {
    return this.#session;
  }

  get size(): number {
    return this.#tours.size;
  }

  register(
    tour: Tour
  ): () => void {
    this.#tours.set(tour.id, tour);
    this.emit("change");

    return () => {
      if (this.#tours.get(tour.id) !== tour) {
        return;
      }

      this.#tours.delete(tour.id);
      if (this.#session?.tour === tour) {
        this.#interrupt();
      }
      this.emit("change");
    };
  }

  tour(
    id: string
  ): Tour {
    const tour = this.#tours.get(id);
    if (tour === undefined) {
      throw new UnknownTourError(id);
    }

    return tour;
  }

  start(
    tour: Tour,
    options: LanternStartOptions = {}
  ): LanternSession {
    this.#interrupt();
    const session = new LanternSession(tour, {
      at: options.at,
      page: this.#page,
      warn: this.#warn
    });
    this.#session = session;
    this.#unfollow = session.subscribe("end", (_outcome, followUp) => {
      this.#session = null;
      this.#unfollow = null;
      this.seen.record(tour);
      this.emit("change");
      if (followUp !== null) {
        this.start(followUp);
      }
    });
    this.#present(session);

    return session;
  }

  offer(
    tour: Tour
  ): LanternSession | null {
    if (
      !this.#autoStart ||
      this.#session !== null ||
      this.#tours.get(tour.id) !== tour ||
      this.seen.has(tour)
    ) {
      return null;
    }

    return this.start(tour);
  }

  dispose(): void {
    this.#interrupt();
    this.#tours.clear();
    this.removeAllListeners();
  }

  #interrupt(): void {
    const session = this.#session;
    this.#unfollow?.();
    this.#unfollow = null;
    this.#session = null;
    session?.skip();
  }

  * [Symbol.iterator](): IterableIterator<Tour> {
    yield* this.#tours.values();
  }
}
