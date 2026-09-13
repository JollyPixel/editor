// Import Internal Dependencies
import { emitComposedEvent } from "../events.ts";

export interface JollyPeerSelectDetail {
  clientId: string;
}

export interface PeerEventMap {
  "jolly-peer-select": JollyPeerSelectDetail;
}

export function emitPeerEvent<KName extends keyof PeerEventMap>(
  target: EventTarget,
  name: KName,
  detail: PeerEventMap[KName]
): void {
  emitComposedEvent(target, name, detail);
}

declare global {
  interface HTMLElementEventMap {
    "jolly-peer-select": CustomEvent<JollyPeerSelectDetail>;
  }
}
