// Import Internal Dependencies
import {
  PresenceElement,
  type PresencePeer
} from "../peer/Presence.ts";

export interface PresenceOptions {
  /**
   * Maximum number of named peers to show.
   * @default Infinity
   */
  max?: number;
}

export class Presence {
  readonly element: HTMLElementTagNameMap["jolly-presence"];

  constructor(
    options: PresenceOptions = {}
  ) {
    this.element = new PresenceElement();
    this.element.max = options.max ?? Infinity;
  }

  get max(): number {
    return this.element.max;
  }

  set max(
    value: number
  ) {
    this.element.max = value;
  }

  update(
    peers: Iterable<PresencePeer>
  ): void {
    this.element.peers = peers;
  }

  get hidden(): boolean {
    return Boolean(this.element.hidden);
  }

  set hidden(
    value: boolean
  ) {
    this.element.hidden = value;
  }

  get disabled(): boolean {
    return this.element.hasAttribute("disabled");
  }

  set disabled(
    value: boolean
  ) {
    this.element.toggleAttribute("disabled", value);
  }

  dispose(): void {
    this.element.remove();
  }
}
