// Import Node.js Dependencies
import type { TestContext } from "node:test";

// CONSTANTS
const kNavigatorDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator"
);

export function stubNavigator(
  t: TestContext,
  value: unknown
): void {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true
  });
  t.after(restoreNavigator);
}

export function stubKeyboardLayout(
  t: TestContext,
  entries: Array<[string, string]>
): void {
  stubNavigator(t, {
    keyboard: {
      getLayoutMap: async() => new Map(entries)
    }
  });
}

function restoreNavigator(): void {
  if (kNavigatorDescriptor === undefined) {
    Reflect.deleteProperty(globalThis, "navigator");
  }
  else {
    Object.defineProperty(globalThis, "navigator", kNavigatorDescriptor);
  }
}
