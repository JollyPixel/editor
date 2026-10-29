// Import Internal Dependencies
import type {
  JSONObject,
  SceneCommand,
  SceneComponentView
} from "../network/types.ts";

type ComponentChangedCommand = Extract<SceneCommand, { action: "component-changed"; }>;

export interface ComponentChangeInit {
  data?: JSONObject;
  /**
   * Top-level fields removed from the data.
   */
  unset?: Iterable<string>;
}

export class ComponentChange {
  static readonly NONE = new ComponentChange({});

  static parse(
    init: ComponentChangeInit
  ): ComponentChange | null {
    const change = new ComponentChange(init);
    const touchesNothing = change.fields().length === 0;
    const contradicts = change.unset.some((key) => Object.hasOwn(change.data, key));

    return touchesNothing || contradicts ? null : change;
  }

  readonly data: JSONObject;
  readonly unset: readonly string[];

  constructor(
    init: ComponentChangeInit
  ) {
    this.data = init.data ?? {};
    this.unset = [...init.unset ?? []];
  }

  fields(): string[] {
    return [...Object.keys(this.data), ...this.unset];
  }

  applyTo(
    data: SceneComponentView["data"]
  ): SceneComponentView["data"] {
    const unset = new Set(this.unset);

    return Object.fromEntries(
      Object.entries({
        ...data,
        ...structuredClone(this.data)
      }).filter(([key]) => !unset.has(key))
    );
  }

  revert(
    data: SceneComponentView["data"]
  ): ComponentChange {
    const previous: JSONObject = {};
    const unset: string[] = [];
    for (const key of this.fields()) {
      if (Object.hasOwn(data, key)) {
        previous[key] = data[key];
      }
      else {
        unset.push(key);
      }
    }

    return new ComponentChange({
      data: previous,
      unset
    });
  }

  toCommand(
    id: string
  ): ComponentChangedCommand {
    return {
      action: "component-changed",
      id,
      data: this.data,
      ...this.unset.length === 0 ? {} : { unset: [...this.unset] }
    };
  }
}
