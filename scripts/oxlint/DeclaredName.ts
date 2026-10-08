export interface KeyNode {
  type: string;
  range: [number, number];
  name?: unknown;
}

export class DeclaredName {
  static read(
    key: KeyNode | null | undefined
  ): DeclaredName | null {
    if (
      key &&
      (key.type === "Identifier" || key.type === "PrivateIdentifier") &&
      typeof key.name === "string"
    ) {
      return new DeclaredName(key, key.name);
    }

    return null;
  }

  readonly node: KeyNode;
  readonly text: string;

  constructor(
    node: KeyNode,
    text: string
  ) {
    this.node = node;
    this.text = text;
  }
}
