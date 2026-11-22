// Import Internal Dependencies
import type { FocusHintOptions } from "./mountFocusHint.ts";

export interface RuntimeSessionOptions {
  focusCanvas?: boolean;
  suspendWhenHidden?: boolean;
  renderOnDemand?: boolean;
  focusHint?: boolean | FocusHintOptions;
}

export class RuntimeSessionSettings {
  readonly focusCanvas: boolean;
  readonly focusHint: Readonly<Partial<FocusHintOptions>> | null;
  readonly renderOnDemand: boolean;
  readonly suspendWhenHidden: boolean;

  constructor(
    options: RuntimeSessionOptions = {}
  ) {
    this.focusCanvas = options.focusCanvas ?? true;
    this.focusHint = resolveToggle(
      options.focusHint
    );
    this.renderOnDemand = options.renderOnDemand ?? false;
    this.suspendWhenHidden = options.suspendWhenHidden ?? false;

    Object.freeze(this);
  }
}

function resolveToggle<TOptions extends object>(
  option: boolean | TOptions | undefined
): Readonly<Partial<TOptions>> | null {
  if (!option) {
    return null;
  }

  return Object.freeze(
    option === true ? {} : { ...option }
  );
}
