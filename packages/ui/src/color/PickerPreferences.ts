// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import {
  COLOR_PICKER_DEFAULTS,
  type ColorPickerPreferences,
  type ColorPickerPreferenceSource
} from "./preferences.ts";

export type PreferenceHost = Pick<ReactiveControllerHost, "requestUpdate">;

export class MemoryPickerPreferences implements ColorPickerPreferenceSource {
  #values: Readonly<ColorPickerPreferences> = COLOR_PICKER_DEFAULTS;
  readonly #listeners = new Set<() => void>();

  values(): Readonly<ColorPickerPreferences> {
    return this.#values;
  }

  update(
    patch: Partial<ColorPickerPreferences>
  ): void {
    this.#values = {
      ...this.#values,
      ...patch
    };
    for (const listener of this.#listeners) {
      listener();
    }
  }

  watch(
    listener: () => void
  ): () => void {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  }
}

export class PickerPreferences {
  readonly #fallback = new MemoryPickerPreferences();
  readonly #hosts = new Set<PreferenceHost>();
  #source: ColorPickerPreferenceSource = this.#fallback;
  #unwatch = this.#fallback.watch(() => this.#refresh());

  get values(): Readonly<ColorPickerPreferences> {
    return this.#source.values();
  }

  update(
    patch: Partial<ColorPickerPreferences>
  ): void {
    this.#source.update(patch);
  }

  follow(
    source: ColorPickerPreferenceSource
  ): () => void {
    this.#use(source);

    return () => {
      if (this.#source === source) {
        this.#use(this.#fallback);
      }
    };
  }

  attach(
    host: PreferenceHost
  ): void {
    this.#hosts.add(host);
  }

  detach(
    host: PreferenceHost
  ): void {
    this.#hosts.delete(host);
  }

  #use(
    source: ColorPickerPreferenceSource
  ): void {
    this.#unwatch();
    this.#source = source;
    this.#unwatch = source.watch(() => this.#refresh());
    this.#refresh();
  }

  #refresh(): void {
    for (const host of this.#hosts) {
      host.requestUpdate();
    }
  }
}
