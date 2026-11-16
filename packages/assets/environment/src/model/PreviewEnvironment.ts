// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  ENVIRONMENT_EXTENSION,
  ENVIRONMENT_KIND
} from "../asset/environment.ts";
import {
  EnvironmentLink,
  type EnvironmentOpener
} from "./EnvironmentLink.ts";
import type { EnvironmentFile } from "../network/types.ts";

// CONSTANTS
const kPresetValue = "";
const kPresetOption: EnvironmentOption = {
  value: kPresetValue,
  label: "Lighting preset"
};

export interface EnvironmentCatalogRecord {
  readonly id: string;
  readonly kind: string;
  readonly path: string;
}

export interface EnvironmentCatalog {
  records(): Iterable<EnvironmentCatalogRecord>;
  subscribe(
    type: "change",
    listener: () => void
  ): () => void;
}

export interface EnvironmentOption {
  readonly value: string;
  readonly label: string;
}

export interface PreviewView {
  readonly reflections: boolean;
}

export interface PreviewEnvironmentOptions {
  catalog: EnvironmentCatalog;
  open: EnvironmentOpener;
}

export type PreviewEnvironmentEvents = {
  change: () => void;
};

export class PreviewEnvironment extends Emitter<PreviewEnvironmentEvents> {
  #catalog: EnvironmentCatalog;
  #link: EnvironmentLink;
  #file: Readonly<EnvironmentFile> | null = null;
  #unsubscribe: () => void;

  constructor(
    options: PreviewEnvironmentOptions
  ) {
    super();
    this.#catalog = options.catalog;
    this.#link = new EnvironmentLink(options.open, (file) => {
      this.#file = file;
      this.emit("change");
    });
    this.#unsubscribe = options.catalog.subscribe(
      "change",
      () => this.emit("change")
    );
  }

  get linked(): boolean {
    return this.#file !== null;
  }

  get value(): string {
    return this.#link.assetId ?? kPresetValue;
  }

  options(): EnvironmentOption[] {
    const environments = Array.from(this.#catalog.records())
      .filter((record) => record.kind === ENVIRONMENT_KIND)
      .map((record) => {
        return {
          value: record.id,
          label: environmentName(record.path)
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label));

    return [kPresetOption, ...environments];
  }

  choose(
    value: string
  ): void {
    this.#link.link(value === kPresetValue ? null : value);
  }

  resolve(
    preset: Readonly<EnvironmentFile>,
    view: PreviewView
  ): Readonly<EnvironmentFile> {
    const file = this.#file ?? preset;
    if (view.reflections) {
      return file;
    }

    return {
      ...file,
      reflections: {
        ...file.reflections,
        kind: "none"
      }
    };
  }

  dispose(): void {
    this.#unsubscribe();
    this.#link.dispose();
  }
}

function environmentName(
  path: string
): string {
  const name = path.slice(path.lastIndexOf("/") + 1);

  return name.endsWith(ENVIRONMENT_EXTENSION) ?
    name.slice(0, -ENVIRONMENT_EXTENSION.length) :
    name;
}
