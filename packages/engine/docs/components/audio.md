# Audio components

Scene components that play [sounds](../audio/audio.md) through
`world.audio`. In a scene file their types are `AudioSource`, `AudioListener`
and `AudioZone`, each with an optional `sound` asset slot except the listener.

## AudioSourceComponent

Plays one sound, by default from the actor position. A new `play()` stops the
previous one.

```ts
const speaker = actor.addComponentAndGet(AudioSourceComponent, {
  sound: jukebox,
  playOnStart: true
});
speaker.play({ fadeIn: 2 });
```

```ts
interface AudioSourceOptions {
  sound?: Sound | null;
  // play from the actor position, default true
  spatial?: boolean;
  // play when the component starts, default false
  playOnStart?: boolean;
  // multiplies the sound volume, in [0, 1], default 1
  volume?: number;
  // hex color editors draw the source with, default "#38bdf8"
  color?: string;
}

class AudioSourceComponent {
  sound: Sound | null;
  readonly settings: Readonly<AudioSourceSettings>;
  readonly instance: SoundInstance | null;
  readonly playing: boolean;

  configure(options: Omit<AudioSourceOptions, "sound">): this;
  play(options?: SoundPlayOptions): SoundInstance | null;
  stop(options?: { fade?: number }): void;
  pause(): void;
  resume(): void;
}
```

`AudioSourceDefinition` never plays on start in edit mode. Playback ignores
`color`.

## AudioListenerComponent

Moves the world listener onto the actor, so positional sounds are heard from
there. It takes no options. Destroying the component detaches the listener.
`CameraComponent` attaches the listener to its camera when
`addAudioListener` is set.

## AudioZoneComponent

A box or sphere around the actor, in its local units, that reacts to a
target: the audio listener, or the actor named by `target`.

- `"ambient"` loops the sound while the target is inside, and fades it out
  over `falloff` world units outside the zone.
- `"trigger"` plays the sound when the target enters, and stops it when the
  target leaves if `stopOnExit` is set.

Both modes emit `entered` and `exited` with the target actor, or `null` for
the listener, so a zone without a sound works as a plain trigger for scripts.

```ts
const zone = actor.getComponent(AudioZoneComponent);
zone.entered.connect((target) => {
  console.log(`${target?.name ?? "listener"} entered`);
});
```

```ts
interface AudioZoneOptions {
  sound?: Sound | null;
  // default "ambient"
  mode?: "ambient" | "trigger";
  // default "box"
  shape?: "box" | "sphere";
  // full box size, default { x: 4, y: 4, z: 4 }
  size?: Vector3Like;
  // sphere radius, default 2
  radius?: number;
  // ambient fade distance, default 2
  falloff?: number;
  // actor name or path, "" for the listener, default ""
  target?: string;
  // default true
  stopOnExit?: boolean;
  // multiplies the sound volume, in [0, 1], default 1
  volume?: number;
  // hex color of the edit-mode outline, default "#38bdf8"
  color?: string;
}

class AudioZoneComponent {
  readonly entered: SignalEvent<[target: Actor | null]>;
  readonly exited: SignalEvent<[target: Actor | null]>;
  sound: Sound | null;
  readonly settings: Readonly<AudioZoneSettings>;
  readonly shape: AudioZoneShape;
  readonly inside: boolean;
  readonly instance: SoundInstance | null;

  configure(options: Partial<AudioZoneSettings>): this;
}

class AudioZoneShape {
  constructor(settings: AudioZoneShapeSettings);
  // world distance from the point to the zone, 0 inside
  distanceTo(point: THREE.Vector3, matrixWorld: THREE.Matrix4): number;
  outline(): THREE.BufferGeometry;
}
```

In edit mode, `AudioZoneDefinition` creates an `AudioZoneOutline` that draws
the zone in its `color` instead of a live zone.
