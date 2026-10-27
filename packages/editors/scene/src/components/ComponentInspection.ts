// Import Third-party Dependencies
import type {
  ComponentChange,
  JSONObject,
  JSONValue,
  SceneComponentJSON
} from "@jolly-pixel/asset.scene/client";
import type {
  FormRow,
  SceneComponentKind
} from "@jolly-pixel/editor.host/scene";
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  readField,
  type ParsedData
} from "./componentForms.ts";

export interface InspectedRow {
  row: FormRow;
  value: unknown;
  fallback: unknown;
}

export class ComponentInspection {
  readonly rows: readonly InspectedRow[];

  #stored: Readonly<JSONObject>;

  constructor(
    entry: SceneComponentJSON,
    kind: SceneComponentKind
  ) {
    const data: ParsedData = kind.definition.parse(entry.data);
    const rows = kind.form(data);
    const defaults: ParsedData = kind.definition.parse(defaultsSource(data));

    this.#stored = entry.data;
    this.rows = rows.map((row) => {
      return {
        row,
        value: readField(data, row.path),
        fallback: readField(defaults, row.path)
      };
    });
  }

  edit(
    inspected: InspectedRow,
    next: JSONValue
  ): ComponentChange {
    const { row, fallback } = inspected;
    const [key, nested] = row.path;
    if (nested === undefined) {
      return next === fallback ?
        { unset: [key] } :
        { data: { [key]: next } };
    }

    const parent = row.control === "choice" && row.resets === true ?
      {} :
      this.#storedObject(key);

    return {
      data: {
        [key]: {
          ...parent,
          [nested]: next
        }
      }
    };
  }

  #storedObject(
    key: string
  ): JSONObject {
    const value = this.#stored[key];

    return Systems.isJSONObject(value) ? { ...value } : {};
  }
}

function defaultsSource(
  data: ParsedData
): JSONObject {
  const source: JSONObject = {};
  for (const key of Object.keys(data)) {
    const kind = readField(data, [key, "kind"]);
    if (typeof kind === "string") {
      source[key] = { kind };
    }
  }

  return source;
}
