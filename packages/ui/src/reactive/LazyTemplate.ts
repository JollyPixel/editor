// Import Third-party Dependencies
import {
  nothing,
  type ReactiveControllerHost
} from "lit";

export type TemplateModuleLoader = () => Promise<unknown>;

export interface LazyTemplateHost extends ReactiveControllerHost {
  readonly renderRoot: ParentNode;
}

export class LazyTemplate {
  readonly #host: LazyTemplateHost;
  readonly #load: TemplateModuleLoader;
  #loading: Promise<void> | null = null;
  #loaded = false;

  constructor(
    host: LazyTemplateHost,
    load: TemplateModuleLoader
  ) {
    this.#host = host;
    this.#load = load;
  }

  async ready(): Promise<void> {
    this.#loading ??= this.#load().then(
      () => {
        this.#loaded = true;
        this.#host.requestUpdate();
      },
      (error: unknown) => {
        this.#loading = null;

        throw error;
      }
    );
    await this.#loading;
    await this.#host.updateComplete;
  }

  async query<TTag extends keyof HTMLElementTagNameMap>(
    tag: TTag
  ): Promise<HTMLElementTagNameMap[TTag]> {
    await this.ready();
    const element = this.#host.renderRoot.querySelector(tag);
    if (element === null) {
      throw new Error(`LazyTemplate: <${tag}> is not rendered.`);
    }

    return element;
  }

  render<TTemplate>(
    template: () => TTemplate
  ): TTemplate | typeof nothing {
    return this.#loaded ? template() : nothing;
  }
}
