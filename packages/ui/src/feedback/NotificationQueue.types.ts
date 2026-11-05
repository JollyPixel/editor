// CONSTANTS
export const NOTIFICATION_TONES = [
  "success",
  "info",
  "warning",
  "error",
  "loading"
] as const;

export const NOTIFICATION_PLACEMENTS = [
  "top-start",
  "top-end",
  "bottom-start",
  "bottom-end"
] as const;

export type NotificationTone = typeof NOTIFICATION_TONES[number];
export type NotificationPlacement = typeof NOTIFICATION_PLACEMENTS[number];

export interface NotificationInit {
  tone: NotificationTone;
  title: string;
  /**
   * @default ""
   */
  message?: string;
  /**
   * Fraction done, from 0 to 1, drawn as a bar under the text. `null` draws
   * no bar.
   * @default null
   */
  progress?: number | null;
  /**
   * Shown above the title, such as the editor or asset that raised it.
   * @default ""
   */
  source?: string;
  /**
   * Milliseconds before the notification closes by itself; `null` keeps it
   * until dismissed.
   * @default the queue's duration for the tone
   */
  duration?: number | null;
}

export type NotificationPatch = Partial<NotificationInit>;

export interface NotificationEntry {
  readonly id: string;
  readonly tone: NotificationTone;
  readonly title: string;
  readonly message: string;
  readonly progress: number | null;
  readonly source: string;
}

export interface NotificationHandle {
  readonly id: string;

  update(
    patch: NotificationPatch
  ): void;
  dismiss(): void;
}

export interface Notifier {
  notify(
    init: NotificationInit
  ): NotificationHandle;
}

export type NotificationListener = (
  entries: readonly NotificationEntry[]
) => void;

export type NotificationDurations = Readonly<
  Record<NotificationTone, number | null>
>;

export interface NotificationQueueOptions {
  /**
   * Most notifications shown at once; loading ones are never evicted.
   * @default 5
   */
  max?: number;
  /**
   * @default DEFAULT_NOTIFICATION_DURATIONS
   */
  durations?: Partial<NotificationDurations>;
}
