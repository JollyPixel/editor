// Import Internal Dependencies
import {
  promptNewNamedEntity,
  type NewNamedEntityResult
} from "./dialogPromptHelpers.ts";

export type NewBlockResult = NewNamedEntityResult;

export interface PromptNewBlockOptions {
  /** Whether a selection exists that the new block could be parented under. */
  offerAddAsChild: boolean;
}

export function promptNewBlock(
  { offerAddAsChild }: PromptNewBlockOptions
): Promise<NewBlockResult | null> {
  return promptNewNamedEntity({
    heading: "New Block",
    fieldLabel: "Block name",
    defaultName: "Block",
    offerAddAsChild
  });
}
