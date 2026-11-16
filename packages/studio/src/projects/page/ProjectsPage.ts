// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  state
} from "lit/decorators.js";
import {
  PROJECT_PAGES_PREFIX,
  type ProjectSummary,
  type ProjectsReply
} from "@jolly-pixel/server";
import "@jolly-pixel/ui/elements/button";

// Import Internal Dependencies
import { ProjectsClient } from "../ProjectsClient.ts";

@customElement("studio-projects")
export class ProjectsPage extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      justify-content: center;
      padding: var(--jolly-space-6) var(--jolly-space-3);
      color: var(--jolly-text);
    }

    main {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-4);
      width: min(480px, 100%);
    }

    form {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-2);
    }

    input {
      padding: var(--jolly-space-2);
      border: 1px solid var(--jolly-border);
      border-radius: var(--jolly-radius-sm);
      background: var(--jolly-control-bg);
      color: var(--jolly-text);
      font: inherit;
    }

    ul {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: flex;
      justify-content: space-between;
      padding: var(--jolly-space-2);
      border: 1px solid var(--jolly-border);
      border-radius: var(--jolly-radius-sm);
      background: var(--jolly-surface-raised);
    }

    a {
      color: var(--jolly-accent-text);
    }

    .detail {
      color: var(--jolly-text-muted);
    }

    .error {
      margin: 0;
      color: var(--jolly-danger);
    }
  `;

  @state()
  declare _reply: ProjectsReply | null | undefined;

  @state()
  declare _error: string | null;

  #client = ProjectsClient.at(new URL("../", document.baseURI));

  constructor() {
    super();
    this._reply = undefined;
    this._error = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void this.#refresh();
  }

  override render(): TemplateResult {
    return html`
      <main>
        <h1>Projects</h1>
        ${this.#content()}
        ${this._error === null ? nothing : html`
          <p class="error" role="alert">${this._error}</p>
        `}
      </main>
    `;
  }

  #content(): TemplateResult | typeof nothing {
    if (this._reply === undefined) {
      return nothing;
    }
    if (this._reply === null) {
      return this.#signInForm();
    }
    const { account, projects } = this._reply;

    return html`
      <p>
        Signed in as ${account.username}
        <jolly-button @click=${this.#signOut}>Sign out</jolly-button>
      </p>
      ${projects.length === 0 ?
        html`<p class="detail">You belong to no project yet.</p>` :
        html`<ul>${projects.map((project) => projectRow(project))}</ul>`}
      ${account.owner ? this.#createForm() : nothing}
    `;
  }

  #signInForm(): TemplateResult {
    return html`
      <form aria-label="Sign in" @submit=${this.#onSignIn}>
        <input
          name="username"
          autocomplete="username"
          placeholder="Username"
          required
        >
        <input
          name="password"
          type="password"
          autocomplete="current-password"
          placeholder="Password"
          required
        >
        <jolly-button variant="accent" type="submit">Sign in</jolly-button>
      </form>
    `;
  }

  #createForm(): TemplateResult {
    return html`
      <form aria-label="New project" @submit=${this.#onCreate}>
        <input name="slug" placeholder="Folder name of the new project" required>
        <jolly-button type="submit">Create project</jolly-button>
      </form>
    `;
  }

  async #refresh(): Promise<void> {
    await this.#attempt(async() => {
      this._reply = await this.#client.list();
    });
  }

  readonly #onSignIn = async(
    event: SubmitEvent
  ): Promise<void> => {
    event.preventDefault();
    const form = submittedForm(event);
    await this.#attempt(async() => {
      await this.#client.signIn(
        String(form.get("username") ?? ""),
        String(form.get("password") ?? "")
      );
      this._reply = await this.#client.list();
    });
  };

  readonly #onCreate = async(
    event: SubmitEvent
  ): Promise<void> => {
    event.preventDefault();
    const form = submittedForm(event);
    await this.#attempt(async() => {
      const project = await this.#client.create(String(form.get("slug") ?? ""));
      location.assign(projectUrl(project));
    });
  };

  readonly #signOut = async(): Promise<void> => {
    await this.#attempt(async() => {
      await this.#client.signOut();
      this._reply = null;
    });
  };

  async #attempt(
    action: () => Promise<void>
  ): Promise<void> {
    this._error = null;
    try {
      await action();
    }
    catch (error) {
      this._error = error instanceof Error ? error.message : String(error);
    }
  }
}

function submittedForm(
  event: SubmitEvent
): FormData {
  return event.target instanceof HTMLFormElement ?
    new FormData(event.target) :
    new FormData();
}

function projectRow(
  project: ProjectSummary
): TemplateResult {
  const detail = project.unavailable ??
    (project.pending ? "awaiting approval" : project.role);

  return html`
    <li data-project=${project.slug}>
      ${project.pending || project.unavailable !== null ?
        html`<span>${project.slug}</span>` :
        html`<a href=${projectUrl(project)}>${project.slug}</a>`}
      <span class="detail">${detail}</span>
    </li>
  `;
}

function projectUrl(
  project: ProjectSummary
): string {
  return new URL(
    `..${PROJECT_PAGES_PREFIX}${encodeURIComponent(project.slug)}/`,
    document.baseURI
  ).href;
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-projects": ProjectsPage;
  }
}
