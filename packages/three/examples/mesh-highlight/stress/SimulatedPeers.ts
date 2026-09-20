// Import Internal Dependencies
import type { PeerSelectionRegistry } from "../../../src/index.ts";

export class SimulatedPeers {
  #registry: PeerSelectionRegistry;
  #names: string[] = [];

  constructor(
    registry: PeerSelectionRegistry
  ) {
    this.#registry = registry;
  }

  clear(): void {
    for (const name of this.#names) {
      this.#registry.select(name, null);
    }
    this.#names = [];
  }

  assign(
    instanceIds: number[]
  ): void {
    this.clear();
    instanceIds.forEach((instanceId, index) => {
      const name = `Peer ${index + 1}`;
      this.#names.push(name);
      this.#registry.select(name, String(instanceId));
    });
  }
}
