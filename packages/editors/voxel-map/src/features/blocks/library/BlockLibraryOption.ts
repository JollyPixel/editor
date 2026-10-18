export class BlockLibraryOption<TKind extends string = string> {
  readonly value: TKind;
  readonly icon: string;
  readonly label: string;

  constructor(
    value: TKind,
    icon: string,
    label: string
  ) {
    this.value = value;
    this.icon = icon;
    this.label = label;
  }
}
