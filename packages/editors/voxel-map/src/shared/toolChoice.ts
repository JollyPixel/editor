export interface ToolOption<TValue extends string> {
  value: TValue;
  icon: string;
  label: string;
}

export interface ToolChoice<TValue extends string> {
  active: ToolOption<TValue>;
  alternatives: ToolOption<TValue>[];
}

export function choiceOf<TValue extends string>(
  options: readonly ToolOption<TValue>[],
  current: TValue
): ToolChoice<TValue> {
  const active = options.find((option) => option.value === current) ??
    options[0];

  return {
    active,
    alternatives: options.filter((option) => option !== active)
  };
}
