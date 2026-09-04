// CONSTANTS
const kZlibFormat = "deflate";

export async function deflate(
  data: Uint8Array<ArrayBuffer>
): Promise<Uint8Array> {
  const stream = new Blob([data])
    .stream()
    .pipeThrough(new CompressionStream(kZlibFormat));

  return new Uint8Array(
    await new Response(stream).arrayBuffer()
  );
}

export async function inflate(
  data: Uint8Array<ArrayBuffer>
): Promise<Uint8Array> {
  const stream = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream(kZlibFormat));

  return new Uint8Array(
    await new Response(stream).arrayBuffer()
  );
}
