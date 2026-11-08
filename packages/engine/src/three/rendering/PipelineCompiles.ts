export interface PipelineBackend {
  createRenderPipeline(
    renderObject: unknown,
    promises: Promise<void>[] | null
  ): void;
}

export class PipelineCompiles {
  static isBackend(
    backend: unknown
  ): backend is PipelineBackend {
    return typeof backend === "object" &&
      backend !== null &&
      "createRenderPipeline" in backend &&
      typeof backend.createRenderPipeline === "function";
  }

  #pending = 0;
  #settled: PromiseWithResolvers<void> | null = null;
  #onSettled: () => void;

  constructor(
    backend: PipelineBackend,
    onSettled: () => void
  ) {
    this.#onSettled = onSettled;

    const create = backend.createRenderPipeline.bind(backend);
    backend.createRenderPipeline = (renderObject, promises) => {
      const compiles = promises ?? [];
      const queued = compiles.length;
      create(renderObject, compiles);
      for (let index = queued; index < compiles.length; index++) {
        this.#track(compiles[index]);
      }
    };
  }

  get pending(): number {
    return this.#pending;
  }

  settled(): Promise<void> {
    if (this.#pending === 0) {
      return Promise.resolve();
    }
    this.#settled ??= Promise.withResolvers<void>();

    return this.#settled.promise;
  }

  #track(
    compile: Promise<void>
  ): void {
    this.#pending++;
    const done = () => {
      this.#pending--;
      if (this.#pending > 0) {
        return;
      }
      this.#settled?.resolve();
      this.#settled = null;
      this.#onSettled();
    };
    compile.then(done, done);
  }
}
