# Scene and sound editors, 3 November 2026

What it costs to open the two newest editors from the studio, what they cost once open, and three experiments to make the open shorter. Measured at `f025a676` on a built studio served by [`perf/serveBuild.ts`](../../perf/serveBuild.ts). The method and the tools are in [Benchmarking editor opens](./benchmarking.md).

The machine ran in its slow state: a fresh browser's first `requestAdapter` took 698 ms before the main run and 617 ms after it (322 ms in October). Do not compare these times with the October reports. The main run is four interleaved rounds of three variants, online and offline ([plan](./editor-open-2026-11-03.json)); tables give `ready` medians in milliseconds.

## Summary

- A sound open takes 610 to 640 ms offline and 760 to 840 ms online, warm or cold. pixel-art, the other editor without a 3D runtime, opens in 110 to 200 ms on the same build. About 440 to 480 ms of the sound open is `decodeAudioData` of the whole file before the editor reports `ready`.
- Reporting `ready` once the sound document has loaded, and decoding afterwards, takes a sound open to 120 to 260 ms warm (−393 to −532 ms). The decode still ends at the same time.
- Online, the sound snapshot is a 2.1 MB base64 frame that the studio deflates for a 25% saving. Without deflate the `host.session:target` step goes from 152 to 32 ms on localhost, and an online sound open gets 128 to 225 ms faster; over a real link the deflate saves more than it costs.
- A scene open takes about 300 to 345 ms warm and 590 to 630 ms cold. Half of a warm open is the first-frame pipeline compile (160 to 170 ms, 20 shader modules); turning off the default sun's shadow map changes nothing.
- Once open, neither editor costs anything worth fixing: sound uses 14 ms/s of main thread, and scene stops rendering 2 s after the last input like the voxel editors.
- `dev:e2e` now serves every editor page unbundled, about 250 modules and 24 MB of JavaScript for a scene open. Earlier results came from built pages; this run moved to a built studio.

## Measurement setup

Since the multi-page studio build of 17 October, `dev:e2e` compiles the editor pages from source through Vite. A scene open under `dev:e2e` makes about 250 requests, mostly `node_modules/.vite/deps` and `/@fs/` modules, and transfers 5 MB cold. On the built studio it makes 75 to 82 requests and transfers 417 KB offline and 577 KB online. Every number below comes from `pnpm exec vite build` served by `serveBuild.ts` with the in-memory back-end and accounts of `dev:e2e`.

The seed project has neither kind, so the harness creates `New scene.scene.json` from the New asset menu and drops `packages/editors/sound/assets/sounds/chime.ogg` on the Asset Browser before the first open. That path is gitignored: the sound dev server seeds a generated chime of about 1.6 s there, but this run used a local 190 s track of 48 kHz stereo Opus, 1.6 MB, put at the same path. A new scene holds a camera, a shadow-casting directional light and a hemisphere light.

## Opening an editor

`control` variant of the main run:

| Editor | Mode | first | cold | reload | reopen |
|---|---|---|---|---|---|
| scene | offline | 570 | 587 | 298 | 320 |
| scene | online | 542 | 630 | 313 | 344 |
| sound | offline | 620 | 613 | 619 | 635 |
| sound | online | 842 | 825 | 792 | 760 |

For reference, one round of pixel-art on the same build: 110 ms (`reload`) and 191 ms (`cold`) offline, 113 and 201 ms online.

Scene `first` has a p90 of 911 to 920 ms: one `first` open in four took about 350 ms longer. It was not investigated.

### Sound

Boot steps of a cold open, start → end in milliseconds from the double-click:

| Step | offline | online |
|---|---|---|
| `host.session:target` | 97 → 125 | 126 → 286 |
| `host.boot:mount` | 125 → 176 | 286 → 345 |
| `host.boot:ready` | 176 → 612 | 346 → 825 |

`ready` waits for `SoundPlayer.follow()`, which decodes the whole file with `decodeAudioData`. The main thread is idle during the decode; Chrome decodes off-thread, so the cost grows with the sound's length and not with the page's work. In a CPU profile of a reload, the main thread spends 47 ms creating the `AudioContext` during mount and 37 ms in `DecodedSound.waveform()` after the decode.

`waveform()` reads every sample of every channel on each call, 9.1 million frames for the seed sound. `SoundWave` calls it on every `ResizeObserver` callback and theme change, so dragging a dock splitter next to the track runs that 37 ms loop on each resize step (from the code, not measured).

