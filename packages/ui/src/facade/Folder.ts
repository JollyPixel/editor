// Import Internal Dependencies
import "../containers/Folder.ts";
import { FacadeContainer } from "./Container.ts";

export interface FolderOptions {
  title?: string;
  /**
   * @default true
   */
  expanded?: boolean;
}

export class Folder extends FacadeContainer {
  readonly element: HTMLElementTagNameMap["jolly-folder"];

  constructor(
    options: FolderOptions = {}
  ) {
    super();
    this.element = document.createElement("jolly-folder");
    this.element.label = options.title ?? "";
    this.element.open = options.expanded ?? true;
  }

  protected get contentHost(): HTMLElement {
    return this.element;
  }

  protected createFolder(
    options: FolderOptions
  ): Folder {
    return new Folder(options);
  }
}
