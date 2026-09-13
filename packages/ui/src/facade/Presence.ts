// Import Internal Dependencies
import {
  PresenceElement,
  type PresencePeer
} from "../peer/Presence.ts";
import type { JollyPeerSelectDetail } from "../peer/events.ts";
import { FacadeItem } from "./FacadeItem.ts";

export interface PresenceOptions {
  /**
   * Maximum number of named peers to show.
   * @default Infinity
   */
  max?: number;
  /**
   * Renders remote peers as buttons raising a selection intent.
   * @default false
   */
  selectable?: boolean;
}

export class Presence
  extends FacadeItem<HTMLElementTagNameMap["jolly-presence"]> {
  readonly element: HTMLElementTagNameMap["jolly-presence"];

  constructor(
    options: PresenceOptions = {}
  ) {
    super();
    this.element = new PresenceElement();
    this.element.max = options.max ?? Infinity;
    this.element.selectable = options.selectable ?? false;
  }

  get max(): number {
    return this.element.max;
  }

  set max(
    value: number
  ) {
    this.element.max = value;
  }

  get selectable(): boolean {
    return this.element.selectable;
  }

  set selectable(
    value: boolean
  ) {
    this.element.selectable = value;
  }

  onSelect(
    handler: (clientId: string) => void
  ): () => void {
    function listener(
      event: CustomEvent<JollyPeerSelectDetail>
    ): void {
      handler(event.detail.clientId);
    }

    this.element.addEventListener(
      "jolly-peer-select",
      listener
    );

    return () => this.element.removeEventListener(
      "jolly-peer-select",
      listener
    );
  }

  update(
    peers: Iterable<PresencePeer>
  ): void {
    this.element.peers = peers;
  }
}
