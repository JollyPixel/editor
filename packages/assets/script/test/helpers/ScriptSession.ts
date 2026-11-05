// Import Third-party Dependencies
import {
  LiveAssetRoom,
  mockAssetRoom,
  type MockAssetRoom
} from "@jolly-pixel/asset-server/testing";

// Import Internal Dependencies
import {
  scriptAssetKind,
  type ScriptAssetKindOptions
} from "#src/asset/scriptAssetKind.ts";
import { SCRIPT_KIND } from "#src/asset/script.ts";
import type { ScriptText } from "#src/asset/ScriptText.ts";
import type { ScriptOutlineRequest } from "#src/network/ScriptCommand.schema.ts";
import {
  textDocumentKind,
  type SyncedScript
} from "#src/network/textDocumentKind.ts";
import type {
  ScriptNetworkCommand,
  ScriptSnapshot
} from "#src/network/types.ts";

export interface ScriptPeer {
  readonly clientId: string;
  readonly room: MockAssetRoom<ScriptNetworkCommand, ScriptSnapshot>;
  readonly script: SyncedScript;
}

export class ScriptSession {
  readonly server: LiveAssetRoom<ScriptText, ScriptNetworkCommand, ScriptOutlineRequest>;
  readonly peers: ScriptPeer[] = [];

  constructor(
    text: string,
    options: ScriptAssetKindOptions = {}
  ) {
    this.server = new LiveAssetRoom(scriptAssetKind(options));
    this.server.state.replace(text);
  }

  async join(
    clientId: string
  ): Promise<ScriptPeer> {
    const room = mockAssetRoom<ScriptNetworkCommand, ScriptSnapshot>(clientId);
    const peer: ScriptPeer = {
      clientId,
      room,
      script: textDocumentKind(SCRIPT_KIND).syncDocument(room)
    };
    this.peers.push(peer);
    await this.server.connect(clientId);
    this.deliver(peer);

    return peer;
  }

  deliver(
    peer: ScriptPeer
  ): number {
    const messages = this.server.take<ScriptSnapshot>(peer.clientId);
    for (const message of messages) {
      peer.room.deliver(message);
    }

    return messages.length;
  }

  async resnapshot(
    peer: ScriptPeer
  ): Promise<void> {
    this.server.take(peer.clientId);
    await this.server.resync(peer.clientId);
    this.deliver(peer);
  }

  async upload(
    peer: ScriptPeer
  ): Promise<number> {
    const sent = peer.room.sent.splice(0);
    for (const message of sent) {
      await this.server.receive(peer.clientId, message);
    }

    return sent.length;
  }

  async settle(): Promise<void> {
    let moved = true;
    while (moved) {
      moved = false;
      for (const peer of this.peers) {
        if (await this.upload(peer) > 0 || this.deliver(peer) > 0) {
          moved = true;
        }
      }
    }
  }
}
