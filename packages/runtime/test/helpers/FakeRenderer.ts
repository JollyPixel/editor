export class FakeAnimationRenderer {
  readonly info = {
    render: {
      drawCalls: 0,
      triangles: 0
    },
    memory: {
      geometries: 0,
      textures: 0,
      attributesSize: 0,
      indexAttributesSize: 0,
      texturesSize: 0
    }
  };

  #loop: ((time: number) => void) | null = null;

  get looping(): boolean {
    return this.#loop !== null;
  }

  setAnimationLoop(
    callback: ((time: number) => void) | null
  ): void {
    this.#loop = callback;
  }

  tick(
    time: number
  ): void {
    this.#loop?.(time);
  }
}

type Listener = (...args: any[]) => void;

export class FakeRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly source = new FakeAnimationRenderer();
  readonly renderComponents = [];
  draws = 0;

  #listeners = new Map<string, Set<Listener>>();

  constructor(
    canvas: HTMLCanvasElement
  ) {
    this.canvas = canvas;
  }

  on(
    type: string,
    listener: Listener
  ): this {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);

    return this;
  }

  off(
    type: string,
    listener: Listener
  ): void {
    this.#listeners.get(type)?.delete(listener);
  }

  emit(
    type: string,
    ...payload: unknown[]
  ): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(...payload);
    }
  }

  getSource(): FakeAnimationRenderer {
    return this.source;
  }

  observeResize(): void {
    return;
  }

  unobserveResize(): void {
    return;
  }

  draw(): void {
    this.draws++;
    this.emit("draw");
  }

  clear(): void {
    return;
  }

  dispose(): void {
    return;
  }
}
