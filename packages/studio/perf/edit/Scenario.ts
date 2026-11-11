// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// Import Internal Dependencies
import type { CodePane } from "./CodePane.ts";

export type EditScenario = typeof EDIT_SCENARIOS[number];

export interface ScenarioInput {
  page: Page;
  pane: CodePane;
  keys: number;
}

interface ScenarioPlan {
  events: readonly string[];
  play(input: ScenarioInput): Promise<void>;
}

// CONSTANTS
export const EDIT_SCENARIOS = ["type", "enter", "paste", "undo", "caret", "scroll"] as const;
const kTypedLine = "// const total = items.reduce((sum, item) => sum + item.size, 0);";
const kTypingDelayMs = 35;
const kKeyRepeatDelayMs = 60;
const kPastes = 5;
const kPasteBytes = 4 * 1024;
const kPasteGapMs = 400;
const kWheelDeltaPx = 240;

export const SCENARIO_PLANS: Record<EditScenario, ScenarioPlan> = {
  type: {
    events: ["keydown"],
    async play({ page, keys }) {
      await page.keyboard.press("Enter");
      await page.keyboard.type(
        kTypedLine.repeat(Math.ceil(keys / kTypedLine.length)).slice(0, keys - 1),
        { delay: kTypingDelayMs }
      );
    }
  },
  enter: {
    events: ["keydown"],
    play: ({ page, keys }) => pressRepeatedly(page, "Enter", keys)
  },
  paste: {
    events: ["input"],
    async play({ page, pane }) {
      const text = await pane.text();
      const block = `\n${text.slice(0, text.indexOf("\n", kPasteBytes) + 1 || kPasteBytes)}`;
      for (let paste = 0; paste < kPastes; paste++) {
        await pane.paste(block);
        await page.waitForTimeout(kPasteGapMs);
      }
    }
  },
  undo: {
    events: ["keydown"],
    play: ({ page, keys }) => pressRepeatedly(page, "Control+z", keys)
  },
  caret: {
    events: ["keydown"],
    play: ({ page, keys }) => pressRepeatedly(page, "ArrowDown", keys, kTypingDelayMs)
  },
  scroll: {
    events: ["wheel"],
    async play({ page, pane, keys }) {
      const { x, y } = await pane.center();
      await page.mouse.move(x, y);
      for (let wheel = 0; wheel < keys; wheel++) {
        await page.mouse.wheel(0, kWheelDeltaPx);
        await page.waitForTimeout(kTypingDelayMs);
      }
    }
  }
};

async function pressRepeatedly(
  page: Page,
  key: string,
  times: number,
  delayMs = kKeyRepeatDelayMs
): Promise<void> {
  for (let press = 0; press < times; press++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(delayMs);
  }
}
