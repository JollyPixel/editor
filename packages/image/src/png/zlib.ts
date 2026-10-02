// CONSTANTS
const kZlibFormat = "deflate";
const kMaxDeflateRatio = 1032;

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
  data: Uint8Array<ArrayBuffer>,
  byteLength: number
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream(kZlibFormat))
    .getReader();

  const out = new Uint8Array(
    Math.min(byteLength, data.length * kMaxDeflateRatio)
  );
  let offset = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const length = Math.min(value.length, out.length - offset);
    out.set(value.subarray(0, length), offset);
    offset += length;
  }

  return offset === byteLength ? out : out.subarray(0, offset);
}
