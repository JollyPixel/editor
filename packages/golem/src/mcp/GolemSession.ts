// Import Internal Dependencies
import { Golem } from "../peer/Golem.ts";
import type { GolemTarget } from "../peer/GolemConnectOptions.ts";

export class GolemSession {
  #target: GolemTarget;
  #golem: Promise<Golem> | null = null;

  constructor(
    target: GolemTarget
  ) {
    this.#target = target;
  }

  golem(): Promise<Golem> {
    this.#golem ??= Golem.connect(this.#target).catch((error: unknown) => {
      this.#golem = null;

      throw error;
    });

    return this.#golem;
  }

  async dispose(): Promise<void> {
    const golem = this.#golem;
    this.#golem = null;
    const connected = await golem?.catch(() => null);
    connected?.dispose();
  }
}
