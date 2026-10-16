// Import Node.js Dependencies
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import {
  chromium,
  type Browser,
  type BrowserContext,
  type CDPSession,
  type Frame,
  type Page
} from "@playwright/test";
import {
  ACCOUNTS_URL_PATH,
  prehashPassword
} from "@jolly-pixel/accounts";

// Import Internal Dependencies
import {
  DEBUG_STORAGE_KEY,
  EXPANDED_STORAGE_KEY,
  SEED_FOLDERS,
  STUDIO_URL,
  editorFrameSelector,
  parseEditors,
  type BenchEditor,
  type StudioMode
} from "./editors.ts";
import {
  installProbe,
  readFrameStats,
  readProbe,
  type ProbeFrame
} from "./pageProbe.ts";

// CONSTANTS
const kPhases = ["first", "reopen", "reload", "cold"] as const;
const kSeedRowIndex = 5;
const kShellTimeoutMs = 30_000;
const kReadyTimeoutMs = 60_000;
const kIdleBeforeClickMs = 500;
const kSamplingIntervalUs = 200;
const kPassword = "perf-password";

type Phase = typeof kPhases[number];

interface Session {
  context: BrowserContext;
  page: Page;
  cdp: CDPSession;
  sockets: SocketRecord[];
}

interface SocketRecord {
  url: string;
  received: number;
}

interface FrameSummary {
  count: number;
  total: number;
  blocking: number;
  longest: number;
}

export interface OpenMeasurement {
  label: string;
  run: number;
  mode: StudioMode;
  editor: string;
  phase: Phase;
  clickToFrame: number;
  clickToDomContentLoaded: number;
  clickToReady: number;
  clickToSettled: number;
  steps: Record<string, {
    start: number;
    end: number;
    ms: number | undefined;
  }>;
  framesBeforeReady: FrameSummary;
  framesAfterReady: FrameSummary;
  longFrames: (ProbeFrame & { at: number; })[];
  cdp: {
    scriptMs: number;
    taskMs: number;
    layoutMs: number;
    styleMs: number;
    heapDeltaMB: number;
    nodesDelta: number;
  };
  requests: number;
  transferKB: number;
  decodedKB: number;
  socketKB: number;
  profileFile?: string;
}

const { values: args } = parseArgs({
  options: {
    runs: { type: "string", default: "5" },
    modes: { type: "string", default: "online,offline" },
    editors: { type: "string", default: "voxel-map,voxel-model,pixel-art" },
    phases: { type: "string", default: kPhases.join(",") },
    out: { type: "string", default: "perf-results/open.json" },
    label: { type: "string", default: "baseline" },
    storage: { type: "string", default: "{}" },
    prewarm: { type: "boolean", default: false },
    headless: { type: "boolean", default: false },
    cpu: { type: "string", default: "1" },
    settle: { type: "string", default: "4000" },
    profile: { type: "string" },
    base: { type: "string", default: STUDIO_URL }
  }
});

const phases = new Set(args.phases.split(","));
const settleMs = Number(args.settle);
const storage: Record<string, string> = {
  [DEBUG_STORAGE_KEY]: "*",
  [EXPANDED_STORAGE_KEY]: JSON.stringify(SEED_FOLDERS),
  ...JSON.parse(args.storage)
};
const measurements: OpenMeasurement[] = [];

mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
if (args.profile !== undefined) {
  mkdirSync(args.profile, { recursive: true });
}

for (let run = 0; run < Number(args.runs); run++) {
  for (const mode of shuffle(args.modes.split(",") as StudioMode[])) {
    for (const editor of shuffle(parseEditors(args.editors))) {
      const browser = await launch();
      try {
        await measureEditor(browser, mode, editor, run);
      }
      catch (error) {
        console.error(`${run} ${mode} ${editor.name} failed`, error);
      }
      finally {
        await browser.close();
      }
      writeResults();
    }
  }
}
writeResults();

