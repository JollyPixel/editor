// Import Third-party Dependencies
import { InvalidAssetFileError } from "@jolly-pixel/asset-server";
import type * as Mediabunny from "mediabunny";

// Import Internal Dependencies
import { registerOpusEncoder } from "#opus-encoder";
import { SOUND_KIND } from "../asset/sound.ts";
import { OpusEncoderUnavailableError } from "./errors/OpusEncoderUnavailableError.ts";

async function loadMediabunny(): Promise<typeof Mediabunny> {
  const [mediabunny] = await Promise.all([
    import("mediabunny"),
    registerOpusEncoder().catch((error: unknown) => {
      throw new OpusEncoderUnavailableError({ cause: error });
    })
  ]);

  return mediabunny;
}

export async function oggContentFromAudio(
  content: Uint8Array
): Promise<Uint8Array> {
  const {
    ALL_FORMATS,
    BufferSource,
    BufferTarget,
    Conversion,
    Input,
    OggOutputFormat,
    Output,
    QUALITY_MEDIUM,
    UnsupportedInputFormatError
  } = await loadMediabunny();

  using input = new Input({
    source: new BufferSource(content),
    formats: ALL_FORMATS
  });
  const target = new BufferTarget();
  const output = new Output({
    format: new OggOutputFormat(),
    target
  });

  let conversion: Mediabunny.Conversion;
  try {
    conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: {
        discard: true
      },
      audio: {
        codec: "opus",
        quality: QUALITY_MEDIUM
      }
    });
  }
  catch (error) {
    if (error instanceof UnsupportedInputFormatError) {
      throw new InvalidAssetFileError(
        SOUND_KIND,
        "content is not a supported audio file",
        { cause: error }
      );
    }

    throw error;
  }

  if (!conversion.isValid) {
    const encodable = conversion.discardedTracks.every(
      ({ reason }) => reason !== "no_encodable_target_codec"
    );
    if (!encodable) {
      throw new OpusEncoderUnavailableError();
    }

    throw new InvalidAssetFileError(
      SOUND_KIND,
      "content has no audio track that can be decoded"
    );
  }

  await conversion.execute();
  if (target.buffer === null) {
    throw new Error("The Ogg conversion finished without an output buffer.");
  }

  return new Uint8Array(target.buffer);
}
