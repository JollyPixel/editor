// Import Internal Dependencies
import type {
  NotificationDurations,
  NotificationEntry,
  NotificationHandle,
  NotificationInit,
  NotificationListener,
  NotificationPatch,
  NotificationQueueOptions,
  Notifier
} from "./NotificationQueue.types.ts";

// CONSTANTS
const kDefaultMax = 5;
export const DEFAULT_NOTIFICATION_DURATIONS: NotificationDurations = {
  success: 4_000,
  info: 5_000,
  warning: 8_000,
  error: null,
  loading: null
};

interface Slot {
  entry: NotificationEntry;
  duration: number | null | undefined;
  remaining: number | null;
  deadline: number;
  timer: ReturnType<typeof setTimeout> | undefined;
}

export class NotificationQueue implements Notifier {
  #max: number;
  #durations: NotificationDurations;
  #slots: Slot[] = [];
  #entries: readonly NotificationEntry[] = [];
  #listeners = new Set<NotificationListener>();
  #paused = false;
  #sequence = 0;

  constructor(
    options: NotificationQueueOptions = {}
  ) {
    this.#max = Math.max(1, options.max ?? kDefaultMax);
    this.#durations = {
      ...DEFAULT_NOTIFICATION_DURATIONS,
      ...options.durations
    };
  }

  get entries(): readonly NotificationEntry[] {
    return this.#entries;
  }

  notify(
    init: NotificationInit
  ): NotificationHandle {
    this.#sequence += 1;
    const id = `notification-${this.#sequence}`;
    const slot: Slot = {
      entry: {
        id,
        tone: init.tone,
        title: init.title,
        message: init.message ?? "",
        progress: clampProgress(init.progress ?? null),
        source: init.source ?? ""
      },
      duration: init.duration,
      remaining: null,
      deadline: 0,
      timer: undefined
    };
    this.#slots.unshift(slot);
    this.#arm(slot);
    this.#evict();
    this.#emit();

    return {
      id,
      update: (patch) => this.#update(id, patch),
      dismiss: () => this.dismiss(id)
    };
  }

  dismiss(
    id: string
  ): void {
    const slot = this.#slots.find((candidate) => candidate.entry.id === id);
    if (slot === undefined) {
      return;
    }

    this.#remove(slot);
    this.#emit();
  }

  clear(): void {
    if (this.#slots.length === 0) {
      return;
    }

    for (const slot of this.#slots) {
      clearTimeout(slot.timer);
    }
    this.#slots = [];
    this.#emit();
  }

  pause(): void {
    if (this.#paused) {
      return;
    }

    this.#paused = true;
    const now = Date.now();
    for (const slot of this.#slots) {
      if (slot.timer !== undefined) {
        clearTimeout(slot.timer);
        slot.timer = undefined;
        slot.remaining = Math.max(0, slot.deadline - now);
      }
    }
  }

  resume(): void {
    if (!this.#paused) {
      return;
    }

    this.#paused = false;
    for (const slot of this.#slots) {
      this.#start(slot);
    }
  }

  subscribe(
    listener: NotificationListener
  ): () => void {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  }

  dispose(): void {
    for (const slot of this.#slots) {
      clearTimeout(slot.timer);
    }
    this.#slots = [];
    this.#entries = [];
    this.#listeners.clear();
  }

  #update(
    id: string,
    patch: NotificationPatch
  ): void {
    const slot = this.#slots.find((candidate) => candidate.entry.id === id);
    if (slot === undefined) {
      return;
    }

    const { entry } = slot;
    const tone = patch.tone ?? entry.tone;
    slot.entry = {
      id,
      tone,
      title: patch.title ?? entry.title,
      message: patch.message ?? entry.message,
      progress: patch.progress === undefined ?
        entry.progress :
        clampProgress(patch.progress),
      source: patch.source ?? entry.source
    };
    if (patch.duration !== undefined) {
      slot.duration = patch.duration;
    }
    if (tone !== entry.tone || patch.duration !== undefined) {
      this.#arm(slot);
      this.#evict();
    }
    this.#emit();
  }

  #arm(
    slot: Slot
  ): void {
    clearTimeout(slot.timer);
    slot.timer = undefined;
    slot.remaining = slot.duration === undefined ?
      this.#durations[slot.entry.tone] :
      slot.duration;
    if (!this.#paused) {
      this.#start(slot);
    }
  }

  #start(
    slot: Slot
  ): void {
    const remaining = slot.remaining;
    if (remaining === null) {
      return;
    }

    slot.remaining = null;
    slot.deadline = Date.now() + remaining;
    slot.timer = setTimeout(
      () => this.dismiss(slot.entry.id),
      remaining
    );
  }

  #evict(): void {
    while (this.#slots.length > this.#max) {
      const oldest = this.#slots.findLast(
        (slot) => slot.entry.tone !== "loading"
      );
      if (oldest === undefined) {
        return;
      }
      this.#remove(oldest);
    }
  }

  #remove(
    slot: Slot
  ): void {
    clearTimeout(slot.timer);
    this.#slots = this.#slots.filter((candidate) => candidate !== slot);
  }

  #emit(): void {
    this.#entries = this.#slots.map((slot) => slot.entry);
    for (const listener of [...this.#listeners]) {
      listener(this.#entries);
    }
  }
}

function clampProgress(
  progress: number | null
): number | null {
  if (progress === null || !Number.isFinite(progress)) {
    return null;
  }

  return Math.min(1, Math.max(0, progress));
}
