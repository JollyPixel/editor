// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// Import Internal Dependencies
import {
  BOOT_MARKS,
  installBootProbe,
  type BootMark,
  type BootMarks
} from "./bootProbe.ts";
import { BenchBrowser } from "../studio/BenchBrowser.ts";
import {
  STUDIO_URL,
  type StudioMode
} from "../studio/StudioPage.ts";
import { alternatingRounds } from "../common/alternatingRounds.ts";
import { MODE_FLAG, splitList } from "../common/flags.ts";
import {
  MarkdownTable,
  type MarkdownCell
} from "../report/MarkdownTable.ts";
import { MeasurementGroup } from "../report/MeasurementGroup.ts";

// CONSTANTS
const kSettledMarks = ["header", "home", "tree"] as const;
const kTimeoutMs = 30_000;
const kAfterTreeMs = 1_000;

interface BootVariant {
  label: string;
  base: string;
}

interface BootMeasurement {
  label: string;
  mode: StudioMode;
  marks: BootMarks;
}

const { values: args } = parseArgs({
  options: {
    rounds: { type: "string", default: "5" },
    modes: { type: "string", default: "online,offline" },
    variants: { type: "string", default: `current=${STUDIO_URL}` },
    headless: { type: "boolean", default: false },
    reload: { type: "boolean", default: false }
  }
});

const variants = splitList(args.variants).map(parseVariant);
const items = variants.flatMap((variant) => splitList(args.modes).map(
  (mode) => {
    return {
      variant,
      mode: MODE_FLAG.parse(mode)
    };
  }
));
const bench = await BenchBrowser.launch({ headless: args.headless });
const measurements: BootMeasurement[] = [];
try {
  for (const { round, item } of alternatingRounds(
    items,
    Number(args.rounds)
  )) {
    const marks = await measureBoot(item.variant, item.mode).catch(
      (error: unknown) => {
        console.warn(
          `round ${round + 1} ${item.variant.label} ${item.mode} failed`,
          error
        );

        return null;
      }
    );
    if (marks === null) {
      continue;
    }
    measurements.push({
      label: item.variant.label,
      mode: item.mode,
      marks
    });
    console.info(
      `round ${round + 1} ${item.variant.label} ${item.mode}`,
      JSON.stringify(marks)
    );
  }
}
finally {
  await bench.close();
}

const table = new MarkdownTable(
  ["variant", "mode", ...BOOT_MARKS.flatMap((mark) => [mark, `${mark} p90`])],
  { fractionDigits: 0 }
);
for (const group of MeasurementGroup.groupBy(
  measurements,
  (measurement) => [measurement.label, measurement.mode]
)) {
  table.add([
    group.sample.label,
    group.sample.mode,
    ...BOOT_MARKS.flatMap((mark) => markCells(group, mark))
  ]);
}
console.info(`\n${table}`);

async function measureBoot(
  variant: BootVariant,
  mode: StudioMode
): Promise<BootMarks> {
  const studio = await bench.newStudioPage({
    base: variant.base,
    mode
  });
  const { page } = studio;
  await page.context().addInitScript(installBootProbe);
  try {
    await page.goto(mode === "offline" ? "/?offline" : "/");
    await settle(page);
    if (args.reload) {
      await page.reload();
      await settle(page);
    }

    return await page.evaluate(() => window.jollyBootMarks ?? {});
  }
  finally {
    await page.context().close();
  }
}

async function settle(
  page: Page
): Promise<void> {
  await page.waitForFunction(
    (settled) => settled.every(
      (mark) => window.jollyBootMarks?.[mark] !== undefined
    ),
    kSettledMarks,
    { timeout: kTimeoutMs }
  );
  await page.waitForTimeout(kAfterTreeMs);
}

function markCells(
  group: MeasurementGroup<BootMeasurement>,
  mark: BootMark
): MarkdownCell[] {
  function pick(
    measurement: BootMeasurement
  ): number | undefined {
    return measurement.marks[mark];
  }

  return group.items.some((item) => pick(item) !== undefined) ?
    [group.median(pick), group.percentile(pick, 0.9)] :
    ["-", "-"];
}

function parseVariant(
  value: string
): BootVariant {
  const [label, base] = value.split("=");
  if (label === undefined || base === undefined) {
    throw new TypeError(`Variant "${value}" is not "<label>=<url>".`);
  }

  return {
    label,
    base
  };
}
