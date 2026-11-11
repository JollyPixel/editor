// Import Third-party Dependencies
import {
  InvalidAssetFileError,
  type AssetBuild,
  type AssetKindHandler,
  type AssetRelay,
  type AssetRelaySchemas,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  TEXT_COMMAND,
  TEXT_CONTENT_TYPES,
  TEXT_KIND
} from "./text.ts";
import { ScriptText } from "../model/ScriptText.ts";
import { TextEdit } from "../model/TextEdit.ts";
import { scriptCommandProtocol } from "../network/ScriptCommand.schema.ts";
import { ScriptLive } from "../network/ScriptLive.ts";
import type { ScriptNetworkCommand } from "../network/types.ts";

// CONSTANTS
const kDecoder = new TextDecoder("utf-8", { fatal: true });
const kEncoder = new TextEncoder();
const kBuildVersion = "2";

export interface TextKindRelay<TRelay extends object> {
  schemas: AssetRelaySchemas<TRelay>;
  open(state: ScriptText): AssetRelay<TRelay>;
}

export interface TextKindOptions<TRelay extends object> {
  kind: string;
  eventType: string;
  extensions: Readonly<Record<string, string>>;
  template: string;
  snapshot?: SnapshotPolicy;
  relay?: TextKindRelay<TRelay>;
  compile?: (source: string) => Promise<string>;
}

export interface TextAssetKindOptions {
  snapshot?: SnapshotPolicy;
}

export function textAssetKind(
  options: TextAssetKindOptions = {}
): AssetKindHandler<ScriptText, ScriptNetworkCommand> {
  return textKindHandler({
    kind: TEXT_KIND,
    eventType: TEXT_COMMAND,
    extensions: TEXT_CONTENT_TYPES,
    template: "",
    snapshot: options.snapshot
  });
}

export function textKindHandler<TRelay extends object = never>(
  options: TextKindOptions<TRelay>
): AssetKindHandler<ScriptText, ScriptNetworkCommand, TRelay> {
  const {
    kind,
    eventType,
    template,
    relay,
    compile
  } = options;

  return {
    kind,
    extensions: options.extensions,
    snapshot: options.snapshot,
    build: compile === undefined ? undefined : compiledBuild(compile),

    create(): ScriptText {
      return new ScriptText(template);
    },

    load(
      state: ScriptText,
      content: Uint8Array
    ): void {
      let text: string;
      try {
        text = kDecoder.decode(content);
      }
      catch (cause) {
        throw new InvalidAssetFileError(
          kind,
          "content is not UTF-8 text",
          { cause }
        );
      }

      state.replace(text.replaceAll("\r\n", "\n"));
    },

    clear(
      state: ScriptText
    ): void {
      state.replace("");
    },

    serialize(
      state: ScriptText
    ): Promise<Uint8Array> {
      return Promise.resolve(kEncoder.encode(state.text));
    },

    commands: {
      eventType,
      protocol: scriptCommandProtocol,
      relay: relay?.schemas,

      apply(state, command) {
        try {
          state.edit(new TextEdit(command.changes));
        }
        catch (error) {
          console.error("Text edit skipped", error);
        }
      },

      live(binding) {
        return new ScriptLive(binding, {
          relay: relay?.open(binding.state)
        });
      }
    }
  };
}

function compiledBuild(
  compile: (source: string) => Promise<string>
): AssetBuild<ScriptText> {
  return {
    version: kBuildVersion,
    type: "text/javascript",
    async build(state) {
      return kEncoder.encode(await compile(state.text));
    }
  };
}
