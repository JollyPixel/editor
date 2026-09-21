// Import Internal Dependencies
import { FacadeContainer } from "./Container.ts";
import {
  FacadeFolder,
  type FolderOptions
} from "./Folder.ts";

/**
 * Adds facade items inside an element the caller already owns, such as a
 * `jolly-pane` authored in HTML. Creates no element of its own, so several
 * hosts can contribute to one pane and `dispose()` removes only what this
 * host added.
 */
export class FacadeHost extends FacadeContainer {
  readonly element: HTMLElement;

  static query(
    selector: string,
    root: ParentNode = document
  ): FacadeHost {
    const element = root.querySelector(selector);
    if (!(element instanceof HTMLElement)) {
      throw new Error(
        `FacadeHost.query: "${selector}" matched no element`
      );
    }

    return new FacadeHost(element);
  }

  constructor(
    element: HTMLElement
  ) {
    super();
    this.element = element;
  }

  override dispose(): void {
    this.disposeAll();
  }

  protected get contentHost(): HTMLElement {
    return this.element;
  }

  protected createFolder(
    options: FolderOptions
  ): FacadeFolder {
    return new FacadeFolder(options);
  }
}
