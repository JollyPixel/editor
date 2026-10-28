// Import Node.js Dependencies
import { mock } from "node:test";
import timers from "node:timers/promises";

// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  AudioBackground,
  type AudioBackgroundOptions,
  type AudioBackgroundPlaylist
} from "../../../src/audio/AudioBackground.ts";
import type { AudioManager } from "../../../src/audio/AudioManager.ts";

// CONSTANTS
const kAsyncPropagationDelay = 10;

export interface MockAudio {
  isPlaying: boolean;
  setVolume: ReturnType<typeof mock.fn<(volume: number) => void>>;
  play: ReturnType<typeof mock.fn<() => void>>;
  pause: ReturnType<typeof mock.fn<() => void>>;
  stop: ReturnType<typeof mock.fn<() => void>>;
  onEnded: (() => void) | null;
}

export interface MockAudioManager {
  loadAudio: ReturnType<typeof mock.fn<(url: string, options?: any) => Promise<THREE.Audio>>>;
  destroyAudio: ReturnType<typeof mock.fn<(audio: THREE.Audio) => void>>;
}

export function createAudioBackgroundHarness() {
  const mockAudio: MockAudio = {
    isPlaying: false,
    setVolume: mock.fn(),
    play: mock.fn(() => {
      mockAudio.isPlaying = true;
    }),
    pause: mock.fn(() => {
      mockAudio.isPlaying = false;
    }),
    stop: mock.fn(() => {
      mockAudio.isPlaying = false;
    }),
    onEnded: null
  };

  const mockAudioManager: MockAudioManager = {
    loadAudio: mock.fn(async() => mockAudio as unknown as THREE.Audio),
    destroyAudio: mock.fn()
  };

  const playlists: AudioBackgroundPlaylist[] = [
    {
      name: "main",
      tracks: [
        {
          name: "track1",
          path: "/audio/track1.mp3",
          volume: 0.8
        },
        {
          name: "track2",
          path: "/audio/track2.mp3",
          volume: 0.6
        }
      ],
      onEnd: "loop"
    },
    {
      name: "secondary",
      tracks: [
        {
          name: "ambient",
          path: "/audio/ambient.mp3"
        }
      ],
      onEnd: "stop"
    }
  ];

  function createBackground(
    options: Partial<AudioBackgroundOptions> = {}
  ): AudioBackground {
    return new AudioBackground({
      audioManager: mockAudioManager as unknown as AudioManager,
      playlists,
      autoPlay: false,
      ...options
    });
  }

  return {
    audioBackground: createBackground(),
    mockAudio,
    mockAudioManager,
    playlists,
    createBackground,
    async triggerOnEnded(): Promise<void> {
      if (mockAudio.onEnded) {
        mockAudio.onEnded();
        await timers.setTimeout(kAsyncPropagationDelay);
      }
    }
  };
}

export type AudioBackgroundHarness = ReturnType<typeof createAudioBackgroundHarness>;
