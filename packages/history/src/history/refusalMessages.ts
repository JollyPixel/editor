// Import Internal Dependencies
import type {
  HistoryRefusal,
  HistoryStepInfo
} from "./HistoryState.ts";

export interface RefusalWording {
  /**
   * @default "it was changed since"
   */
  changed?: string;
  /**
   * @default "it is gone"
   */
  closed?: string;
  /**
   * Display name of a peer, or `undefined` to call it "a peer".
   */
  peerName?: (clientId: string) => string | undefined;
}

// CONSTANTS
const kChanged = "it was changed since";
const kGone = "it is gone";

export function describeRefusal(
  refusal: HistoryRefusal,
  wording: RefusalWording = {}
): string {
  switch (refusal.reason) {
    case "peer": {
      if (refusal.clientId === null) {
        return kChanged;
      }
      const name = wording.peerName?.(refusal.clientId) ?? "a peer";

      return `${name} changed it since`;
    }
    case "changed":
      return wording.changed ?? kChanged;
    case "server":
      return "the server refused it";
    case "closed":
      return wording.closed ?? kGone;
    case "gone":
      return kGone;
  }
}

export function describeSkippedStep(
  step: HistoryStepInfo,
  wording: RefusalWording = {}
): string {
  const label = step.label === null ? "a step" : `"${step.label}"`;

  return `Skipped ${label}: ${describeRefusal(step.refused, wording)}`;
}
