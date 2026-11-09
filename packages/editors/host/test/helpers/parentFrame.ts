// Import Internal Dependencies
import { SHELL_ORIGIN } from "./shell.ts";

export type FakeParent = MessagePort & {
  posted: Array<{
    message: unknown;
    origin: string;
  }>;
};

export function fakeParent(): FakeParent {
  const posted: FakeParent["posted"] = [];

  return Object.assign(new MessageChannel().port1, {
    posted,
    postMessage(
      message: unknown,
      origin: string
    ): void {
      posted.push({
        message,
        origin
      });
    }
  });
}

export function frameIn(
  parent: MessageEventSource
): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(window, "parent");
  Object.defineProperty(window, "parent", {
    configurable: true,
    get: () => parent
  });

  return () => {
    if (descriptor === undefined) {
      Reflect.deleteProperty(window, "parent");
    }
    else {
      Object.defineProperty(window, "parent", descriptor);
    }
  };
}

export function postFromParent(
  parent: MessageEventSource,
  data: unknown,
  origin = SHELL_ORIGIN
): void {
  window.dispatchEvent(new MessageEvent("message", {
    source: parent,
    origin,
    data
  }));
}
