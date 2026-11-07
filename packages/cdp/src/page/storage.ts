export function seedLocalStorage(
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

export function forgetLocalStorage(
  key: string
): void {
  try {
    localStorage.removeItem(key);
  }
  catch {
    console.warn("[perf] localStorage unavailable");
  }
}
