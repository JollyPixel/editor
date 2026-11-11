// Import Node.js Dependencies
import http from "node:http";

export interface RawRequest {
  method: string;
  headers?: Record<string, string>;
  body: string | Uint8Array;
}

export function requestStatus(
  url: URL,
  options: RawRequest
): Promise<number | undefined> {
  const { promise, resolve, reject } = Promise.withResolvers<number | undefined>();
  const request = http.request(url, {
    method: options.method,
    headers: options.headers
  }, (response) => {
    response.resume();
    resolve(response.statusCode);
  });
  request.on("error", reject);
  request.write(options.body);
  request.end();

  return promise;
}
