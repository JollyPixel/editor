export function exposeDebugHandle(
  name: string,
  handle: unknown
): () => void {
  Object.assign(globalThis, { [name]: handle });

  return () => {
    if (Reflect.get(globalThis, name) === handle) {
      Reflect.deleteProperty(globalThis, name);
    }
  };
}
