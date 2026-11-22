// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";
import type { SignalEvent } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import type { SignalKey } from "#src/scene/index.ts";

interface Lever {
  readonly pulled: SignalEvent<[force: number]>;
  readonly released: SignalEvent;
  force: number;
  pull(): void;
}

test("a signal key names only the SignalEvent fields of a component", () => {
  expect<SignalKey<Lever>>().type.toBe<"pulled" | "released">();
});
