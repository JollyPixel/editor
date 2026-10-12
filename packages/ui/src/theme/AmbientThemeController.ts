// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import {
  adoptAmbientTheme,
  resolveAmbientTheme,
  type ResolvedThemeMode
} from "./ambientTheme.ts";
import { ThemeChangeObserver } from "./ThemeChangeObserver.ts";

export interface AmbientThemeControllerOptions {
  /**
   * Receives the resolved ambient theme when it changes, instead of the
   * host's `theme` attribute.
   */
  onChange?: (
    mode: ResolvedThemeMode
  ) => void;
}

type Adoption = (
  adopted: ResolvedThemeMode | null
) => ResolvedThemeMode | null;

export class AmbientThemeController implements ReactiveController {
  #host: ReactiveControllerHost & HTMLElement;
  #adoption: Adoption;
  #adopted: ResolvedThemeMode | null = null;
  #observer = new ThemeChangeObserver(() => this.#adopt());

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    options: AmbientThemeControllerOptions = {}
  ) {
    this.#host = host;
    const { onChange } = options;
    this.#adoption = onChange === undefined
      ? (adopted) => adoptAmbientTheme(host, adopted)
      : (adopted) => notifyAmbientTheme(host, adopted, onChange);
    host.addController(this);
  }

  follow(): void {
    this.#adopt();
    this.#observer.observe(this.#host.ownerDocument, this.#host);
  }

  stop(): void {
    this.#observer.disconnect();
  }

  hostDisconnected(): void {
    this.stop();
  }

  #adopt(): void {
    this.#adopted = this.#adoption(this.#adopted);
  }
}

function notifyAmbientTheme(
  host: Element,
  notified: ResolvedThemeMode | null,
  onChange: (mode: ResolvedThemeMode) => void
): ResolvedThemeMode {
  const mode = resolveAmbientTheme(host);
  if (mode !== notified) {
    onChange(mode);
  }

  return mode;
}
