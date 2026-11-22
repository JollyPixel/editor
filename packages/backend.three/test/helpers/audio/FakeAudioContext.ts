// Import Third-party Dependencies
import * as THREE from "three/webgpu";

export interface ScheduledRamp {
  value: number;
  endTime: number;
}

export class FakeAudioParam {
  value: number;
  ramps: ScheduledRamp[] = [];

  constructor(
    value: number
  ) {
    this.value = value;
  }

  setValueAtTime(
    value: number
  ): this {
    this.value = value;

    return this;
  }

  setTargetAtTime(
    value: number
  ): this {
    this.value = value;

    return this;
  }

  linearRampToValueAtTime(
    value: number,
    endTime: number
  ): this {
    this.value = value;
    this.ramps.push({ value, endTime });

    return this;
  }

  cancelScheduledValues(): this {
    return this;
  }
}

export class FakeAudioNode extends EventTarget {
  readonly context: FakeAudioContext;
  readonly connections = new Set<FakeAudioNode>();

  constructor(
    context: FakeAudioContext
  ) {
    super();
    this.context = context;
  }

  connect(
    node: FakeAudioNode
  ): FakeAudioNode {
    this.connections.add(node);

    return node;
  }

  disconnect(
    node?: FakeAudioNode
  ): void {
    if (node === undefined) {
      this.connections.clear();
    }
    else {
      this.connections.delete(node);
    }
  }
}

export class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam(1);
}

export class FakePannerNode extends FakeAudioNode {
  readonly positionX = new FakeAudioParam(0);
  readonly positionY = new FakeAudioParam(0);
  readonly positionZ = new FakeAudioParam(0);
  readonly orientationX = new FakeAudioParam(0);
  readonly orientationY = new FakeAudioParam(0);
  readonly orientationZ = new FakeAudioParam(1);
  panningModel = "equalpower";
  distanceModel = "inverse";
  refDistance = 1;
  maxDistance = 10000;
  rolloffFactor = 1;
}

export class FakeBufferSource extends FakeAudioNode {
  readonly detune = new FakeAudioParam(0);
  readonly playbackRate = new FakeAudioParam(1);
  buffer: AudioBuffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  startedAt: number | null = null;
  stoppedAt: number | null = null;

  start(
    when = 0
  ): void {
    this.startedAt = when;
  }

  stop(
    when = 0
  ): void {
    this.stoppedAt = when;
  }

  end(): void {
    this.onended?.();
    this.dispatchEvent(new Event("ended"));
  }
}

export class FakeAudioListener {
  readonly positionX = new FakeAudioParam(0);
  readonly positionY = new FakeAudioParam(0);
  readonly positionZ = new FakeAudioParam(0);
  readonly forwardX = new FakeAudioParam(0);
  readonly forwardY = new FakeAudioParam(0);
  readonly forwardZ = new FakeAudioParam(-1);
  readonly upX = new FakeAudioParam(0);
  readonly upY = new FakeAudioParam(1);
  readonly upZ = new FakeAudioParam(0);
}

export class FakeAudioContext {
  currentTime = 0;
  readonly listener = new FakeAudioListener();
  state: AudioContextState = "running";
  readonly destination = new FakeAudioNode(this);
  readonly sources: FakeBufferSource[] = [];

  createGain(): FakeGainNode {
    return new FakeGainNode(this);
  }

  createPanner(): FakePannerNode {
    return new FakePannerNode(this);
  }

  createBufferSource(): FakeBufferSource {
    const source = new FakeBufferSource(this);
    this.sources.push(source);

    return source;
  }

  async resume(): Promise<void> {
    this.state = "running";
  }

  async suspend(): Promise<void> {
    this.state = "suspended";
  }
}

export function installFakeAudioContext(): FakeAudioContext {
  const context = new FakeAudioContext();
  THREE.AudioContext.setContext(context as unknown as THREE.AudioContext);

  return context;
}

export function fakeAudioBuffer(
  duration = 1
): AudioBuffer {
  return { duration } as AudioBuffer;
}

export function audibleGain(
  node: object
): number {
  if (!(node instanceof FakeAudioNode)) {
    throw new TypeError("Expected a node of the fake audio context.");
  }
  if (node === node.context.destination) {
    return 1;
  }

  const own = node instanceof FakeGainNode ? node.gain.value : 1;
  let loudest = 0;
  for (const next of node.connections) {
    loudest = Math.max(loudest, audibleGain(next));
  }

  return own * loudest;
}
