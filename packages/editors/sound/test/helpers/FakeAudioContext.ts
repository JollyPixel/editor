export class FakeAudioParam {
  value: number;

  constructor(
    value: number
  ) {
    this.value = value;
  }

  setTargetAtTime(
    target: number
  ): void {
    this.value = target;
  }

  setValueAtTime(
    value: number
  ): void {
    this.value = value;
  }

  cancelScheduledValues(): void {
    return undefined;
  }
}

export class FakeAudioNode {
  outputs: unknown[] = [];

  connect(
    target: unknown
  ): void {
    this.outputs.push(target);
  }

  disconnect(): void {
    this.outputs = [];
  }
}

export class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam(1);
}

export class FakePannerNode extends FakeAudioNode {
  panningModel: PanningModelType = "equalpower";
  distanceModel: DistanceModelType = "inverse";
  refDistance = 1;
  maxDistance = 10_000;
  rolloffFactor = 1;
  positionX = new FakeAudioParam(0);
  positionY = new FakeAudioParam(0);
  positionZ = new FakeAudioParam(0);
}

export class FakeSourceNode extends EventTarget {
  buffer: AudioBuffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  playbackRate = {
    value: 1
  };
  offset: number | null = null;
  stopped = false;

  connect(): void {
    return undefined;
  }

  disconnect(): void {
    return undefined;
  }

  start(
    _when = 0,
    offset = 0
  ): void {
    this.offset = offset;
  }

  stop(): void {
    this.stopped = true;
  }

  end(): void {
    this.dispatchEvent(new Event("ended"));
  }
}

export class FakeAudioContext extends EventTarget {
  state: AudioContextState = "running";
  currentTime = 0;
  destination = {};
  gains: FakeGainNode[] = [];
  sources: FakeSourceNode[] = [];
  panners: FakePannerNode[] = [];
  decoded = fakeBuffer([new Float32Array(88_200)]);

  get output(): FakeGainNode {
    return this.gains[0];
  }

  get level(): FakeGainNode {
    return this.gains[1];
  }

  get spatialInput(): FakeGainNode {
    return this.gains[2];
  }

  get panner(): FakePannerNode {
    return this.panners[0];
  }

  createPanner(): FakePannerNode {
    const panner = new FakePannerNode();
    this.panners.push(panner);

    return panner;
  }

  createGain(): FakeGainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);

    return gain;
  }

  createBuffer(
    numberOfChannels: number,
    length: number,
    sampleRate: number
  ): AudioBuffer {
    return fakeBuffer(
      Array.from(
        { length: numberOfChannels },
        () => new Float32Array(length)
      ),
      sampleRate
    );
  }

  decodeAudioData(
    _data: ArrayBuffer
  ): Promise<AudioBuffer> {
    return Promise.resolve(this.decoded);
  }

  createBufferSource(): FakeSourceNode {
    const source = new FakeSourceNode();
    this.sources.push(source);

    return source;
  }

  resume(): Promise<void> {
    return Promise.resolve();
  }

  start(): void {
    this.state = "running";
    this.dispatchEvent(new Event("statechange"));
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  asAudioContext(): AudioContext {
    return this as unknown as AudioContext;
  }
}

export function fakeBuffer(
  channels: Float32Array[],
  sampleRate = 44_100
): AudioBuffer {
  const { length } = channels[0];
  const buffer = {
    sampleRate,
    length,
    duration: length / sampleRate,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => channels[channel]
  };

  return buffer as AudioBuffer;
}
