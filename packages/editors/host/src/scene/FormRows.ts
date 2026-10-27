type DataKey<TData> = TData extends object ? keyof TData & string : never;
type DataField<TData, TKey extends string> = TData extends object ?
  TKey extends keyof TData ? NonNullable<TData[TKey]> : never :
  never;

type NestedPath<TData> = {
  [TKey in DataKey<TData>]: readonly [TKey, DataKey<DataField<TData, TKey>>];
}[DataKey<TData>];

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

export interface PropertiesRow<TData = unknown> extends RowBase<TData> {
  control: "properties";
}

export type FormRow<TData = unknown> =
  | NumberRow<TData>
  | BooleanRow<TData>
  | ColorRow<TData>
  | ChoiceRow<TData>
  | TextRow<TData>
  | PropertiesRow<TData>;

export type ComponentForm<TData> = (data: TData) => FormRow<TData>[];

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
}
