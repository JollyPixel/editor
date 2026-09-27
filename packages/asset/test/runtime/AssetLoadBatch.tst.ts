// Import Third-party Dependencies
import {
  describe,
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import type {
  AssetLoadBatchOptions,
  AssetLoadProgress
} from "../../src/index.ts";

type ProgressOf<TStatus extends AssetLoadProgress["status"]> = Extract<
  AssetLoadProgress,
  { status: TStatus; }
>;

describe("AssetLoadProgress", () => {
  test("is the payload passed to onProgress", () => {
    expect<Parameters<Required<AssetLoadBatchOptions>["onProgress"]>>()
      .type.toBe<[progress: AssetLoadProgress]>();
  });

  test("carries an error only on failed progress", () => {
    expect<ProgressOf<"failed">["error"]>().type.toBe<unknown>();
    expect<keyof ProgressOf<"ready">>()
      .type.toBe<"status" | "completed" | "total" | "record">();
  });
});
