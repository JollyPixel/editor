// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import type { TrustProxy } from "./api/StudioApi.ts";

// CONSTANTS
export const DEFAULT_PORT = 3000;
export const DEFAULT_HOST = "127.0.0.1";
const kCommaList = z.string().transform(
  (value) => value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "")
);
const kEnvironmentSchema = z.object({
  PORT: z.coerce
    .number()
    .int()
    .min(0)
    .max(65_535)
    .default(DEFAULT_PORT),
  HOST: z.string().default(DEFAULT_HOST),
  JOLLY_ALLOWED_HOSTS: kCommaList.default([]),
  JOLLY_TRUST_PROXY: z.union([
    z.enum(["true", "false"]).transform((value) => value === "true"),
    kCommaList
  ]).default(false)
});

export class StudioServerSettings {
  readonly port: number;
  readonly host: string;
  readonly allowedHosts: readonly string[];
  readonly trustProxy: TrustProxy;

  static parse(
    env: Record<string, string | undefined>
  ): StudioServerSettings {
    const result = kEnvironmentSchema.safeParse(
      Object.fromEntries(
        Object.entries(env).filter(([, value]) => value?.trim() !== "")
      )
    );
    if (!result.success) {
      throw new TypeError(
        `The server environment is invalid:\n${z.prettifyError(result.error)}`
      );
    }
    const data = result.data;

    return new StudioServerSettings(
      data.PORT,
      data.HOST,
      data.JOLLY_ALLOWED_HOSTS,
      data.JOLLY_TRUST_PROXY
    );
  }

  constructor(
    port: number,
    host: string,
    allowedHosts: readonly string[],
    trustProxy: TrustProxy
  ) {
    this.port = port;
    this.host = host;
    this.allowedHosts = [...allowedHosts];
    this.trustProxy = Array.isArray(trustProxy)
      ? [...trustProxy]
      : trustProxy;
  }
}
