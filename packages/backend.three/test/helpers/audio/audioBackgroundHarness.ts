// Import Node.js Dependencies
import { mock } from "node:test";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import { AssetReference } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { SoundAssetType } from "../../../src/assets/sound.ts";
import {
  AudioBackground,
  type AudioBackgroundOptions,
  type AudioBackgroundPlaylist,
  type AudioBackgroundTrack
} from "../../../src/audio/AudioBackground.ts";
import { GlobalAudio } from "../../../src/audio/GlobalAudio.ts";
import { Sound } from "../../../src/audio/Sound.ts";
import {
  fakeAudioBuffer,
  installFakeAudioContext,
  type FakeBufferSource
} from "./FakeAudioContext.ts";

export function musicTrack(
  name: string,
  volume?: number
): AudioBackgroundTrack {
  return {
    name,
    sound: new AssetReference(name, SoundAssetType),
    ...(volume === undefined ? {} : { volume })
  };
}

export function createAudioBackgroundHarness() {
  const context = installFakeAudioContext();
  const audio = new GlobalAudio();
  const sounds = new Map<string, Sound>();
  const assets = {
    load: mock.fn(async(reference: AssetReference<Sound>): Promise<Sound> => {
      const id = reference.id.value;
      const sound = sounds.get(id) ?? new Sound(fakeAudioBuffer());
      sounds.set(id, sound);

      return sound;
    })
  };

  const playlists: AudioBackgroundPlaylist[] = [
    {
      name: "main",
      tracks: [
        musicTrack("track1", 0.8),
        musicTrack("track2", 0.6)
      ],
      onEnd: "loop"
    },
    {
      name: "secondary",
      tracks: [
        musicTrack("ambient")
      ],
      onEnd: "stop"
    }
  ];

  function createBackground(
    options: Partial<AudioBackgroundOptions> = {}
  ): AudioBackground {
    return new AudioBackground({
      audio,
      assets,
      playlists,
      autoPlay: false,
      ...options
    });
  }

  const audioBackground = createBackground();

  return {
    context,
    audio,
    assets,
    audioBackground,
    playlists,
    createBackground,
    loadedTracks(): string[] {
      return assets.load.mock.calls.map((call) => call.arguments[0].id.value);
    },
    async settle(): Promise<void> {
      await setImmediate();
    },
    async endTrack(
      background = audioBackground
    ): Promise<void> {
      const source = background.instance?.audio.source as unknown as FakeBufferSource | undefined;
      source?.end();
      await setImmediate();
    }
  };
}

export type AudioBackgroundHarness = ReturnType<typeof createAudioBackgroundHarness>;
