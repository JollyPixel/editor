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

export function chainMiddleware(
  ...middlewares: Middleware[]
): Middleware {
  return (request, response, next) => {
    function run(
      index: number
    ): void {
      if (index === middlewares.length) {
        next();
      }
      else {
        middlewares[index](request, response, () => run(index + 1));
      }
    }

    run(0);
  };
}
