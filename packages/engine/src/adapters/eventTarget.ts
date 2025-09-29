export type EventTargetListener = (...args: any[]) => void | boolean;

export interface EventTargetAdapter {
  addEventListener(
    type: string,
    listener: EventTargetListener,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventTargetListener,
    options?: boolean | AddEventListenerOptions
  ): void;
}
