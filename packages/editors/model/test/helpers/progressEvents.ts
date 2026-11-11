// Import Node.js Dependencies
import { after, before } from "node:test";

class FakeProgressEvent extends Event {
  readonly lengthComputable = false;
  readonly loaded = 0;
  readonly total = 0;
}

export function stubProgressEvents(): void {
  const previous = globalThis.ProgressEvent;
  before(() => {
    globalThis.ProgressEvent = FakeProgressEvent;
  });
  after(() => {
    globalThis.ProgressEvent = previous;
  });
}
