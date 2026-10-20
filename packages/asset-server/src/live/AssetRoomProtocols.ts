// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetCommands } from "../model/kinds/AssetKindHandler.ts";
import type {
  AssetCommandHeader,
  AssetRelaySchemas
} from "../model/kinds/AssetLiveProtocol.ts";
import {
  assetRoomInboundProtocol,
  assetRoomOutboundProtocol
} from "./AssetRoomExtension.schema.ts";

export interface AssetRoomMessageProtocols extends network.MessageProtocols {
  readonly inbound: network.MessageProtocol;
  readonly outbound: network.MessageProtocol;
}

interface CompiledProtocols {
  readonly inbound: network.MessageProtocol;
  readonly command: network.MessageProtocol;
  readonly relayOutbound: readonly network.Schema[];
  readonly relayTags: ReadonlySet<string>;
  readonly bySnapshot: Map<network.Schema, AssetRoomMessageProtocols>;
}

// CONSTANTS
const kByCommands = new WeakMap<object, CompiledProtocols>();

export class AssetRoomProtocols<
  TCommand extends AssetCommandHeader = AssetCommandHeader,
  TRelay extends object = never
> {
  static compile<
    TCommand extends AssetCommandHeader,
    TRelay extends object
  >(
    commands: AssetCommands<unknown, TCommand, TRelay>
  ): AssetRoomProtocols<TCommand, TRelay> {
    return new AssetRoomProtocols(compiledProtocols(commands));
  }

  static validate<
    TCommand extends AssetCommandHeader,
    TRelay extends object
  >(
    commands: AssetCommands<unknown, TCommand, TRelay>
  ): void {
    compiledProtocols(commands);
  }

  readonly inbound: network.MessageProtocol;

  #compiled: CompiledProtocols;

  private constructor(
    compiled: CompiledProtocols
  ) {
    this.inbound = compiled.inbound;
    this.#compiled = compiled;
  }

  withSnapshot(
    snapshot: network.Schema
  ): AssetRoomMessageProtocols {
    const { bySnapshot } = this.#compiled;
    let protocols = bySnapshot.get(snapshot);
    if (protocols === undefined) {
      protocols = {
        inbound: this.inbound,
        outbound: assetRoomOutboundProtocol(
          this.#compiled.command,
          snapshot,
          this.#compiled.relayOutbound
        )
      };
      bySnapshot.set(snapshot, protocols);
    }

    return protocols;
  }

  routesToRelay(
    message: TCommand | TRelay
  ): message is TRelay {
    const { relayTags } = this.#compiled;
    if (relayTags.size === 0) {
      return false;
    }

    const tag: unknown = Reflect.get(message, this.inbound.discriminator);

    return typeof tag === "string" && relayTags.has(tag);
  }
}

function compiledProtocols<
  TCommand extends AssetCommandHeader,
  TRelay extends object
>(
  commands: AssetCommands<unknown, TCommand, TRelay>
): CompiledProtocols {
  let compiled = kByCommands.get(commands);
  if (compiled === undefined) {
    compiled = compileProtocols(commands.protocol, commands.relay);
    kByCommands.set(commands, compiled);
  }

  return compiled;
}

function compileProtocols(
  command: network.MessageProtocol,
  relay?: AssetRelaySchemas
): CompiledProtocols {
  const inbound = assetRoomInboundProtocol(command, relay?.inbound ?? []);
  const commandTags = new Set(command.variants.map(({ tag }) => tag));
  const relayTags = new Set<string>();
  for (const { tag } of inbound.variants.slice(command.variants.length)) {
    if (tag === null || commandTags.has(tag) || relayTags.has(tag)) {
      throw new TypeError(
        `every relay message needs its own literal "${command.discriminator}", got ${tag}`
      );
    }
    relayTags.add(tag);
  }

  return {
    inbound,
    command,
    relayOutbound: relay?.outbound ?? [],
    relayTags,
    bySnapshot: new Map()
  };
}