async function measureEditor(
  browser: Browser,
  mode: StudioMode,
  editor: BenchEditor,
  run: number
): Promise<void> {
  const session = await openSession(browser, mode);
  async function record(
    phase: Phase,
    target: Session
  ): Promise<void> {
    const measurement = await measureOpen(target, editor, phase, run, mode);
    measurements.push(measurement);
    console.log(
      `${run} ${mode.padEnd(7)} ${editor.name.padEnd(11)} ${phase.padEnd(6)}`,
      `ready ${measurement.clickToReady} settled ${measurement.clickToSettled}`,
      `busy ${measurement.framesBeforeReady.total}/${measurement.framesAfterReady.total}`,
      `xfer ${measurement.transferKB}KB ws ${measurement.socketKB}KB`
    );
  }

  await record("first", session);
  if (phases.has("reopen")) {
    await closeTab(session.page, editor);
    await record("reopen", session);
  }
  if (phases.has("reload")) {
    await session.page.evaluate(() => localStorage.removeItem("studio:tabs"));
    await openShell(session.page, mode);
    await record("reload", session);
  }
  await session.context.close();

  if (phases.has("cold")) {
    const cold = await openSession(browser, mode);
    await record("cold", cold);
    await cold.context.close();
  }
}

function launch(): Promise<Browser> {
  return chromium.launch({
    headless: args.headless,
    args: [
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows"
    ]
  });
}

async function openSession(
  browser: Browser,
  mode: StudioMode
): Promise<Session> {
  const context = await browser.newContext({
    viewport: {
      width: 1600,
      height: 900
    }
  });
  await context.addInitScript(installProbe, {
    storage,
    prewarmAdapter: args.prewarm
  });
  if (mode === "online") {
    await register(context);
  }

  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  if (Number(args.cpu) > 1) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(args.cpu) });
  }
  const sockets: SocketRecord[] = [];
  page.on("websocket", (socket) => {
    const socketRecord = {
      url: socket.url(),
      received: 0
    };
    sockets.push(socketRecord);
    socket.on("framereceived", ({ payload }) => {
      socketRecord.received += typeof payload === "string" ? Buffer.byteLength(payload) : payload.length;
    });
  });
  await openShell(page, mode);

  return {
    context,
    page,
    cdp,
    sockets
  };
}

async function register(
  context: BrowserContext
): Promise<void> {
  const username = `perf-${randomUUID().slice(0, 8)}`;
  const response = await context.request.post(
    new URL(`${ACCOUNTS_URL_PATH}register`, args.base).href,
    {
      data: {
        username,
        password: await prehashPassword(username, kPassword)
      }
    }
  );
  if (!response.ok()) {
    throw new Error(`Registration failed with ${response.status()}`);
  }
}

async function openShell(
  page: Page,
  mode: StudioMode
): Promise<void> {
  await page.goto(mode === "offline" ? `${args.base}?offline` : args.base);
  await page.getByRole("treeitem").nth(kSeedRowIndex).waitFor({ timeout: kShellTimeoutMs });
}

async function closeTab(
  page: Page,
  editor: BenchEditor
): Promise<void> {
  const tabs = page.locator("#editor-tabs");
  await tabs.getByRole("button", { name: `Close ${editor.tab}` }).click();
  await page.locator(editorFrameSelector(editor)).waitFor({ state: "detached" });
  await tabs.getByRole("tab", { name: "Home" }).click();
}

