// Import Third-party Dependencies
import {
  describe,
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import {
  DEFAULT_IGNORED_PATHS,
  FilesystemAssetSource,
  MemoryAssetSource,
  type AssetSource,
  type FilesystemAssetSourceOptions
} from "#src/index.ts";

declare const source: AssetSource;
declare const filesystemSource: FilesystemAssetSource;
declare const filesystemOptions: FilesystemAssetSourceOptions;

describe("AssetSource", () => {
  test("exposes byte storage operations", () => {
    expect(source.read("sprite.png"))
      .type.toBe<Promise<Uint8Array>>();
    expect(source.exists("sprite.png"))
      .type.toBe<Promise<boolean>>();
    expect(source.write("sprite.png", new Uint8Array()))
      .type.toBe<Promise<void>>();
    expect(source.writeIfAbsent("sprite.png", new Uint8Array()))
      .type.toBe<Promise<boolean>>();
    expect(source.delete("sprite.png"))
      .type.toBe<Promise<void>>();
    expect(source.list())
      .type.toBe<Promise<string[]>>();
  });
});

describe("persistence exports", () => {
  test("preserves the filesystem source API", () => {
    expect(filesystemSource.root)
      .type.toBe<string>();
    expect(filesystemSource.resolve("sprite.png"))
      .type.toBe<string>();
    expect(filesystemSource.watch(() => undefined))
      .type.toBe<() => void>();
    expect(filesystemOptions.ignore)
      .type.toBe<readonly string[] | undefined>();
    expect(DEFAULT_IGNORED_PATHS)
      .type.toBe<readonly string[]>();
  });

  test("exports both source implementations", () => {
    expect(new FilesystemAssetSource("assets"))
      .type.toBe<FilesystemAssetSource>();
    expect(new MemoryAssetSource())
      .type.toBe<MemoryAssetSource>();
  });
});
