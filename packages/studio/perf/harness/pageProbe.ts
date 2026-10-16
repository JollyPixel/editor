export interface ProbeScript {
  duration: number;
  invoker: string;
  sourceURL: string;
  sourceFunctionName: string;
}

export interface ProbeFrame {
  t: number;
  duration: number;
  blocking: number;
  scripts: ProbeScript[];
}

export interface ProbeState {
  t: number;
  state: string;
}

export interface ProbeStep {
  name: string;
  start: number;
  end: number;
}

export interface ProbeRecord {
  states: ProbeState[];
  frames: ProbeFrame[];
  clicks: number[];
}

export interface ProbeSnapshot extends ProbeRecord {
  timeOrigin: number;
  domContentLoaded: number;
  requests: number;
  transferBytes: number;
  decodedBytes: number;
  steps: ProbeStep[];
}

interface LongAnimationFrameEntry extends PerformanceEntry {
  blockingDuration: number;
  scripts: ProbeScript[];
}

export function seedStorage(
  entries: Record<string, string>
): void {
  try {
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, value);
    }
  }
  catch {
    console.warn("[perf] localStorage unavailable");
  }
}

export function prewarmAdapter(): void {
  const gpu = Reflect.get(navigator, "gpu") as {
    requestAdapter(): Promise<unknown>;
  } | undefined;
  if (window === window.top && gpu !== undefined) {
    void gpu.requestAdapter();
  }
}

export function installProbe(): void {
  const record: ProbeRecord = {
    states: [],
    frames: [],
    clicks: []
  };
  Object.defineProperty(window, "__perfProbe", { value: record });

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as LongAnimationFrameEntry[]) {
      record.frames.push({
        t: performance.timeOrigin + entry.startTime,
        duration: entry.duration,
        blocking: entry.blockingDuration,
        scripts: entry.scripts.map((script) => {
          return {
            duration: script.duration,
            invoker: script.invoker,
            sourceURL: script.sourceURL,
            sourceFunctionName: script.sourceFunctionName
          };
        })
      });
    }
  }).observe({ type: "long-animation-frame", buffered: true });

  new MutationObserver(() => {
    const state = document.documentElement?.getAttribute("data-editor-state");
    if (state && record.states.at(-1)?.state !== state) {
      record.states.push({
        t: performance.timeOrigin + performance.now(),
        state
      });
    }
  }).observe(document, {
    attributes: true,
    subtree: true,
    attributeFilter: ["data-editor-state"]
  });

  addEventListener(
    "dblclick",
    (event) => record.clicks.push(performance.timeOrigin + event.timeStamp),
    true
  );
}

export function readProbe(): ProbeSnapshot {
  const record = Reflect.get(window, "__perfProbe") as ProbeRecord;
  const { timeOrigin } = performance;
  const navigation = performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  const resources = performance.getEntriesByType("resource") as
    PerformanceResourceTiming[];
  const loads = navigation === undefined ? resources : [navigation, ...resources];

  return {
    ...record,
    timeOrigin,
    domContentLoaded: navigation?.domContentLoadedEventEnd ?? 0,
    requests: loads.length,
    transferBytes: loads.reduce((total, entry) => total + entry.transferSize, 0),
    decodedBytes: loads.reduce((total, entry) => total + entry.decodedBodySize, 0),
    steps: performance.getEntriesByType("measure").map((entry) => {
      return {
        name: entry.name,
        start: timeOrigin + entry.startTime,
        end: timeOrigin + entry.startTime + entry.duration
      };
    })
  };
}

export interface FramePacing {
  frames: number;
  worstMs: number;
  elapsedMs: number;
}

export function startFramePacing(): void {
  const pacing = {
    frames: 0,
    worstMs: 0,
    started: performance.now(),
    last: performance.now(),
    running: true
  };
  Reflect.set(window, "__perfPacing", pacing);
  function tick(now: number): void {
    pacing.frames++;
    pacing.worstMs = Math.max(pacing.worstMs, now - pacing.last);
    pacing.last = now;
    if (pacing.running) {
      requestAnimationFrame(tick);
    }
  }
  requestAnimationFrame(tick);
}

export function stopFramePacing(): FramePacing {
  const pacing = Reflect.get(window, "__perfPacing") as {
    frames: number;
    worstMs: number;
    started: number;
    running: boolean;
  };
  pacing.running = false;

  return {
    frames: pacing.frames,
    worstMs: Math.round(pacing.worstMs),
    elapsedMs: Math.round(performance.now() - pacing.started)
  };
}