The decoded `AudioBuffer` holds 32-bit floats: 9.1 million frames × 2 channels × 4 bytes = 73 MB for the seed sound, and `DecodedSound` keeps a reversed copy of the same size once a reversed playback has started (computed, not measured).

Online, the snapshot carries the Ogg file as base64 in a JSON frame of 2.1 MB. `StudioBackend` enables permessage-deflate above 1 KB since October, for the blockset atlas. On Opus data it saves only the base64 overhead: in Node, `deflateRawSync` takes 67 ms and makes 1.64 MB of 2.18 MB, and inflating takes 14 ms.

### Scene

Boot steps, start → end in milliseconds from the double-click:

| Step | offline reload | online reload | offline cold | online cold |
|---|---|---|---|---|
| `editor.runtime:renderer` | 60 → 95 | 60 → 97 | 117 → 170 | 161 → 215 |
| `host.session:target` | 95 → 102 | 82 → 85 | 199 → 208 | 222 → 234 |
| `editor.runtime:device` | 104 → 117 | 102 → 117 | 214 → 319 | 239 → 346 |
| `host.boot:mount` | 102 → 137 | 85 → 141 | 208 → 359 | 234 → 383 |
| `host.boot:compile` | 137 → 298 | 141 → 313 | 359 → 586 | 383 → 629 |

- A cold open waits about 105 ms for the first WebGPU device of the new context; a warm one 13 to 15 ms.
- `compile` is half of a warm open. A trace of a warm online open shows 20 shader modules compiled with DXC (16 on worker threads, 251 ms in total), 8 `createRenderPipelineAsync` calls and one synchronous `createRenderPipeline` of 22 ms on the GPU main thread.
- `editor:metrics` runs past the end of mount and does not delay `ready`.

## An open editor

`steadyState.ts`, online, two rounds of 5 s per scenario, medians:

| Editor | Scenario | main thread ms/s | MB/s | renders/s | idle % |
|---|---|---|---|---|---|
| scene | away | 18.5 | 0 | 0 | 100 |
| scene | hover | 32 | 0.5 | 9.3 | 70 |
| scene | orbit | 84 | 1.9 | 31.2 | 0 |
| scene | panels | 64.5 | 1.4 | 31 | 0 |
| sound | away | 14 | 0 | 0 | 100 |
| sound | hover | 14 | 0 | 0 | 100 |
| sound | orbit | 21.5 | 0 | 0 | 100 |
| sound | panels | 15.5 | 0 | 0 | 100 |

Scene keeps rendering in `panels` because the pointer moves every 400 ms, within the runtime's 2 s `idleDelay`, the same trade-off the voxel editors accepted in October. No frame took longer than 18 ms.

## Experiments

[`editor-open-2026-11-03.patch`](./editor-open-2026-11-03.patch) holds the code of every variant and applies to `f025a676`:

- `flags`: `bench:sound-early-ready` resolves the sound editor's `ready` when the document has loaded and lets `player.follow()` decode afterwards; `bench:scene-no-shadows` turns off `castShadow` in the engine's `LightComponent`. Each flag only touches one editor, so both ran in one variant.
- `no-deflate`: the same build served on port 3014 with `BENCH_NO_SOCKET_COMPRESSION=1`, which drops `compression` from `StudioBackend.attach`.

Sound, `ready` medians and their difference to `control`:

| Mode | Phase | `control` | `flags` | `no-deflate` |
|---|---|---|---|---|
| offline | first | 620 | 227 (−393) | 622 |
| offline | cold | 613 | 174 (−439) | 619 |
| offline | reload | 619 | 140 (−479) | 677 |
| offline | reopen | 635 | 121 (−514) | 623 |
| online | first | 842 | 350 (−492) | 617 (−225) |
| online | cold | 825 | 329 (−496) | 685 (−140) |
| online | reload | 792 | 260 (−532) | 643 (−149) |
| online | reopen | 760 | 241 (−519) | 632 (−128) |

With the early `ready`, `settled` stays within 100 ms of `control` (offline reload 620 → 658, online reload 793 → 717). The decode result arrives in one long frame of 67 to 92 ms after `ready`, which holds the 37 ms waveform pass. Offline, `no-deflate` serves as a second control; the 58 ms on offline `reload` is noise.

