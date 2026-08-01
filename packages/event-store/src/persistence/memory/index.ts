// Import Internal Dependencies
import type { EventStore } from "../../EventStore.ts";
import { MemoryEventLog } from "./log.ts";
import { MemoryEventWriter } from "./writer.ts";
import { MemoryEventReader } from "./reader.ts";

export function createMemoryEventStore(): EventStore {
  const log = new MemoryEventLog();

  return {
    writer: new MemoryEventWriter(log),
    reader: new MemoryEventReader(log),
    close: () => log.clear(),
    [Symbol.dispose]() {
      this.close();
    }
  };
}

export { MemoryEventWriter } from "./writer.ts";
export { MemoryEventReader } from "./reader.ts";
