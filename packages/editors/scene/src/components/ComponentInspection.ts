// Import Third-party Dependencies
import {
  ComponentChange,
  type JSONObject,
  type JSONValue,
  type SceneComponentJSON
} from "@jolly-pixel/asset.scene/client";
import type {
  AssetRow,
  FieldRow,
  FormRow,
  ListRow,
  SceneComponentKind
} from "@jolly-pixel/editor.host/scene";
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  readField,
  type ParsedData
} from "./componentForms.ts";

export interface InspectedField {
  kind: "field";
  row: FieldRow;
  value: unknown;
  fallback: unknown;
}

export interface InspectedList {
  kind: "list";
  row: ListRow;
  items: readonly (readonly InspectedField[])[];
}

export interface InspectedAsset {
  kind: "asset";
  row: AssetRow;
}

export type InspectedRow = InspectedField | InspectedList | InspectedAsset;

export class ComponentInspection {
  readonly rows: readonly InspectedRow[];

  #stored: Readonly<JSONObject>;
  #data: ParsedData;

  constructor(
    entry: SceneComponentJSON,
    kind: SceneComponentKind,
    resolver: Systems.ComponentAssetResolver
  ) {
    const data: ParsedData = kind.definition.parse(entry.data);
    const rows = kind.form(data, new Systems.ComponentAssets(
      kind.definition.assets ?? {},
      entry.assets,
      resolver
    ));
    const defaults: ParsedData = kind.definition.parse(
      variantsSource(data, rows)
    );

    this.#stored = entry.data;
    this.#data = data;
    this.rows = rows.map((row) => inspectRow(row, data, defaults));
  }

  edit(
    inspected: InspectedField,
    next: JSONValue
  ): ComponentChange {
    const { row, fallback } = inspected;
    const [key, nested] = row.path;
    if (nested === undefined) {
      return next === fallback ?
        new ComponentChange({ unset: [key] }) :
        new ComponentChange({ data: { [key]: next } });
    }

    return new ComponentChange({
      data: {
        [key]: patchNested(this.#storedObject(key), row, nested, next)
      }
    });
  }

  editItem(
    list: InspectedList,
    index: number,
    inspected: InspectedField,
    next: JSONValue
  ): ComponentChange {
    return this.#writeItems(list, (items) => items.map(
      (item, position) => (position === index ?
        patchField(item, inspected.row, next) :
        item)
    ));
  }

  addItem(
    list: InspectedList
  ): ComponentChange {
    return this.#writeItems(
      list,
      (items) => [...items, structuredClone(list.row.seed)]
    );
  }

  removeItem(
    list: InspectedList,
    index: number
  ): ComponentChange {
    return this.#writeItems(
      list,
      (items) => items.filter((_, position) => position !== index)
    );
  }

  #writeItems(
    list: InspectedList,
    update: (items: JSONObject[]) => JSONObject[]
  ): ComponentChange {
    const [key] = list.row.path;

    return new ComponentChange({
      data: {
        [key]: update(readItems(this.#data, list.row))
      }
    });
  }

  #storedObject(
    key: string
  ): JSONObject {
    const value = this.#stored[key];

    return Systems.isJSONObject(value) ? { ...value } : {};
  }
}

function readItems(
  data: ParsedData,
  row: ListRow
): JSONObject[] {
  const value = readField(data, row.path);

  return Array.isArray(value) ?
    value.filter(Systems.isJSONObject).map((item) => structuredClone(item)) :
    [];
}

function inspectRow(
  row: FormRow,
  data: ParsedData,
  defaults: ParsedData
): InspectedRow {
  if (row.control === "asset") {
    return {
      kind: "asset",
      row
    };
  }
  if (row.control !== "list") {
    return inspectField(row, data, defaults);
  }

  const defaultItems = readItems(defaults, row);

  return {
    kind: "list",
    row,
    items: readItems(data, row).map((item, index) => row.rows(item).map(
      (itemRow) => inspectField(itemRow, item, defaultItems[index] ?? {})
    ))
  };
}

function inspectField(
  row: FieldRow,
  data: ParsedData,
  defaults: ParsedData
): InspectedField {
  return {
    kind: "field",
    row,
    value: readField(data, row.path) ?? row.fallback,
    fallback: readField(defaults, row.path) ?? row.fallback
  };
}

function patchField(
  item: Readonly<JSONObject>,
  row: FieldRow,
  next: JSONValue
): JSONObject {
  const [key, nested] = row.path;
  if (nested === undefined) {
    return {
      ...item,
      [key]: next
    };
  }

  const parent = item[key];

  return {
    ...item,
    [key]: patchNested(
      Systems.isJSONObject(parent) ? parent : {},
      row,
      nested,
      next
    )
  };
}

function patchNested(
  parent: Readonly<JSONObject>,
  row: FieldRow,
  nested: string,
  next: JSONValue
): JSONObject {
  const base = row.control === "choice" && row.resets === true ? {} : parent;

  return {
    ...base,
    [nested]: next
  };
}

function variantsSource(
  data: ParsedData,
  rows: readonly FormRow[]
): JSONObject {
  let source: JSONObject = {};
  for (const row of rows) {
    if (row.control === "asset") {
      continue;
    }
    if (row.control === "list") {
      source[row.path[0]] = readItems(data, row).map(
        (item) => variantsSource(item, row.rows(item))
      );
      continue;
    }

    const value = readField(data, row.path);
    if (
      row.control === "choice" &&
      row.resets === true &&
      typeof value === "string"
    ) {
      source = patchField(source, row, value);
    }
  }

  return source;
}
