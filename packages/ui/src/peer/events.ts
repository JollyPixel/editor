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
  const event = new CustomEvent<PeerEventMap[KName]>(name, {
    detail,
    bubbles: true,
    composed: true
  });
  target.dispatchEvent(event);
}

declare global {
  interface HTMLElementEventMap {
    "jolly-peer-select": CustomEvent<JollyPeerSelectDetail>;
  }
}
