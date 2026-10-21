// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { StorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { LanternSeen } from "./LanternSeen.ts";
import { TourRun } from "./tour/TourRun.ts";
import { UnknownTourError } from "./tour/errors/UnknownTourError.ts";
import { TourKeys } from "./tour/TourKeys.ts";
import type { Tour } from "./tour/Tour.ts";

export type LanternEvents = {
  change: () => void;
};

export interface LanternOptions {
  storage: StorageAdapter;
  present?: (run: TourRun) => void;
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
  readonly keys = new TourKeys();

  #autoStart: boolean;
  #tours = new Map<string, Tour>();
  #run: TourRun | null = null;
  #present: (run: TourRun) => void;
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

  get current(): TourRun | null {
    return this.#run;
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
      if (this.#run?.tour === tour) {
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
  ): TourRun {
    this.#interrupt();
    const run = new TourRun(tour, {
      at: options.at,
      page: this.#page,
      warn: this.#warn,
      keys: this.keys
    });
    this.#run = run;
    run.on("end", (outcome, followUp) => {
      if (this.#run === run) {
        this.#run = null;
      }
      if (outcome === "interrupted") {
        return;
      }

      this.seen.record(tour);
      this.emit("change");
      if (followUp !== null) {
        this.start(followUp);
      }
    });
    this.#present(run);

    return run;
  }

  offer(
    tour: Tour
  ): TourRun | null {
    if (
      !this.#autoStart ||
      this.#run !== null ||
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
    const run = this.#run;
    this.#run = null;
    run?.interrupt();
  }

  * [Symbol.iterator](): IterableIterator<Tour> {
    yield* this.#tours.values();
  }
}
