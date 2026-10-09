// Import Internal Dependencies
import type { HttpReply } from "./HttpReply.ts";
import type { HttpRequest } from "./HttpRequest.ts";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpRoute {
  method: HttpMethod;
  path: string;
  handle(request: HttpRequest): Promise<HttpReply> | HttpReply;
}