async function measureOpen(
  session: Session,
  editor: BenchEditor,
  phase: Phase,
  run: number,
  mode: StudioMode
): Promise<OpenMeasurement> {
  const { page, cdp, sockets } = session;
  const row = page.getByRole("treeitem").filter({
    has: page.getByText(editor.row, { exact: true })
  });
  await row.waitFor();
  await page.waitForTimeout(kIdleBeforeClickMs);

  const before = await performanceMetrics(cdp);
  const socketsBefore = sockets.map((socket) => socket.received);
  if (args.profile !== undefined) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: kSamplingIntervalUs });
    await cdp.send("Profiler.start");
  }

  await row.dblclick();
  const frame = await editorFrame(page, editor);
  await frame.locator("html[data-editor-state=ready]").waitFor({
    state: "attached",
    timeout: kReadyTimeoutMs
  });
  await page.waitForTimeout(settleMs);

  let profileFile: string | undefined;
  if (args.profile !== undefined) {
    const { profile } = await cdp.send("Profiler.stop");
    await cdp.send("Profiler.disable");
    profileFile = path.join(args.profile, `${args.label}-${mode}-${editor.name}-${phase}-${run}.cpuprofile`);
    writeFileSync(profileFile, JSON.stringify(profile));
  }

  const after = await performanceMetrics(cdp);
  const shell = await page.evaluate(readProbe);
  const probe = await frame.evaluate(readProbe);
  const stats = await frame.evaluate(readFrameStats);

  const click = shell.clicks.at(-1) ?? stats.timeOrigin;
  const ready = probe.states.find(({ state }) => state === "ready")?.t ?? click;
  function relative(
    time: number
  ): number {
    return Math.round(time - click);
  }
  function delta(
    name: string
  ): number {
    return (after.get(name) ?? 0) - (before.get(name) ?? 0);
  }
  const windowEnd = ready + settleMs - kIdleBeforeClickMs;
  const frames = [...probe.frames, ...shell.frames]
    .filter(({ t }) => t >= click && t <= windowEnd);
  const settled = Math.max(ready, ...frames.map(({ t, duration }) => t + duration));
  const socketBytes = sockets.reduce(
    (total, socket, index) => total + socket.received - (socketsBefore[index] ?? 0),
    0
  );

  return {
    label: args.label,
    run,
    mode,
    editor: editor.name,
    phase,
    clickToFrame: relative(stats.timeOrigin),
    clickToDomContentLoaded: relative(stats.timeOrigin + stats.domContentLoaded),
    clickToReady: relative(ready),
    clickToSettled: relative(settled),
    steps: bootSteps(probe.logs, relative),
    framesBeforeReady: summarizeFrames(frames.filter(({ t }) => t < ready)),
    framesAfterReady: summarizeFrames(frames.filter(({ t }) => t >= ready)),
    longFrames: frames.map((longFrame) => {
      return {
        ...longFrame,
        at: relative(longFrame.t)
      };
    }),
    cdp: {
      scriptMs: Math.round(delta("ScriptDuration") * 1000),
      taskMs: Math.round(delta("TaskDuration") * 1000),
      layoutMs: Math.round(delta("LayoutDuration") * 1000),
      styleMs: Math.round(delta("RecalcStyleDuration") * 1000),
      heapDeltaMB: Math.round(delta("JSHeapUsedSize") / 1e5) / 10,
      nodesDelta: delta("Nodes")
    },
    requests: stats.requests,
    transferKB: Math.round(stats.transfer / 1024),
    decodedKB: Math.round(stats.decoded / 1024),
    socketKB: Math.round(socketBytes / 1024),
    profileFile
  };
}

async function editorFrame(
  page: Page,
  editor: BenchEditor
): Promise<Frame> {
  const element = await page.locator(editorFrameSelector(editor)).elementHandle({
    timeout: kShellTimeoutMs
  });
  const frame = await element?.contentFrame();
  if (!frame) {
    throw new Error(`No frame for ${editor.name}`);
  }

  return frame;
}

async function performanceMetrics(
  cdp: CDPSession
): Promise<Map<string, number>> {
  const { metrics } = await cdp.send("Performance.getMetrics");

  return new Map(metrics.map(({ name, value }) => [name, value]));
}

function bootSteps(
  logs: { t: number; msg: string; ms: number | undefined; }[],
  relative: (time: number) => number
): OpenMeasurement["steps"] {
  const started = new Map<string, number>();
  const steps: OpenMeasurement["steps"] = {};
  for (const { t, msg, ms } of logs) {
    const match = /^\[\w+\] \[([^\]]+)\] (.+) (started|done)$/.exec(msg);
    if (match === null) {
      continue;
    }
    const [, namespace, step, event] = match;
    const key = `${namespace}:${step}`;
    if (event === "started") {
      started.set(key, relative(t));
    }
    else {
      steps[key] = {
        start: started.get(key) ?? relative(t),
        end: relative(t),
        ms
      };
    }
  }

  return steps;
}

function summarizeFrames(
  frames: ProbeFrame[]
): FrameSummary {
  return {
    count: frames.length,
    total: Math.round(frames.reduce((total, { duration }) => total + duration, 0)),
    blocking: Math.round(frames.reduce((total, { blocking }) => total + blocking, 0)),
    longest: Math.round(Math.max(0, ...frames.map(({ duration }) => duration)))
  };
}

function shuffle<T>(
  items: T[]
): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }

  return copy;
}

function writeResults(): void {
  writeFileSync(args.out, JSON.stringify({
    started: new Date().toISOString(),
    args,
    measurements
  }, null, 1));
}
