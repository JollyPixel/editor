export class PeerMarkIndex {
  #peerToObject = new Map<string, string>();
  #objectToPeers = new Map<string, string[]>();

  markedObject(
    peerId: string
  ): string | null {
    return this.#peerToObject.get(peerId) ?? null;
  }

  peers(
    objectId: string
  ): readonly string[] {
    return (this.#objectToPeers.get(objectId) ?? []).slice();
  }

  objectIds(): IterableIterator<string> {
    return this.#objectToPeers.keys();
  }

  mark(
    peerId: string,
    objectId: string | null
  ): void {
    const previousObjectId = this.#peerToObject.get(peerId);
    if (previousObjectId !== undefined) {
      this.#unmark(previousObjectId, peerId);
    }

    if (objectId === null) {
      this.#peerToObject.delete(peerId);

      return;
    }

    this.#peerToObject.set(peerId, objectId);
    const peers = this.#objectToPeers.get(objectId);
    if (peers) {
      peers.push(peerId);
    }
    else {
      this.#objectToPeers.set(objectId, [peerId]);
    }
  }

  clear(): void {
    this.#peerToObject.clear();
    this.#objectToPeers.clear();
  }

  #unmark(
    objectId: string,
    peerId: string
  ): void {
    const peers = this.#objectToPeers.get(objectId);
    if (!peers) {
      return;
    }

    const index = peers.indexOf(peerId);
    if (index !== -1) {
      peers.splice(index, 1);
    }
    if (peers.length === 0) {
      this.#objectToPeers.delete(objectId);
    }
  }
}
