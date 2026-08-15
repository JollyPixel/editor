// Import Internal Dependencies
import type { InputCustomAction } from "./types.ts";

export class InputActionQuery<TAction> {
  readonly isAny: boolean;
  readonly isNone: boolean;
  readonly value: TAction | null;

  constructor(
    action: TAction | InputCustomAction
  ) {
    this.isAny = action === "ANY";
    this.isNone = action === "NONE";
    this.value = this.isAny || this.isNone ? null : action as TAction;
  }

  match(
    handlers: {
      any: () => boolean;
      none: () => boolean;
      value: (action: TAction) => boolean;
    }
  ): boolean {
    if (this.isAny) {
      return handlers.any();
    }
    if (this.isNone) {
      return handlers.none();
    }

    return handlers.value(this.value as TAction);
  }
}
