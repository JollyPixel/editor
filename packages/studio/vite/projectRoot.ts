// Import Node.js Dependencies
import path from "node:path";

// CONSTANTS
export const PROJECT_ROOT_ENV = "JOLLY_PROJECT";
export const DEFAULT_PROJECT_DIR = "project";

export function resolveProjectRoot(
  base: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const configured = env[PROJECT_ROOT_ENV]?.trim();

  return path.resolve(
    base,
    configured === undefined || configured === "" ?
      DEFAULT_PROJECT_DIR :
      configured
  );
}
