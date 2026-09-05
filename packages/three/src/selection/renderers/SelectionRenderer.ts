// Import Internal Dependencies
import type { SelectionAppearance } from "../SelectionAppearance.ts";
import type { ResolvedSelectionIndicator } from "../SelectionResolver.ts";

export interface SelectionRenderer {
  sync(
    indicators: readonly ResolvedSelectionIndicator[],
    appearance: SelectionAppearance
  ): void;
  render(): void;
  dispose(): void;
}
