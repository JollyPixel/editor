# Animation set

Exported from `@jolly-pixel/asset.voxel-animation/client`. `AnimationDocument` is the editable set: its methods validate a command, apply it locally and emit a `change` with `origin: "local"`. `set` reads the result.

```ts
import {
  AnimationDocument,
  ClipSampler,
  FrameRate
} from "@jolly-pixel/asset.voxel-animation/client";

const document = new AnimationDocument();
const wave = document.addClip({ name: "Wave", loop: true })!;
const frames = new FrameRate(24);
document.setKey(wave, "Body/Arm.R", "rotation", {
  tick: 0,
  value: { x: 0, y: 0, z: 0 },
  interpolation: "smooth"
});
document.setKey(wave, "Body/Arm.R", "rotation", {
  tick: frames.toTick(12),
  value: { x: 0, y: 0, z: 90 },
  interpolation: "smooth"
});

const sampler = new ClipSampler(document.set.clip(wave)!);
sampler.sample(frames.toTick(6)).get("Body/Arm.R"); // { rotation: { x: 0, y: 0, z: 45 } }
```

## Data model

A set is `{ rig, clips }`. `rig` labels the hierarchy the set targets, such as `"Humanoid"`; it is free text and several sets can share it. Clips keep their order.

An `AnimationClipJSON` is `{ id, name, length, fps, loop, tracks }`. `length` is in ticks, `fps` is the frame grid the timeline snaps to, and `loop` tells a game to play the clip on repeat by default. Clip names compare trimmed and in any case.

A track is `{ path, position?, rotation?, scale? }`. `path` names a block by its name path, such as `Body/Arm.L`. Each channel holds keys in strictly rising tick order. A key is `{ tick, value: { x, y, z }, interpolation }`, with `interpolation` one of `"step"`, `"linear"` or `"smooth"`. A track exists while it has a key: removing its last key removes it.

Values are relative to the block's rest pose. Position is added, rotation is added per axis in degrees, so a key can spin several turns, and scale multiplies.

## Time

Times are integer ticks at `TICKS_PER_SECOND` (24000), whatever the clip's fps. Every frame of a valid fps is a whole tick, so changing a clip's fps never moves a key.

| Member | Description |
|---|---|
| `FrameRate.isValid(fps)` | Whether `fps` is a positive integer dividing 24000. A clip's fps must be. |
| `new FrameRate(fps)` | Throws a `RangeError` for an invalid fps. |
| `ticksPerFrame` | The ticks between two frames. |
| `toTick(frame)`, `toFrame(tick)` | Convert between frames and ticks. `toFrame` can return a fraction. |
| `frameAt(tick)` | The nearest whole frame. A clip's length gives its frame count. |
| `snap(tick)` | The tick of the nearest frame. |

## Paths and names

Track paths compare as a `TrackPath`: segment by segment, trimmed and in any case, so `body/arm.l` addresses the same track as `Body/Arm.L`. A track keeps the path it was first written with.

| Member | Description |
|---|---|
| `new TrackPath(path)` | Reads a path. |
| `path` | The path as written. |
| `key` | The normalized form paths compare by. |
| `equals(other)` | Takes a path string or another `TrackPath`. |
| `blockName` | The last segment, the block's own name. |
| `TrackPath.SEPARATOR` | `"/"`. |

`NameSet` holds names the way clip names and block names compare:

| Member | Description |
|---|---|
| `new NameSet(names)` | Holds the names. |
| `NameSet.keyOf(name)` | `name` trimmed and in lower case. |
| `has(name)` | Whether a name is taken. |
| `free(name)` | `name` trimmed when free, otherwise the first free `name 2`, `name 3`, replacing a trailing number. |

## Editing

| Method | Description |
|---|---|
| `renameRig(rig)` | Sets the rig label. |
| `addClip({ name, id?, length?, fps?, loop?, tracks?, beforeId? })` | Adds a clip and returns its ID, or `null`. It defaults to one second at 24 fps, not looping, with no tracks, last in the set. `tracks` are copied, so a clip can be copied from another set. |
| `removeClip(id)` | Removes a clip. |
| `changeClip(id, patch)` | Changes any of `name`, `length`, `fps` and `loop`. |
| `moveClip(id, beforeId?)` | Moves a clip before `beforeId`, or last. |
| `setKey(clipId, path, channel, key)` | Sets the key at `key.tick`, replacing one already there and creating the track when new. |
| `removeKey(clipId, path, channel, tick)` | Removes a key. |
| `removeTrack(clipId, path)` | Removes a track and its keys. |
| `renameTrack(clipId, path, to)` | Moves a track and its keys to `to`. Refused when another track holds `to` or the path is unchanged; a change of case only is a rename. |

The edit methods return `false`, and `addClip` `null`, when the set refuses the command.

## Reading the set

`document.set` is an `AnimationSetReader`. Reads return copies.

| Member | Description |
|---|---|
| `rig`, `size`, `has(id)` | The rig label and the clips. |
| `clip(id)`, `clips()`, `nextClipOf(id)` | Clips in their order. |
| `track(clipId, path)`, `keyAt(clipId, path, channel, tick)` | One track or one key. |
| `trackPaths()` | Every track path of the set once, as a clip first wrote it. |
| `clipNameTaken(name, exceptId?)`, `freeClipName(name)` | Clip name checks, as a `NameSet` does them. |
| `accepts(command)`, `placeable(command)` | Whether the set accepts a command, and the command without a `beforeId` that no longer names a clip. |
| `toJSON()` | The snapshot. |

## Sampling

`new KeyCurve(keys)` holds one channel's keys and throws a `RangeError` when their ticks do not strictly rise; `KeyCurve.isOrdered(keys)` checks that without throwing. `sample(tick)` returns the first key's value before it, the last key's after it, and between two keys follows the earlier key's interpolation: held for `step`, straight for `linear`, eased in and out for `smooth`. It returns `undefined` when there are no keys.

`new ClipSampler(clip)` builds the curves of a clip once; build it again after the clip changes.

| Member | Description |
|---|---|
| `length`, `loop` | The clip's. |
| `sample(tick)` | A map of `AnimationSample` `{ position?, rotation?, scale? }` per track path, without the channels a track lacks. |
| `tickAt(elapsed)` | The playhead `elapsed` ticks after the start: wrapped when `loop` is true, held at the ends otherwise. |
