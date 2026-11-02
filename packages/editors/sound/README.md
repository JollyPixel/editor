## 📌 About

Private editor workspace for `@jolly-pixel/asset.sound` sounds, booted through `@jolly-pixel/editor.host`.

The editor is a player: Play/Stop, a Loop toggle, and the sound's waveform with a playhead. It does not edit the sound. Playback goes through Web Audio, so a sound plays only where the browser can decode Ogg Opus.

## 🚀 Running the editor

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/editor.sound dev
```

The dev server seeds a short generated chime under `assets/`; delete that directory to seed it again. Other sounds are imported through the studio.

`window.soundEditor.player` exposes the player from the console.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.sound test
$ pnpm --filter @jolly-pixel/editor.sound typecheck
$ pnpm --filter @jolly-pixel/editor.sound lint
```

Unit tests drive the player with a fake `AudioContext` and a real `SoundDocument`: playback, the time and playhead readout, the waveform, and document resets. They do not mount Lit elements.

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
