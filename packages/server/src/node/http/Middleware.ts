// Import Node.js Dependencies
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

export type Middleware = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void
) => void;
