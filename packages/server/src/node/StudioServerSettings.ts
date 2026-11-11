// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import type { TrustProxy } from "./http/StudioApi.ts";

// CONSTANTS
export const DEFAULT_PORT = 3000;
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PROJECT_DIR = "project";
export const PROJECT_ROOT_ENV = "JOLLY_PROJECT";
export const MASTER_PASSWORD_ENV = "JOLLY_MASTER_PASSWORD";
const kCommaList = z.string().transform(
  (value) => value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "")
);
const kBoolean = z.enum(["true", "false"]).transform(
  (value) => value === "true"
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
    kBoolean,
    kCommaList
  ]).default(false),
  JOLLY_SOCKET_COMPRESSION: kBoolean.default(true),
  [PROJECT_ROOT_ENV]: z.string().trim().default(DEFAULT_PROJECT_DIR),
  [MASTER_PASSWORD_ENV]: z.string().optional()
});

export interface StudioServerSettingsData {
  port: number;
  host: string;
  allowedHosts: readonly string[];
  trustProxy: TrustProxy;
  compression: boolean;
  project: string;
  masterPassword?: string;
}

export class StudioServerSettings {
  readonly port: number;
  readonly host: string;
  readonly allowedHosts: readonly string[];
  readonly trustProxy: TrustProxy;
  readonly compression: boolean;
  readonly masterPassword: string | undefined;

  #project: string;

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

    return new StudioServerSettings({
      port: data.PORT,
      host: data.HOST,
      allowedHosts: data.JOLLY_ALLOWED_HOSTS,
      trustProxy: data.JOLLY_TRUST_PROXY,
      compression: data.JOLLY_SOCKET_COMPRESSION,
      project: data[PROJECT_ROOT_ENV],
      masterPassword: data[MASTER_PASSWORD_ENV]
    });
  }

  constructor(
    data: StudioServerSettingsData
  ) {
    this.port = data.port;
    this.host = data.host;
    this.allowedHosts = [...data.allowedHosts];
    this.trustProxy = Array.isArray(data.trustProxy)
      ? [...data.trustProxy]
      : data.trustProxy;
    this.compression = data.compression;
    this.masterPassword = data.masterPassword;
    this.#project = data.project;
  }

  projectRoot(
    base: string
  ): string {
    return path.resolve(base, this.#project);
  }
}
