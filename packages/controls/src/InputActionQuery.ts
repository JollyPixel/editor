// Import Internal Dependencies
import type { InputCustomAction } from "./types.ts";

export type InputActionQueryValue<TAction> = Exclude<
  TAction,
  InputCustomAction
>;

export class InputActionQuery<
  TAction
> {
  readonly isAny: boolean;
  readonly isNone: boolean;
  readonly value: InputActionQueryValue<TAction> | null;

  constructor(
    action: TAction | InputCustomAction
  ) {
    this.isAny = action === "ANY";
    this.isNone = action === "NONE";
    this.value = this.isAny || this.isNone ?
      null :
      action as InputActionQueryValue<TAction>;
  }

  match(
    handlers: {
      any: () => boolean;
      none: () => boolean;
      value: (action: InputActionQueryValue<TAction>) => boolean;
    }
  ): boolean {
    if (this.isAny) {
      return handlers.any();
    }
    if (this.isNone) {
      return handlers.none();
    }

    return handlers.value(
      this.value as InputActionQueryValue<TAction>
    );
  }
}
