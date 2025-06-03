// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import { AsynchronousConfig } from "@openally/config";

// Import Internal Dependencies
import { AssetManager } from "./AssetManager.class.js";

export type ProjectConfiguration = {
  name: string;
  security?: {
    password?: string;
    allowNoPassword?: boolean;
  };
};

/**
 * The manifest is the main configuration for a project
 * It references all default properties and assets.
 */
export class Project {
  config: ProjectConfiguration;
  location: string;
  assets: AssetManager;

  constructor(
    config: ProjectConfiguration,
    location: string
  ) {
    this.config = config;
    this.location = location;
    this.assets = new AssetManager({
      location,
      types: [
        "scripts",
        "models",
        "scenes"
      ]
    });
  }

  static async create(
    config: ProjectConfiguration,
    location = process.cwd()
  ) {
    const cfgPath = path.join(location, "project.json");
    const cfg = new AsynchronousConfig<ProjectConfiguration>(cfgPath, {
      createOnNoEntry: true
    });

    await cfg.read(config);
    await cfg.close();

    return new Project(config, location);
  }

  static async load(
    location = process.cwd()
  ) {
    const cfgPath = path.join(location, "project.json");
    const cfg = new AsynchronousConfig<ProjectConfiguration>(cfgPath, {
      createOnNoEntry: false
    });

    await cfg.read();
    const config = cfg.payload;

    await cfg.close();

    return new Project(config, location);
  }
}
