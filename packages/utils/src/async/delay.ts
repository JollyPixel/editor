export function delay(
  milliseconds: number
): Promise<void> {
  if (milliseconds <= 0) {
    return Promise.resolve();
  }

  const {
    promise,
    resolve
  } = Promise.withResolvers<void>();
  setTimeout(resolve, milliseconds);

  return promise;
}

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
