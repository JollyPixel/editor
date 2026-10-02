// Import Internal Dependencies
import type { RuntimeOptions } from "../Runtime.ts";
import type { FocusHintOptions } from "../ui/focus/mountFocusHint.ts";
import type { ViewHelperOptions } from "../ui/viewHelper/mountViewHelper.ts";

export type RuntimeSessionOptions = Pick<
  RuntimeOptions,
  | "focusCanvas"
  | "focusHint"
  | "viewHelper"
  | "renderOnDemand"
  | "suspendWhenHidden"
>;

export class RuntimeSessionSettings {
  readonly focusCanvas: boolean;
  readonly focusHint: Readonly<Partial<FocusHintOptions>> | null;
  readonly viewHelper: Readonly<Partial<ViewHelperOptions>> | null;
  readonly renderOnDemand: boolean;
  readonly suspendWhenHidden: boolean;

  constructor(
    options: RuntimeSessionOptions = {}
  ) {
    this.focusCanvas = options.focusCanvas ?? true;
    this.focusHint = resolveToggle(
      options.focusHint
    );
    this.viewHelper = resolveToggle(
      options.viewHelper
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
