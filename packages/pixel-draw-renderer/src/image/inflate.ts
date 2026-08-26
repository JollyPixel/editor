// CONSTANTS
// PNG image data carries the zlib wrapper, which the Compression Streams API
// calls "deflate"; "deflate-raw" is the headerless variant.
const kZlibFormat = "deflate";

/**
 * Inflates through the Compression Streams API, which browsers and Node both
 * expose, so no environment-specific decompressor is needed.
 */
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
