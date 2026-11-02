export class FakeSourceNode extends EventTarget {
  buffer: AudioBuffer | null = null;
  loop = false;
  stopped = false;

  connect(): void {
    return undefined;
  }

  disconnect(): void {
    return undefined;
  }

  start(): void {
    return undefined;
  }

  stop(): void {
    this.stopped = true;
  }

  end(): void {
    this.dispatchEvent(new Event("ended"));
  }
}

export class FakeAudioContext {
  currentTime = 0;
  destination = {};
  sources: FakeSourceNode[] = [];
  decoded = fakeBuffer([new Float32Array(88_200)]);

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
