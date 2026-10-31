// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// Import Third-party Dependencies
import {
  test,
  expect,
  type Page,
  type TestInfo
} from "@playwright/test";

// Import Internal Dependencies
import { VoxelMapPage } from "./voxelMap.ts";
import {
  MapArchive,
  type MapExpectation
} from "./MapArchive.ts";

// CONSTANTS
const kCheckpointRoot = path.join(
  import.meta.dirname,
  "../../../node_modules/.cache/scenario"
);
const kChapterTimeout = 45_000;
const kStep = { timeout: kChapterTimeout };
const kSettleTimeout = 15_000;

export interface Chapter {
  id: string;
  title: string;
  play: (map: VoxelMapPage) => Promise<void>;
  expected: MapExpectation;
}

export interface ScenarioOptions {
  id: string;
  title: string;
  chapters: Chapter[];
}

export class Scenario {
  readonly #id: string;
  readonly #title: string;
  readonly #chapters: readonly Chapter[];

  constructor(
    options: ScenarioOptions
  ) {
    this.#id = options.id;
    this.#title = options.title;
    this.#chapters = options.chapters;
  }

  register(): void {
    test(this.#title, async({ page }, testInfo) => {
      const start = this.#startIndex(process.env.SCENARIO_FROM);
      test.setTimeout((this.#chapters.length - start + 1) * kChapterTimeout);

      const run = new ScenarioRun(page, testInfo, this.#folder);
      await run.begin(this.#chapters[start - 1]);
      for (const chapter of this.#chapters.slice(start)) {
        await run.play(chapter);
      }
    });
  }

  get #folder(): string {
    return path.join(kCheckpointRoot, this.#id);
  }

  #startIndex(
    from: string | undefined
  ): number {
    if (from === undefined || from === "") {
      return 0;
    }

    const index = this.#chapters.findIndex((chapter) => chapter.id === from);
    if (index === -1) {
      const known = this.#chapters.map((chapter) => chapter.id).join(", ");
      throw new Error(`SCENARIO_FROM="${from}" names no chapter (${known}).`);
    }

    return index;
  }
}

class ScenarioRun {
  readonly #page: Page;
  readonly #map: VoxelMapPage;
  readonly #testInfo: TestInfo;
  readonly #folder: string;
  readonly #errors: string[] = [];

  constructor(
    page: Page,
    testInfo: TestInfo,
    folder: string
  ) {
    this.#page = page;
    this.#map = new VoxelMapPage(page);
    this.#testInfo = testInfo;
    this.#folder = folder;
    page.on("pageerror", (error) => this.#errors.push(error.message));
  }

  async begin(
    previous: Chapter | undefined
  ): Promise<void> {
    if (previous === undefined) {
      await test.step(
        "open a blank offline map",
        () => this.#map.openOffline(),
        kStep
      );

      return;
    }

    await test.step(`resume after "${previous.title}"`, async() => {
      await this.#map.openOffline();
      await this.#map.archives.importArchive(this.#checkpoint(previous));
      await this.#settle(previous);
    }, kStep);
  }

  async play(
    chapter: Chapter
  ): Promise<void> {
    await test.step(chapter.title, async() => {
      await chapter.play(this.#map);
      await this.#settle(chapter);
      await this.#testInfo.attach(`${chapter.id}.png`, {
        body: await this.#page.screenshot(),
        contentType: "image/png"
      });
    }, kStep);
  }

  async #settle(
    chapter: Chapter
  ): Promise<void> {
    const checkpoint = this.#checkpoint(chapter);
    await fs.mkdir(this.#folder, { recursive: true });

    await expect(async() => {
      const download = await this.#map.archives.exportArchive();
      await download.saveAs(checkpoint);
      const archive = MapArchive.read(await fs.readFile(checkpoint));

      expect(archive.describe(chapter.expected.cells)).toEqual(chapter.expected);
    }).toPass({ timeout: kSettleTimeout });
    expect(this.#errors).toEqual([]);
  }

  #checkpoint(
    chapter: Chapter
  ): string {
    return path.join(this.#folder, `${chapter.id}.zip`);
  }
}
