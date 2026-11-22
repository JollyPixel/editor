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
  readonly focusHint: Readonly<FocusHintOptions> | null;
  readonly renderOnDemand: boolean;
  readonly suspendWhenHidden: boolean;

  constructor(
    options: RuntimeSessionOptions = {}
  ) {
    this.focusCanvas = options.focusCanvas ?? true;
    this.focusHint = resolveFocusHint(
      options.focusHint
    );
    this.renderOnDemand = options.renderOnDemand ?? false;
    this.suspendWhenHidden = options.suspendWhenHidden ?? false;

    Object.freeze(this);
  }
}

function resolveFocusHint(
  option: boolean | FocusHintOptions | undefined
): Readonly<FocusHintOptions> | null {
  if (!option) {
    return null;
  }

  return Object.freeze(
    option === true ? {} : { ...option }
  );
}
