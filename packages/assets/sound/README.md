`.ogg` sounds

## 📌 About

Private asset workspace for sounds (kind `sound`). A sound asset is an Ogg file (`.ogg`) that the sound editor plays.

- Dropping a `.wav`, `.mp3`, `.flac`, `.m4a` or `.aac` file in the studio converts it to Ogg Opus with [Mediabunny](https://mediabunny.dev/). The original file is not kept. A dropped `.ogg` file is stored as is.
- In a browser build the conversion encodes through WebCodecs. Elsewhere the `#opus-encoder` import resolves to a module that loads `@mediabunny/server`, whose `node-av` dependency ships prebuilt FFmpeg libraries for each platform. When no Opus encoder is available, the conversion throws `OpusEncoderUnavailableError`.
- `pcm16WaveFile()` writes 16-bit PCM WAV content from a sample function. The tests and the sound editor's seed generate their sounds with it.
- Sounds are read-only and the studio's New asset menu does not offer them (`creatable: false`).
- A client reads a sound from its room snapshot: `soundDocumentKind()` from `@jolly-pixel/asset.sound/client` gives a `SoundDocument` whose `bytes` are `null` until the snapshot arrives.

Browser code imports `@jolly-pixel/asset.sound/client`. The package root loads Mediabunny only when a conversion runs. The runtime entry (`@jolly-pixel/asset.sound/runtime`) gives a game the `AudioSource`, `AudioListener` and `AudioZone` components.

## 🚀 Building

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/asset.sound build
```

Editors load the built `dist/` output, so rebuild after a change before running them.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/asset.sound test
$ pnpm --filter @jolly-pixel/asset.sound lint
```

Tests generate their WAV files instead of shipping audio binaries. The conversion test encodes through `@mediabunny/server`, so it needs the platform's `node-av` binary.

## License

MIT