Scene with `bench:scene-no-shadows`: every phase stays within 25 ms of `control`, in both directions. The shadow pipelines are not what the compile step waits for.

## Recommendations

In order of gain per effort, on this machine.

| # | Change | Where | Gain | Effort |
|---|---|---|---|---|
| 1 | Report `ready` once the sound document has loaded; decode in the background and show a decoding state on the track until it ends | `editor.sound` `SoundEditor`, `SoundPlayer`, `SoundWave` | −393 to −532 ms on every sound open (measured) | low |
| 2 | Send media content as binary frames instead of base64 inside JSON, so deflate has nothing left to win on it | `network` wire format and every transport, asset snapshot schemas, `asset.sound` | −128 to −225 ms on online sound opens on localhost (measured without deflate), 25% fewer bytes over a real link | high |
| 3 | Compute the waveform peaks once per decoded sound at a fixed resolution and scale them per draw | `editor.sound` `DecodedSound` | 16 to 46 ms → 0.1 ms per redraw, on resize and theme change (measured in Node) | low |

Rec 1 needs `SoundPlayer` to refuse `play()` until the decode ends; the editor otherwise behaves as today. With rec 1 built, rec 2 still shortens `ready` online, since the snapshot arrives before `ready`.

Turning deflate off is not the fix for rec 2: it only wins on localhost. Deflate takes the frame from 2.18 to 1.64 MB, about 0.5 s at the 9 Mbit/s of the fast 4G preset, against about 80 ms of server and client CPU. Binary frames get both, but every transport, the message parser and the snapshot schemas carry JSON strings today, so it is a wire protocol change.

## Built after the report

Recs 1 and 3 were built on 3 November, after the measurements above:

- `SoundPlayer` switches to a `decoding` status before it awaits `decodeAudioData`; `play()` does nothing and the track shows "Decoding the sound…" until the decode ends. `SoundEditor` no longer waits for `follow()` in `ready`.
- `WaveformPeaks` scans the decoded sound once into at most 8,192 min/max buckets; each redraw builds its columns from the buckets. In Node, on a buffer the size of the 190 s track at 1,600 columns, the old pass took 16 to 46 ms per redraw; the new one takes 15 ms once, then 0.1 ms per redraw.

Three interleaved rounds against `f025a676` served on port 3014 ([plan](./editor-open-2026-11-03-sound.json)), `ready` medians:

| Mode | Phase | `f025a676` | built |
|---|---|---|---|
| offline | first | 682 | 274 (−408) |
| offline | cold | 615 | 182 (−433) |
| offline | reload | 939 | 175 (−764) |
| online | first | 829 | 403 (−426) |
| online | cold | 788 | 344 (−444) |
| online | reload | 851 | 351 (−500) |

The editor is usable 400 to 760 ms sooner. The waveform appears later than before: the `settled` medians, which end with the paint of the decoded sound, are 108 to 213 ms later in five of the six cells, with a spread of 583 to 1,230 ms across rounds. In offline `reload`, two of three opens painted the decoded sound without a long frame, so `settled` did not see it. The cause was not investigated.

Not worth doing now:

- Scene shadows: measured, no gain.
- Scene compile wait: 20 shader modules for the default new scene. Only fewer distinct pipelines would shorten it.
- Creating the `AudioContext` lazily: 47 ms of mount, but `decodeAudioData` needs a context, so it moves the cost rather than removing it.

Leads, not measured:

- Memory of long sounds: 73 MB of decoded samples for the 190 s seed, twice that after a reversed playback. A ten-minute stereo track would hold about 230 MB. Streaming playback through a media element, with peaks computed at import, would avoid holding the samples.
- Peaks computed by the asset kind at import time would let the track draw before any decode.

## Limits

- One machine: Intel Core Ultra 9 285HX laptop, integrated Xe-LPG GPU, Windows 11 Pro 26200, Playwright 1.64.1 with Chromium 156.0.8078.4 headed, Node.js 24.18. The machine ran in its slow state.
- The studio ran on localhost; network throttling was not used.
- One scene (the default new scene) and one sound (the 190 s seed). The sound decode grows with the length of the sound; a short effect decodes much faster.
- The CPU profile of the sound reload and the scene trace are single recordings; the profile ran against `dev:e2e` before the move to a built studio, so its absolute times include unbundled modules.
- The steady-state table has two rounds per scenario.
