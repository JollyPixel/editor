export interface ChoiceOption<TValue extends string> {
  value: TValue;
  label: string;
}

export interface ToolOption<TValue extends string> extends ChoiceOption<TValue> {
  icon: string;
}

export interface ToolChoice<TOption> {
  active: TOption;
  alternatives: TOption[];
}

export function choiceOf<
  TValue extends string,
  TOption extends ChoiceOption<TValue>
>(
  options: readonly TOption[],
  current: TValue
): ToolChoice<TOption> {
  const active = options.find((option) => option.value === current) ??
    options[0];

  return {
    active,
    alternatives: options.filter((option) => option !== active)
  };
}
