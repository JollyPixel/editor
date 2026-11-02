export class FakeGainNode {
  gain = {
    value: 1,
    setTargetAtTime: (target: number) => {
      this.gain.value = target;
    }
  };

  connect(): void {
    return undefined;
  }

  disconnect(): void {
    return undefined;
  }
}

export class FakeSourceNode extends EventTarget {
  buffer: AudioBuffer | null = null;
  loop = false;
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
    _when: number,
    offset: number
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
  output = new FakeGainNode();
  sources: FakeSourceNode[] = [];
  decoded = fakeBuffer([new Float32Array(88_200)]);

  createGain(): FakeGainNode {
    return this.output;
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
