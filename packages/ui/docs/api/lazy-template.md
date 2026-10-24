# `LazyTemplate`

`LazyTemplate` keeps part of a Lit host's template out of the page until the
module that defines its elements is loaded. Use it for dialogs and panels the
first screen does not show, so their code leaves the page's start-up bundle.

```ts
import { LazyTemplate } from "@jolly-pixel/ui";

new LazyTemplate(
  host: LazyTemplateHost,
  load: TemplateModuleLoader
)

interface LazyTemplateHost extends ReactiveControllerHost {
  readonly renderRoot: ParentNode;
}

type TemplateModuleLoader = () => Promise<unknown>;
```

```ts
interface LazyTemplate {
  ready(): Promise<void>;
  query<TTag extends keyof HTMLElementTagNameMap>(
    tag: TTag
  ): Promise<HTMLElementTagNameMap[TTag]>;
  render<TTemplate>(template: () => TTemplate): TTemplate | typeof nothing;
}
```

- `render()` returns `nothing` until the module is loaded, then the template.
- `ready()` calls `load` once, then calls `host.requestUpdate()` and waits
  for `host.updateComplete`, so the elements of the template are in the
  host's DOM when it resolves. Later calls only wait for the update.
- `query(tag)` waits for `ready()`, then returns the first `tag` element in
  `host.renderRoot`. It rejects when the template rendered none.
- When `load` rejects, `ready()` and `query()` reject with the same error and
  the next call loads again.

The elements stay out of the DOM until they are defined. Properties bound in
the template therefore reach the element's own setters, which a tag rendered
before its definition would hide behind a plain instance property.

```ts
@customElement("block-library")
export class BlockLibrary extends LitElement {
  #dialogs = new LazyTemplate(
    this,
    () => import("./BlockEditDialog.ts")
  );

  override render() {
    return html`
      <button @click=${this.#edit}>Edit</button>
      ${this.#dialogs.render(() => html`
        <block-edit-dialog .editing=${this.editing}></block-edit-dialog>
      `)}
    `;
  }

  readonly #edit = async(): Promise<void> => {
    const dialog = await this.#dialogs.query("block-edit-dialog");
    await dialog.open();
  };
}
```

Import the element's class with `import type` only: a value import loads the
module with the host and the template is no longer lazy.
