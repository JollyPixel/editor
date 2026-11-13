export async function withTimeout<TValue>(
  promise: PromiseLike<TValue>,
  timeoutMs: number,
  message: string
): Promise<TValue> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  }
  finally {
    clearTimeout(timer);
  }
}
