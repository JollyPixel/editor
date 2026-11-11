// Import Node.js Dependencies
import { after, before } from "node:test";

// Import Third-party Dependencies
import { Window } from "happy-dom";

export function stubDocument(): void {
  const window = new Window();
  before(() => {
    Reflect.set(globalThis, "document", window.document);
  });
  after(async() => {
    Reflect.deleteProperty(globalThis, "document");
    await window.happyDOM.close();
  });
}
