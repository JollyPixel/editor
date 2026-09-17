// Import Internal Dependencies
import {
  promptNewNamedEntity,
  type NewNamedEntityResult
} from "./dialogPromptHelpers.ts";

export type NewFolderResult = NewNamedEntityResult;

export interface PromptNewFolderOptions {
  /** Whether a selection exists that the new folder could nest under. */
  offerAddAsChild: boolean;
}

export function promptNewFolder(
  { offerAddAsChild }: PromptNewFolderOptions
): Promise<NewFolderResult | null> {
  return promptNewNamedEntity({
    heading: "New Folder",
    fieldLabel: "Folder name",
    defaultName: "Folder",
    offerAddAsChild
  });
}
