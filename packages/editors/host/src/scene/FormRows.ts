// Import Third-party Dependencies
import type { AssetType } from "@jolly-pixel/asset";
import type {
  ScenePropertyType,
  Systems
} from "@jolly-pixel/engine";

type DataKey<TData> = TData extends object ? keyof TData & string : never;
type DataField<TData, TKey extends string> = TData extends object ?
  TKey extends keyof TData ? NonNullable<TData[TKey]> : never :
  never;

type NestedPath<TData> = {
  [TKey in DataKey<TData>]: readonly [TKey, DataKey<DataField<TData, TKey>>];
}[DataKey<TData>];

type ListKey<TData> = {
  [TKey in DataKey<TData>]: DataField<TData, TKey> extends readonly unknown[] ?
    TKey :
    never;
}[DataKey<TData>];
type ListItem<TData, TKey extends string> =
  DataField<TData, TKey> extends readonly (infer TItem)[] ? TItem : never;

export type FieldPath<TData = unknown> = unknown extends TData ?
  readonly [string] | readonly [string, string] :
  readonly [DataKey<TData>] | NestedPath<TData>;

export interface ChoiceOption {
  value: string;
  label: string;
}

interface RowBase<TData> {
  path: FieldPath<TData>;
  label: string;
  /**
   * Value shown, and used as the default, while the data has none.
   */
  fallback?: Systems.JSONValue;
}

export interface NumberRow<TData = unknown> extends RowBase<TData> {
  control: "number";
  min?: number;
  max?: number;
  step?: number;
}

export interface BooleanRow<TData = unknown> extends RowBase<TData> {
  control: "boolean";
}

export interface ColorRow<TData = unknown> extends RowBase<TData> {
  control: "color";
}

export interface ChoiceRow<TData = unknown> extends RowBase<TData> {
  control: "choice";
  options: readonly ChoiceOption[];
  resets?: boolean;
}

export interface TextRow<TData = unknown> extends RowBase<TData> {
  control: "text";
}

export interface DeclaredProperty {
  key: string;
  type: ScenePropertyType;
  label: string;
  description: string;
  default: Systems.JSONValue | null;
}

export interface PropertiesRow<TData = unknown> extends RowBase<TData> {
  control: "properties";
  /**
   * Properties the component declares. They show first, with a fixed key
   * and type, and fall back to their default.
   */
  declared?: readonly DeclaredProperty[];
}

export interface VectorRow<TData = unknown> extends RowBase<TData> {
  control: "vector";
  /**
   * Number of components, read and written as `x`, `y`, `z` and `w`.
   * @default 3
   */
  size?: 2 | 3 | 4;
  min?: number;
  max?: number;
  step?: number;
}

export type FieldRow<TData = unknown> =
  | NumberRow<TData>
  | BooleanRow<TData>
  | ColorRow<TData>
  | ChoiceRow<TData>
  | TextRow<TData>
  | VectorRow<TData>
  | PropertiesRow<TData>;

export interface ListItems<TItem = unknown> {
  /**
   * Title of each item, numbered from 1.
   */
  itemLabel: string;
  /**
   * Data of an added item.
   */
  seed: Systems.JSONObject;
  rows(item: TItem): readonly FieldRow<TItem>[];
}

export interface ListRow extends ListItems {
  control: "list";
  path: readonly [string];
  label: string;
}

export interface AssetRow {
  control: "asset";
  /**
   * Key of the component `assets` map the picked reference is stored under.
   */
  slot: string;
  label: string;
  type: AssetType<unknown>;
}

export type FormRow<TData = unknown> =
  | FieldRow<TData>
  | ListRow
  | AssetRow;

export type ComponentForm<
  TData,
  TAssets extends Systems.ComponentAssetValues = Systems.ComponentAssetValues
> = (
  data: TData,
  assets: Systems.ComponentAssets<TAssets>
) => FormRow<TData>[];

export type NumberBounds = Pick<NumberRow, "min" | "max" | "step">;

export class FormRows<TData> {
  number(
    path: FieldPath<TData>,
    label: string,
    bounds: NumberBounds = {}
  ): NumberRow<TData> {
    return {
      control: "number",
      path,
      label,
      ...bounds
    };
  }

  boolean(
    path: FieldPath<TData>,
    label: string
  ): BooleanRow<TData> {
    return {
      control: "boolean",
      path,
      label
    };
  }

  color(
    path: FieldPath<TData>,
    label: string
  ): ColorRow<TData> {
    return {
      control: "color",
      path,
      label
    };
  }

  choice(
    path: FieldPath<TData>,
    label: string,
    options: readonly ChoiceOption[]
  ): ChoiceRow<TData> {
    return {
      control: "choice",
      path,
      label,
      options
    };
  }

  vector(
    path: FieldPath<TData>,
    label: string,
    bounds: NumberBounds = {}
  ): VectorRow<TData> {
    return {
      control: "vector",
      path,
      label,
      ...bounds
    };
  }

  asset(
    slot: string,
    label: string,
    type: AssetType<unknown>
  ): AssetRow {
    return {
      control: "asset",
      slot,
      label,
      type
    };
  }

  list<TKey extends ListKey<TData>>(
    key: TKey,
    label: string,
    list: ListItems<ListItem<TData, TKey>>
  ): ListRow {
    return {
      control: "list",
      path: [key],
      label,
      ...list
    };
  }
}
