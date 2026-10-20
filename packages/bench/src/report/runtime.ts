// Import Node.js Dependencies
import { cpus } from "node:os";

export type HostMetadata = {
  node: string;
  v8: string;
  platform: string;
  cpu: string;
};

export type RuntimeMetadata = HostMetadata & Record<string, number | string>;

export function hostMetadata(): HostMetadata {
  return {
    node: process.version,
    v8: process.versions.v8,
    platform: `${process.platform} ${process.arch}`,
    cpu: cpus()[0]?.model ?? "unknown"
  };
}
