// Import Internal Dependencies
import type { MeshHighlightAppearance } from "../MeshHighlightAppearance.ts";
import type { ResolvedHighlightIndicator } from "../HighlightResolver.ts";

export interface MeshHighlightRenderer {
  sync(
    indicators: readonly ResolvedHighlightIndicator[],
    appearance: MeshHighlightAppearance
  ): void;
  render(): void;
  dispose(): void;
}
