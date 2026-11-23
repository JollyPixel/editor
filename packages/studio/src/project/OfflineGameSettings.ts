// Import Third-party Dependencies
import * as z from "zod";
import {
  DEFAULT_PROJECT_SECTIONS,
  gameSectionSchema,
  physicsSectionSchema,
  type GameSection,
  type PhysicsSection
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { GAME_CHANGE } from "./StudioProjectSettings.ts";

// CONSTANTS
export const OFFLINE_GAME_CHANGE = "offline-game-change";
const kStoragePrefix = "jolly-pixel:offline-game:";
const kSectionsSchema = z.object({
  game: gameSectionSchema.catch(DEFAULT_PROJECT_SECTIONS.game),
  physics: physicsSectionSchema.catch(DEFAULT_PROJECT_SECTIONS.physics)
});

export interface OfflineGameSections {
  readonly game: GameSection;
  readonly physics: PhysicsSection;
}

export class OfflineGameSettings extends EventTarget {
  readonly name: string;

  #key: string;
  #sections: OfflineGameSections;

  constructor(
    name: string
  ) {
    super();
    this.name = name;
    this.#key = `${kStoragePrefix}${name}`;
    this.#sections = this.#read();
    globalThis.window?.addEventListener("storage", (event) => {
      if (event.key === this.#key) {
        this.#apply(this.#read());
      }
    });
  }

  get game(): GameSection {
    return this.#sections.game;
  }

  get physics(): PhysicsSection {
    return this.#sections.physics;
  }

  update(
    sections: Partial<OfflineGameSections>
  ): void {
    const next = {
      ...this.#sections,
      ...sections
    };
    try {
      window.localStorage.setItem(this.#key, JSON.stringify(next));
    }
    catch {
    }
    this.#apply(next);
  }

  #apply(
    sections: OfflineGameSections
  ): void {
    const started = sections.game.start !== this.#sections.game.start;
    this.#sections = sections;
    if (started) {
      this.dispatchEvent(new Event(GAME_CHANGE));
    }
    this.dispatchEvent(new Event(OFFLINE_GAME_CHANGE));
  }

  #read(): OfflineGameSections {
    return kSectionsSchema.parse(parseJson(readStorage(this.#key)) ?? {});
  }
}

function readStorage(
  key: string
): string | null {
  try {
    return window.localStorage.getItem(key);
  }
  catch {
    return null;
  }
}

function parseJson(
  text: string | null
): unknown {
  if (text === null) {
    return null;
  }

  try {
    return JSON.parse(text);
  }
  catch {
    return null;
  }
}
