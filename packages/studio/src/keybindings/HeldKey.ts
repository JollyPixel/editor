// Import Third-party Dependencies
import {
  MODIFIER_KEY_CODES,
  isKeyCode,
  type KeyChord,
  type KeyCode,
  type KeyboardLayout
} from "@jolly-pixel/controls";

export class HeldKey {
  static capture(
    event: Pick<KeyboardEvent, "code">
  ): HeldKey | null {
    const { code } = event;
    if (!isKeyCode(code)) {
      return null;
    }

    const sides = Object.values(MODIFIER_KEY_CODES)
      .find((codes) => codes.includes(code));

    return new HeldKey(sides ?? [code]);
  }

  readonly codes: readonly KeyCode[];

  constructor(
    codes: readonly KeyCode[]
  ) {
    this.codes = Object.freeze([...codes]);
  }

  triggers(
    chord: KeyChord,
    layout: KeyboardLayout | null
  ): boolean {
    return this.codes.some((code) => chord.matches({
      code,
      key: layout?.get(code) ?? "",
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false
    }));
  }
}
