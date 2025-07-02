export class SoundPlayer {
  static State = {
    Playing: Symbol("playing"),
    Paused: Symbol("paused"),
    Stopped: Symbol("stopped")
  } as const;

  audioCtx: AudioContext;
  audioMasterGain: GainNode;
  buffer: string | AudioBuffer;
  source: AudioBufferSourceNode | MediaElementAudioSourceNode | null;
  gainNode: GainNode;
  pannerNode: StereoPannerNode;

  offset = 0;
  startTime: number;
  isLooping = false;
  state = SoundPlayer.State.Stopped;
  volume = 1;
  pitch = 0;
  pan = 0;

  constructor(
    audioCtx: AudioContext,
    audioMasterGain: GainNode,
    buffer: string | AudioBuffer
  ) {
    this.audioCtx = audioCtx;
    this.audioMasterGain = audioMasterGain;
    this.buffer = buffer;
  }

  destroy() {
    this.stop();
    this.audioCtx.close();
    this.audioMasterGain.disconnect();
  }

  play() {
    if (this.audioCtx === null || this.buffer === null) {
      return;
    }
    if (this.state === SoundPlayer.State.Playing) {
      return;
    }
    if (this.source !== null) {
      this.stop();
    }

    if (typeof this.buffer === "string") {
      const audio = new Audio();
      audio.src = this.buffer;
      this.source = this.audioCtx.createMediaElementSource(audio);
      if (this.source.mediaElement === null) {
        this.source = null;

        return;
      }
      this.source.mediaElement.loop = this.isLooping;
    }
    else {
      this.source = this.audioCtx.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.loop = this.isLooping;

      // NOTE: As of November 2015, playbackRate is not supported on MediaElementSources
      // so let's only apply it for buffer sources
      this.source.playbackRate.value = Math.pow(2, this.pitch);
    }

    this.pannerNode = this.audioCtx.createStereoPanner();
    this.pannerNode.pan.value = this.pan;
    this.pannerNode.connect(this.audioMasterGain);

    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.value = this.volume;
    this.gainNode.connect(this.pannerNode);

    this.source.connect(this.gainNode);

    this.state = SoundPlayer.State.Playing;
    this.source.addEventListener("ended", () => {
      this.state = SoundPlayer.State.Stopped;
    });

    this.startTime = this.audioCtx.currentTime - this.offset;

    if (this.source instanceof AudioBufferSourceNode) {
      this.source.start(0, this.offset);
    }
    else {
      this.source.mediaElement.currentTime = this.offset;
      this.source.mediaElement.play();
    }
  }

  stop() {
    if (this.audioCtx === null) {
      return;
    }

    if (this.source !== null) {
      if (this.source instanceof AudioBufferSourceNode) {
        this.source.stop(0);
      }
      else {
        this.source.mediaElement.pause();
        this.source.mediaElement.currentTime = 0;
      }

      this.source.disconnect();
      this.gainNode.disconnect();
      this.pannerNode.disconnect();
    }

    this.offset = 0;
    this.state = SoundPlayer.State.Stopped;
  }

  pause() {
    if (this.audioCtx === null || this.source === null) {
      return;
    }

    this.offset = this.audioCtx.currentTime - this.startTime;

    if (this.source instanceof AudioBufferSourceNode) {
      this.source.stop();
    }
    else {
      this.source.mediaElement.pause();
    }

    this.source.disconnect();
    this.gainNode.disconnect();
    this.pannerNode.disconnect();

    this.state = SoundPlayer.State.Paused;
  }

  getState(): typeof SoundPlayer.State[keyof typeof SoundPlayer.State] {
    if (this.state === SoundPlayer.State.Playing) {
      if (this.source instanceof MediaElementAudioSourceNode && this.source.mediaElement.paused) {
        this.state = SoundPlayer.State.Paused;
      }

      // if (this.source.playbackState !== null && this.source.playbackState === this.source.FINISHED_STATE) {
      //   this.state = SoundPlayer.State.Stopped;
      // }
    }

    return this.state;
  }

  setLoop(
    isLooping: boolean
  ) {
    this.isLooping = isLooping;
    if (this.source === null) {
      return;
    }

    if (this.source instanceof AudioBufferSourceNode) {
      this.source.loop = this.isLooping;
    }
    else if (this.source.mediaElement !== null) {
      this.source.mediaElement.loop = this.isLooping;
    }
  }

  setVolume(
    volume: number
  ) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.source !== null) {
      this.gainNode.gain.value = this.volume;
    }
  }

  setPan(
    pan: number
  ) {
    this.pan = Math.max(-1, Math.min(1, pan));
    if (this.source !== null) {
      this.pannerNode.pan.value = this.pan;
    }
  }

  setPitch(
    pitch: number
  ) {
    this.pitch = Math.max(-1, Math.min(1, pitch));

    if (
      this.source !== null &&
      this.source instanceof AudioBufferSourceNode &&
      this.source.playbackRate !== undefined
    ) {
      this.source.playbackRate.value = Math.pow(2, this.pitch);
    }
  }
}
