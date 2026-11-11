<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 💃 Getting Started

This workspace-private package is never published or built. It exports
TypeScript directly; Node strips the types at run time. Add it as a
development dependency:

```json
{
  "devDependencies": {
    "@jolly-pixel/cdp": "workspace:*"
  }
}
```

`@playwright/test` is a peer dependency, installed once at the repository root.

It holds the parts of a browser perf harness that do not depend on the page
being measured: recording a page over the Chrome DevTools Protocol (CDP),
scripts that run inside the page, and readers for the files Chrome writes.

## 👀 Usage example

```ts
// Import Third-party Dependencies
import {
  BENCH_CHROMIUM_ARGS,
  NETWORK_PRESETS,
  PageRecorder
} from "@jolly-pixel/cdp";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({ args: BENCH_CHROMIUM_ARGS });
const page = await browser.newPage();
const recorder = await PageRecorder.attach(page, {
  cpuThrottle: 4,
  tracer: browser
});
await page.goto("http://localhost:3004/");
await recorder.emulateNetwork(NETWORK_PRESETS["fast-4g"]);

const { recording } = await recorder.record(
  {
    cpuProfile: "perf-results/open.cpuprofile",
    heapProfile: "perf-results/open.heapprofile"
  },
  () => page.getByText("Open").click()
);
console.log(recording.metrics.change("TaskDuration"), recording.memory?.gc);
```

## 📚 API

### PageRecorder

`PageRecorder.attach(page, { cpuThrottle?, tracer? })` opens a CDP session on
a Playwright page and enables the `Performance` domain. A `cpuThrottle` above 1
slows the CPU by that factor. `tracer` is the Playwright `Browser` that records
GC pauses; a persistent context has none, so it cannot record memory.

`emulateNetwork(conditions)` applies a `NetworkConditions` latency (ms) and
throughput (bytes per second), usually one of `NETWORK_PRESETS` (`fast-4g`,
`slow-4g`).

`record(plan, action)` runs `action` and returns its result with a
`PageRecording`:

- `metrics`: a `MetricsDelta` over `Performance.getMetrics`. `change(name)`
  takes a `MetricName` and returns after minus before, or 0 when Chrome did
  not report it. Durations are in seconds.
- `socketBytes` and `socketSentBytes`: the WebSocket bytes the page received
  and sent.
- `cpuProfileFile`: set when `plan.cpuProfile` names a file. Sampled every
  `CPU_SAMPLING_INTERVAL_US` (200 µs).
- `memory`: set when `plan.heapProfile` names a file. Holds the sampled heap
  profile file, the bytes it allocated, and the main-thread GC pauses. Throws
  before recording anything when the recorder has no `tracer`.

Profiles stop and are written as JSON, creating missing folders, even when
`action` throws; the error is then rethrown.

### Page scripts

Pass these functions to `page.evaluate` or `addInitScript`; they run in the
page.

- `seedLocalStorage(entries)` and `forgetLocalStorage(key)` write and remove
  `localStorage` entries, warning when storage is unavailable.
- `prewarmGpuAdapter()` requests a WebGPU adapter from the top window.
- `startFramePacing(thresholds)` and `stopFramePacing()` count animation
  frames and WebGPU renders between the two calls. A render closer than
  `renderGapMs` to the previous one counts as the same render; a gap over
  `wakeGapMs` counts as a wake and adds to `idleMs`. `FRAME_PACING_THRESHOLDS`
  holds the defaults (4 ms, 100 ms). Throws when WebGPU is unavailable.
- `startInputLatency(types)` and `stopInputLatency()` time each event of the
  listed types, such as `keydown` or `wheel`, from its `timeStamp` to a task
  queued after the next animation frame: the handlers, the render and the
  paint it caused. Call them in the frame that receives the input.

### Session helpers

`BENCH_CHROMIUM_ARGS` turns off Chromium's throttling of background and
occluded pages.

### Analysis

- `Trace.read(file)` or `Trace.parse(json)` loads a trace-event file. `events`
  holds every raw event. `garbageCollections()` sums renderer main-thread GC
  pauses as minor and major counts and milliseconds, counting nested GC spans
  once. `GC_CATEGORIES` are the trace categories it needs.
- `trace.threads()` yields each `TraceThread` that has complete spans, and
  `threadRunning(event)` returns the thread an event ran on. A thread has an
  `id` (`pid:tid`), a `name` (`?` without metadata) and its `spans` sorted by
  start, longest first. `busy()` sums its top-level spans, `selfTimes()` tallies
  each span name minus the time of its nested spans, and
  `spansStartingWithin(window)` keeps the spans that start in a `TimeWindow`.
- A `Span` has a `name`, a `category`, and a `start`, `duration` and `end` in
  µs. `contains(other)` and `overlap(other)` compare two spans.
- `TimeWindow.between(fromMs?, untilMs?)` covers a range of milliseconds,
  unbounded on a missing side; `TimeWindow.following(startUs, lengthMs)` starts
  at a trace timestamp. `contains(us)` includes both ends. A window that ends
  before it starts throws a `RangeError`.
- `ProfileTree.read(file, window?)` loads a `.cpuprofile` (samples weighed in
  µs, kept when they fall in the `TimeWindow`) or a `.heapprofile` (weights in
  bytes). `total` sums every weight, and `nodes()` yields each weighted node
  with its `frame`, its `weight` and `stack()`, which walks its `CallFrame` up
  to the root. `measure` is the tree's `ProfileMeasure`: `selfTime` or
  `allocated`, with a `title` and `format(value)` (`"1.5 ms"`, `"12 KB"`).
- `SourceMapFile.load(file)` reads `<file>.map`, or returns `null`.
  `originalPosition(callFrame)` resolves a `CallFrame` to its source URL and
  1-based line, or `null` when the frame has no line or no mapping.
  `generatedSpans(code)` yields the bytes of each mapped segment with its
  source, `null` for generated code.
- `Tally` sums values per key; `top(count)` sorts by total. Its entries are
  read-only.

### Network

`startThrottleProxy({ port, targetPort, mbps, rttMs })` forwards TCP from
`localhost:<port>` to `localhost:<targetPort>`, delaying HTTP and WebSocket
bytes alike as one link of `mbps` with `rttMs` round trips. Returns the
listening `net.Server`. Unlike `emulateNetwork`, it treats compressed and
uncompressed WebSocket frames alike.

## ✨ Contributors guide

Read the [CONTRIBUTING][contributing] guide before contributing.

After making changes, run the tests and linter:

```bash
$ pnpm run test
$ pnpm run lint
```

## 📃 License

MIT

[contributing]: ../../CONTRIBUTING.md
