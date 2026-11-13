// Import Internal Dependencies
import type {
  GolemAssets,
  GolemKind
} from "../assets/kinds.ts";
import {
  Golem,
  type GolemKindFilter
} from "../peer/Golem.ts";
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

  async open<TKind extends GolemKind = GolemKind>(
    assetId: string,
    kind?: GolemKindFilter<TKind>
  ): Promise<GolemAssets[TKind]> {
    const golem = await this.golem();

    return golem.open(assetId, kind);
  }

  async dispose(): Promise<void> {
    const golem = this.#golem;
    this.#golem = null;
    const connected = await golem?.catch(() => null);
    connected?.dispose();
  }
}
