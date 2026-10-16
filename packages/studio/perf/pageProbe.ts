export interface ProbeLog {
  t: number;
  msg: string;
  ms: number | undefined;
}

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

export interface ProbeRecord {
  logs: ProbeLog[];
  states: {
    t: number;
    state: string;
  }[];
  frames: ProbeFrame[];
  clicks: number[];
}

export interface ProbeOptions {
  storage: Record<string, string>;
  prewarmAdapter: boolean;
}

export interface ResourceBucket {
  count: number;
  transfer: number;
  decoded: number;
}

export interface FrameStats {
  timeOrigin: number;
  requests: number;
  transfer: number;
  decoded: number;
  byExtension: Record<string, ResourceBucket>;
  responseEnd: number;
  domContentLoaded: number;
  lastResourceEnd: number;
}

interface LongAnimationFrameEntry extends PerformanceEntry {
  blockingDuration: number;
  scripts: ProbeScript[];
}

export function installProbe(
  options: ProbeOptions
): void {
  function epoch(): number {
    return performance.timeOrigin + performance.now();
  }
  const record: ProbeRecord = {
    logs: [],
    states: [],
    frames: [],
    clicks: []
  };
  Object.defineProperty(window, "__perfProbe", { value: record });

  try {
    for (const [key, value] of Object.entries(options.storage)) {
      localStorage.setItem(key, value);
    }
  }
  catch {
    record.logs.push({
      t: epoch(),
      msg: "[probe] storage unavailable",
      ms: undefined
    });
  }

  const gpu = Reflect.get(navigator, "gpu") as {
    requestAdapter(): Promise<unknown>;
  } | undefined;
  if (options.prewarmAdapter && window === window.top && gpu !== undefined) {
    void gpu.requestAdapter();
  }

  const log = console.log.bind(console);
  console.log = (...items: unknown[]) => {
    const [message, meta] = items;
    if (typeof message === "string" && message.startsWith("[")) {
      record.logs.push({
        t: epoch(),
        msg: message,
        ms: typeof meta === "object" && meta !== null && "ms" in meta ? Number(meta.ms) : undefined
      });
    }
    log(...items);
  };

  try {
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
  }
  catch {
    record.logs.push({
      t: epoch(),
      msg: "[probe] long-animation-frame unsupported",
      ms: undefined
    });
  }

  new MutationObserver(() => {
    const state = document.documentElement?.getAttribute("data-editor-state");
    if (state && record.states.at(-1)?.state !== state) {
      record.states.push({
        t: epoch(),
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

export function readProbe(): ProbeRecord {
  return Reflect.get(window, "__perfProbe") as ProbeRecord;
}

export function readFrameStats(): FrameStats {
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const all: PerformanceResourceTiming[] = navigation === undefined ? resources : [navigation, ...resources];
  const byExtension: Record<string, ResourceBucket> = {};
  for (const entry of all) {
    const extension = new URL(entry.name).pathname.split(".").pop() ?? "";
    byExtension[extension] ??= {
      count: 0,
      transfer: 0,
      decoded: 0
    };
    byExtension[extension].count++;
    byExtension[extension].transfer += entry.transferSize;
    byExtension[extension].decoded += entry.decodedBodySize;
  }

  return {
    timeOrigin: performance.timeOrigin,
    requests: all.length,
    transfer: all.reduce((total, entry) => total + entry.transferSize, 0),
    decoded: all.reduce((total, entry) => total + entry.decodedBodySize, 0),
    byExtension,
    responseEnd: navigation?.responseEnd ?? 0,
    domContentLoaded: navigation?.domContentLoadedEventEnd ?? 0,
    lastResourceEnd: Math.max(0, ...resources.map((entry) => entry.responseEnd))
  };
}
