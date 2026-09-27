// Import Third-party Dependencies
import {
  describe,
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import {
  AssetReference,
  AssetType,
  type AssetReferenceGroup
} from "../src/index.ts";

describe("AssetReference", () => {
  test("infers the value type of its AssetType", () => {
    const reference = new AssetReference(
      "dialogue.intro",
      new AssetType<string>("text")
    );

    expect(reference).type.toBe<AssetReference<string>>();
    expect(reference).type.not.toBeAssignableTo<AssetReference<number>>();
  });

  test("keeps each value type inside a reference group", () => {
    const assets = {
      dialogue: new AssetReference(
        "dialogue.intro",
        new AssetType<string>("text")
      )
    } satisfies AssetReferenceGroup;

    expect(assets.dialogue).type.toBe<AssetReference<string>>();
  });
});
