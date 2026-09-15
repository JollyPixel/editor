// Import Third-party Dependencies
import {
  MessageParser,
  type MessageProtocol
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetCommands } from "./AssetKindHandler.ts";

// CONSTANTS
const kParsers = new WeakMap<MessageProtocol, MessageParser>();

export function parseAssetCommand<TCommand>(
  commands: AssetCommands<unknown, TCommand>,
  payload: unknown
): TCommand | null {
  const { protocol } = commands;

  let parser = kParsers.get(protocol);
  if (parser === undefined) {
    parser = new MessageParser(protocol);
    kParsers.set(protocol, parser);
  }

  const parsed = (parser as MessageParser<TCommand>).parse(payload);

  return parsed.ok ? parsed.val.message : null;
}
