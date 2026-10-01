export interface RecordedCalls<TArgs extends unknown[]> {
  mock: {
    calls: readonly { arguments: TArgs; }[];
  };
}

export function callsOf<TArgs extends unknown[]>(
  fn: RecordedCalls<TArgs>
): TArgs[] {
  return fn.mock.calls.map((call) => call.arguments);
}

export function nextFrame(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  requestAnimationFrame(() => resolve());

  return promise;
}
