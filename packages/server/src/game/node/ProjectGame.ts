// Import Third-party Dependencies
import type { Member } from "@jolly-pixel/accounts";
import { AssetRoom } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { Project } from "../../project/node/Project.ts";
import {
  PlayableGame,
  type GameBackend
} from "../PlayableGame.ts";

export interface ProjectGameOptions {
  project: Pick<Project, "access" | "physics">;
  backend: GameBackend;
}

export class ProjectGame {
  #project: Pick<Project, "access" | "physics">;
  #backend: GameBackend;

  constructor(
    options: ProjectGameOptions
  ) {
    this.#project = options.project;
    this.#backend = options.backend;
  }

  playable(
    account: Member
  ): PlayableGame {
    const { access, physics } = this.#project;

    return new PlayableGame({
      backend: this.#backend,
      physics,
      opens: (record) => access.opens(
        account.role,
        new AssetRoom(record.kind, record.id).toString()
      )
    });
  }
}
