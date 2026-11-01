// Import Third-party Dependencies
import type { BindingPreference, PreferenceScope } from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { BoundChord } from "./BoundChord.ts";
import { HeldKey } from "./HeldKey.ts";

export interface KeyRecording {
  readonly scope: PreferenceScope;
  readonly action: string;
  readonly kind: BindingPreference["type"];
}

export interface KeyRecorderOptions {
  /**
   * Where keydown is captured.
   * @default window
   */
  target?: EventTarget;
  onChange: () => void;
  onRecorded: (recording: KeyRecording, bindings: readonly string[]) => void;
}

export class KeyRecorder {
  #target: EventTarget;
  #onChange: () => void;
  #onRecorded: KeyRecorderOptions["onRecorded"];
  #recording: KeyRecording | null = null;

  constructor(
    options: KeyRecorderOptions
  ) {
    this.#target = options.target ?? window;
    this.#onChange = options.onChange;
    this.#onRecorded = options.onRecorded;
  }

  get recording(): KeyRecording | null {
    return this.#recording;
  }

  start(
    recording: KeyRecording
  ): void {
    this.#release();
    this.#recording = recording;
    this.#target.addEventListener("keydown", this.#onKeyDown, { capture: true });
    this.#onChange();
  }

  stop(): void {
    if (this.#recording === null) {
      return;
    }

    this.#release();
    this.#recording = null;
    this.#onChange();
  }

  #release(): void {
    this.#target.removeEventListener("keydown", this.#onKeyDown, { capture: true });
  }

  readonly #onKeyDown = (
    event: Event
  ): void => {
    const recording = this.#recording;
    if (recording === null || !(event instanceof KeyboardEvent)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      this.stop();

      return;
    }

    const bindings = captured(recording.kind, event);
    if (bindings !== null) {
      this.stop();
      this.#onRecorded(recording, bindings);
    }
  };
}

function captured(
  kind: BindingPreference["type"],
  event: KeyboardEvent
): readonly string[] | null {
  if (kind === "key") {
    return HeldKey.capture(event)?.codes ?? null;
  }

  const chord = BoundChord.capture(event);

  return chord === null ? null : [chord.value];
}
