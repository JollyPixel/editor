// Import Node.js Dependencies
import {
  after,
  before
} from "node:test";

export function withoutWebNavigator(): void {
  let original: PropertyDescriptor | undefined;

  before(() => {
    original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true
    });
  });
  after(() => {
    if (original === undefined) {
      Reflect.deleteProperty(globalThis, "navigator");
    }
    else {
      Object.defineProperty(globalThis, "navigator", original);
    }
  });
}
