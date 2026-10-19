export type KeyboardLayout = ReadonlyMap<string, string>;

interface KeyboardLayoutSource {
  getLayoutMap(): Promise<KeyboardLayout>;
}

export async function loadKeyboardLayout(): Promise<KeyboardLayout | null> {
  const keyboard = typeof navigator !== "undefined" && "keyboard" in navigator ?
    navigator.keyboard :
    null;
  if (!isKeyboardLayoutSource(keyboard)) {
    return null;
  }

  try {
    return new Map(
      await keyboard.getLayoutMap()
    );
  }
  catch {
    return null;
  }
}

function isKeyboardLayoutSource(
  value: unknown
): value is KeyboardLayoutSource {
  return typeof value === "object" &&
    value !== null &&
    "getLayoutMap" in value &&
    typeof value.getLayoutMap === "function";
}
