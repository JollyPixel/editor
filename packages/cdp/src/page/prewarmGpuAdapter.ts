export function prewarmGpuAdapter(): void {
  const gpu = Reflect.get(navigator, "gpu") as {
    requestAdapter(): Promise<unknown>;
  } | undefined;
  if (window === window.top && gpu !== undefined) {
    void gpu.requestAdapter();
  }
}
