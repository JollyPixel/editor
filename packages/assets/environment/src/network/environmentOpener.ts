// Import Internal Dependencies
import { ENVIRONMENT_KIND } from "../asset/environment.ts";
import type {
  EnvironmentLease,
  EnvironmentOpener
} from "../model/EnvironmentLink.ts";
import {
  environmentDocumentKind,
  type EnvironmentDocumentKind
} from "./environmentDocumentKind.ts";

// CONSTANTS
const kEnvironmentKind = environmentDocumentKind();

export interface EnvironmentSession {
  readonly catalog: {
    record(
      assetId: string
    ): { readonly kind: string; } | undefined;
  };
  readonly assets: {
    open(
      kind: EnvironmentDocumentKind,
      assetId: string
    ): EnvironmentLease;
  };
}

export function environmentOpener(
  session: EnvironmentSession
): EnvironmentOpener {
  return (assetId) => (
    session.catalog.record(assetId)?.kind === ENVIRONMENT_KIND ?
      session.assets.open(kEnvironmentKind, assetId) :
      null
  );
}
