export function yieldToEventLoop(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  if (typeof setImmediate === "function") {
    setImmediate(resolve);
  }
  else {
    setTimeout(resolve, 0);
  }

  return promise;
}
