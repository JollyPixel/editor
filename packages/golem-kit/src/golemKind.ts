// Import Third-party Dependencies
import type * as z from "zod/mini";

// Import Internal Dependencies
import type { AssetOpening } from "./AssetOpening.ts";
import type { GolemAsset } from "./GolemAsset.ts";
import type { GolemIntent } from "./golemIntent.ts";

// CONSTANTS
export const GOLEM_KINDS_EXPORT = "GOLEM_KINDS";

export type GolemIntents<TAsset> = Readonly<Record<string, GolemIntent<TAsset>>>;

export interface GolemKindOptions<TAsset> {
  /**
   * Edits an agent asks for by name through the MCP server's `asset_intent`.
   * @default {}
   */
  intents?: GolemIntents<TAsset>;
  /**
   * A Markdown file an agent reads when it opens an asset of the kind.
   */
  guide?: URL;
}

export interface GolemKindContribution<
  TAsset,
  TOpening extends AssetOpening = AssetOpening
> {
  readonly kind: string;
  readonly schema: z.ZodMiniType;
  readonly intents: GolemIntents<TAsset>;
  readonly guide: URL | null;
  open(opening: TOpening): TAsset;
}

export type GolemKindList = readonly GolemKindContribution<GolemAsset>[];

export function golemKind<
  TDocumentKind extends {
    readonly kind: string;
    readonly commandSchema: z.ZodMiniType;
  },
  TAsset,
  TOpening extends AssetOpening = AssetOpening
>(
  documentKind: TDocumentKind,
  Asset: new (opening: TOpening, kind: TDocumentKind) => TAsset,
  options: GolemKindOptions<NoInfer<TAsset>> = {}
): GolemKindContribution<TAsset, TOpening> {
  const {
    intents = {},
    guide = null
  } = options;

  return {
    kind: documentKind.kind,
    schema: documentKind.commandSchema,
    intents,
    guide,
    open: (opening) => new Asset(opening, documentKind)
  };
}
