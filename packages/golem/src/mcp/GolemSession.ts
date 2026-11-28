// Import Internal Dependencies
import { Golem } from "../peer/Golem.ts";
import type { GolemTarget } from "../peer/GolemConnectOptions.ts";

export type GolemConnected = (golem: Golem) => void;

export class GolemSession {
  #target: GolemTarget;
  #connected: GolemConnected;
  #golem: Promise<Golem> | null = null;

  constructor(
    target: GolemTarget,
    connected: GolemConnected
  ) {
    this.#target = target;
    this.#connected = connected;
  }

  golem(): Promise<Golem> {
    this.#golem ??= Golem.connect(this.#target).then(
      (golem) => {
        this.#connected(golem);

        return golem;
      },
      (error: unknown) => {
        this.#golem = null;

        throw error;
      }
    );

    return this.#golem;
  }

  async dispose(): Promise<void> {
    const golem = this.#golem;
    this.#golem = null;
    const connected = await golem?.catch(() => null);
    connected?.dispose();
  }
}
