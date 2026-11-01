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
import {
  readAssetArchive,
  type AssetArchive
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { ArchiveConsole } from "./ArchiveConsole.ts";

// CONSTANTS
const kChapterTimeout = 45_000;
const kStep = { timeout: kChapterTimeout };
const kSettleTimeout = 15_000;

export interface ScenarioChapter<TEditor, TExpectation> {
  id: string;
  title: string;
  play: (editor: TEditor) => Promise<void>;
  expected: TExpectation;
}

export interface ScenarioOptions<TEditor, TExpectation> {
  id: string;
  title: string;
  open: (page: Page) => Promise<TEditor>;
  describe: (archive: AssetArchive, expected: TExpectation) => TExpectation;
  chapters: ScenarioChapter<TEditor, TExpectation>[];
}

export class Scenario<TEditor, TExpectation> {
  readonly #options: ScenarioOptions<TEditor, TExpectation>;

  constructor(
    options: ScenarioOptions<TEditor, TExpectation>
  ) {
    this.#options = options;
  }

  register(): void {
    const { title, chapters } = this.#options;

    test(title, async({ page }, testInfo) => {
      const start = this.#startIndex(process.env.SCENARIO_FROM);
      test.setTimeout((chapters.length - start + 1) * kChapterTimeout);

      const run = new ScenarioRun(page, testInfo, this.#options);
      await run.begin(chapters[start - 1]);
      for (const chapter of chapters.slice(start)) {
        await run.play(chapter);
      }
    });
  }

  #startIndex(
    from: string | undefined
  ): number {
    if (from === undefined || from === "") {
      return 0;
    }

    const { chapters } = this.#options;
    const index = chapters.findIndex((chapter) => chapter.id === from);
    if (index === -1) {
      const known = chapters.map((chapter) => chapter.id).join(", ");
      throw new Error(`SCENARIO_FROM="${from}" names no chapter (${known}).`);
    }

    return index;
  }
}

class ScenarioRun<TEditor, TExpectation> {
  readonly #page: Page;
  readonly #testInfo: TestInfo;
  readonly #options: ScenarioOptions<TEditor, TExpectation>;
  readonly #archives: ArchiveConsole;
  readonly #folder: string;
  readonly #errors: string[] = [];
  #editor: TEditor | null = null;

  constructor(
    page: Page,
    testInfo: TestInfo,
    options: ScenarioOptions<TEditor, TExpectation>
  ) {
    this.#page = page;
    this.#testInfo = testInfo;
    this.#options = options;
    this.#archives = new ArchiveConsole(page);
    this.#folder = path.join(
      path.dirname(testInfo.config.configFile ?? testInfo.config.rootDir),
      "node_modules/.cache/scenario",
      options.id
    );
    page.on("pageerror", (error) => this.#errors.push(error.message));
  }

  async begin(
    previous: ScenarioChapter<TEditor, TExpectation> | undefined
  ): Promise<void> {
    if (previous === undefined) {
      await test.step("open a blank offline editor", async() => {
        this.#editor = await this.#options.open(this.#page);
      }, kStep);

      return;
    }

    await test.step(`resume after "${previous.title}"`, async() => {
      this.#editor = await this.#options.open(this.#page);
      await this.#archives.importArchive(this.#checkpoint(previous));
      await this.#settle(previous);
    }, kStep);
  }

  async play(
    chapter: ScenarioChapter<TEditor, TExpectation>
  ): Promise<void> {
    const editor = this.#editor;
    if (editor === null) {
      throw new Error("The scenario plays a chapter before opening the editor.");
    }

    await test.step(chapter.title, async() => {
      await chapter.play(editor);
      await this.#settle(chapter);
      await this.#testInfo.attach(`${chapter.id}.png`, {
        body: await this.#page.screenshot(),
        contentType: "image/png"
      });
    }, kStep);
  }

  async #settle(
    chapter: ScenarioChapter<TEditor, TExpectation>
  ): Promise<void> {
    const checkpoint = this.#checkpoint(chapter);
    await fs.mkdir(this.#folder, { recursive: true });

    await expect(async() => {
      const download = await this.#archives.exportArchive();
      await download.saveAs(checkpoint);
      const archive = readAssetArchive(await fs.readFile(checkpoint));
      if (!archive.ok) {
        throw archive.val;
      }
      const actual: unknown = this.#options.describe(
        archive.val,
        chapter.expected
      );

      expect(actual).toEqual(chapter.expected);
    }).toPass({ timeout: kSettleTimeout });
    expect(this.#errors).toEqual([]);
  }

  #checkpoint(
    chapter: ScenarioChapter<TEditor, TExpectation>
  ): string {
    return path.join(this.#folder, `${chapter.id}.zip`);
  }
}
