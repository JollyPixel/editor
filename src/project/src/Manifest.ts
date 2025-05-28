// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import { AsynchronousConfig } from "@openally/config";

export interface ManifestPayload {
  name: string;
  password?: string;
}

/**
 * The manifest is the main configuration for a project
 * It references all default properties and assets.
 */
export class Manifest {
  data: ManifestPayload;

  constructor(data: ManifestPayload) {
    this.data = data;
  }

  static async load(
    location = process.cwd()
  ) {
    const cfgPath = path.join(location, "manifest.json");
    const cfg = new AsynchronousConfig<ManifestPayload>(cfgPath, {
      // jsonSchema: JSONSchema,
      createOnNoEntry: false
    });

    await cfg.read();
    const result = cfg.payload;

    await cfg.close();

    return new Manifest(result);
  }
}
