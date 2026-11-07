// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  CatalogReplaceOptions,
  ReplaceReport
} from "@jolly-pixel/asset-server/client";
import { SoundDocument } from "@jolly-pixel/asset.sound/client";

// Import Internal Dependencies
import {
  SoundFile,
  type SoundFileCatalog
} from "#src/panes/sound/SoundFile.ts";
import { SoundFileError } from "#src/panes/sound/errors/SoundFileError.ts";

// CONSTANTS
const kAssetId = "sound-1";
const kOggBytes = new Uint8Array([0x4F, 0x67, 0x67, 0x53]);

interface ReplaceCall {
  assetId: string;
  content: Uint8Array;
  options: CatalogReplaceOptions | undefined;
}

class FakeCatalog implements SoundFileCatalog {
  readonly calls: ReplaceCall[] = [];
  report: ReplaceReport = {
    replaced: true
  };

  record(
    assetId: string
  ) {
    return assetId === kAssetId ?
      {
        id: kAssetId,
        kind: "sound",
        path: "sounds/door-slam.ogg"
      } :
      undefined;
  }

  replace(
    assetId: string,
    content: Uint8Array,
    options?: CatalogReplaceOptions
  ): Promise<ReplaceReport> {
    this.calls.push({
      assetId,
      content,
      options
    });

    return Promise.resolve(this.report);
  }
}

function soundFile(
  catalog = new FakeCatalog(),
  bytes: Uint8Array | null = kOggBytes
): SoundFile {
  const document = new SoundDocument();
  if (bytes !== null) {
    document.load(bytes);
  }

  return new SoundFile({
    catalog,
    assetId: kAssetId,
    document
  });
}

describe("SoundFile", () => {
  describe("replace", () => {
    for (const [name, from] of [
      ["take-2.ogg", undefined],
      ["take-2.wav", ".wav"],
      ["TAKE-2.MP3", ".mp3"]
    ] as const) {
      test(`sends "${name}" with from ${String(from)}`, async() => {
        const catalog = new FakeCatalog();
        const bytes = new Uint8Array([1, 2, 3]);

        await soundFile(catalog).replace(new File([bytes], name));

        assert.deepEqual(catalog.calls, [{
          assetId: kAssetId,
          content: bytes,
          options: {
            from
          }
        }]);
      });
    }

    test("reports whether the server changed the content", async() => {
      const catalog = new FakeCatalog();
      const file = soundFile(catalog);
      catalog.report = {
        replaced: false
      };

      assert.equal(await file.replace(new File([kOggBytes], "same.ogg")), false);
    });

    test("rejects a file the sound kind cannot read before sending it", async() => {
      const catalog = new FakeCatalog();

      await assert.rejects(
        soundFile(catalog).replace(new File([kOggBytes], "cover.png")),
        new SoundFileError("\"cover.png\" is not a sound file.")
      );
      assert.deepEqual(catalog.calls, []);
    });

    test("rejects a file over 10 MB before sending it", async() => {
      const catalog = new FakeCatalog();
      const large = new File(
        [new Uint8Array(10 * 1024 * 1024 + 1)],
        "ambience.wav"
      );

      await assert.rejects(
        soundFile(catalog).replace(large),
        new SoundFileError("\"ambience.wav\" is larger than 10 MB.")
      );
      assert.deepEqual(catalog.calls, []);
    });
  });

  describe("download", () => {
    test("gives the stored Ogg bytes named after the asset", async() => {
      const download = soundFile().download();

      assert.equal(download?.name, "door-slam.ogg");
      assert.equal(download.blob.type, "audio/ogg");
      assert.deepEqual(new Uint8Array(await download.blob.arrayBuffer()), kOggBytes);
    });

    test("gives nothing while the sound is empty", () => {
      const file = soundFile(new FakeCatalog(), null);

      assert.equal(file.empty, true);
      assert.equal(file.download(), null);
    });
  });
});
