---
"@jolly-pixel/engine": major
---

`world.audio` plays `Sound` assets (settings kept in the Ogg header, read and written with `Systems.OggHeader`) through an `AudioMixer`, with voice limits, fades and positional sound.
`GlobalAudioManager`, `AUDIO_ASSET` and `threeAudioListener` are removed; `AudioBackground` takes `audio`, sound tracks and `crossfade`.
Adds the `AudioSource`, `AudioListener` and `AudioZone` components (with an editor `color` tag) and `Sound` script properties.
