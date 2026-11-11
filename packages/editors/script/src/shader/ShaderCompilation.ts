// Import Third-party Dependencies
import type { ScriptDocument } from "@jolly-pixel/asset.script/client";
import {
  loadShader,
  type ShaderModule
} from "@jolly-pixel/scripting/three";

export interface ShaderCompilationOptions {
  document: Pick<ScriptDocument, "text" | "subscribe">;
  name: () => string;
  compiled: (
    shader: ShaderModule,
    signal: AbortSignal
  ) => Promise<void> | void;
  failed: (error: unknown) => void;
}

// CONSTANTS
const kCompileDelayMs = 300;

export class ShaderCompilation {
  #options: ShaderCompilationOptions;
  #unsubscribe: () => void;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #run: AbortController | null = null;

  constructor(
    options: ShaderCompilationOptions
  ) {
    this.#options = options;
    this.#unsubscribe = options.document.subscribe("change", () => {
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => void this.#compile(), kCompileDelayMs);
    });
    void this.#compile();
  }

  dispose(): void {
    clearTimeout(this.#timer);
    this.#unsubscribe();
    this.#run?.abort();
  }

  async #compile(): Promise<void> {
    this.#run?.abort();
    const run = new AbortController();
    this.#run = run;
    const { document, name, compiled, failed } = this.#options;
    try {
      const shader = await loadShader(document.text, name());
      if (!run.signal.aborted) {
        await compiled(shader, run.signal);
      }
    }
    catch (error) {
      if (!run.signal.aborted) {
        failed(error);
      }
    }
  }
}
