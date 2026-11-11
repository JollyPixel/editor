export interface InputLatency {
  startedAt: number;
  endedAt: number;
  latenciesMs: number[];
}

interface LatencyState {
  started: number;
  latencies: number[];
  stop(): void;
}

export function startInputLatency(
  types: readonly string[]
): void {
  const state: LatencyState = {
    started: performance.now(),
    latencies: [],
    stop: () => undefined
  };
  Reflect.set(window, "__perfInputLatency", state);

  function measure(event: Event): void {
    const start = event.timeStamp;
    requestAnimationFrame(() => {
      setTimeout(() => {
        state.latencies.push(performance.now() - start);
      }, 0);
    });
  }

  const listener = {
    capture: true,
    passive: true
  };
  for (const type of types) {
    addEventListener(type, measure, listener);
  }
  state.stop = () => {
    for (const type of types) {
      removeEventListener(type, measure, listener);
    }
  };
}

export function stopInputLatency(): InputLatency {
  const state = Reflect.get(window, "__perfInputLatency") as LatencyState;
  state.stop();

  return {
    startedAt: performance.timeOrigin + state.started,
    endedAt: performance.timeOrigin + performance.now(),
    latenciesMs: state.latencies.map((latency) => Math.round(latency * 10) / 10)
  };
}
