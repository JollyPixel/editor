// Import Third-party Dependencies
import * as z from "zod";

export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiRoute {
  readonly method: ApiMethod;
  readonly path: string;
}

export const apiFailureSchema = z.object({
  code: z.string(),
  message: z.string()
});

export type ApiFailure = z.infer<typeof apiFailureSchema>;
