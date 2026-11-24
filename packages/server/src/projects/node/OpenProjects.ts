// CONSTANTS
export const DEFAULT_PROJECT_IDLE_MS = 10 * 60_000;

export interface OpenProjectsOptions<TProject> {
  open(slug: string): Promise<TProject>;
  /**
   * Milliseconds a project stays open with no lease, or `null` to keep it open
   * until it is closed.
   * @default DEFAULT_PROJECT_IDLE_MS
   */
  idleMs?: number | null;
}

export interface ProjectLease<TProject> extends Disposable {
  readonly project: TProject;
}

class OpenEntry<TProject> {
  readonly opening: Promise<TProject>;
  leases = 0;
  idle: ReturnType<typeof setTimeout> | null = null;

  constructor(
    opening: Promise<TProject>
  ) {
    this.opening = opening;
  }
}

export class OpenProjects<TProject extends AsyncDisposable>
implements AsyncDisposable {
  #open: (slug: string) => Promise<TProject>;
  #idleMs: number | null;
  #entries = new Map<string, OpenEntry<TProject>>();
  #closing = new Map<string, Promise<void>>();

  constructor(
    options: OpenProjectsOptions<TProject>
  ) {
    this.#open = options.open;
    this.#idleMs = options.idleMs === undefined ?
      DEFAULT_PROJECT_IDLE_MS :
      options.idleMs;
  }

  async acquire(
    slug: string
  ): Promise<ProjectLease<TProject>> {
    let closing = this.#closing.get(slug);
    while (closing !== undefined) {
      await closing;
      closing = this.#closing.get(slug);
    }
    const entry = this.#entries.get(slug) ?? this.#start(slug);
    entry.leases++;
    if (entry.idle !== null) {
      clearTimeout(entry.idle);
      entry.idle = null;
    }

    let project: TProject;
    try {
      project = await entry.opening;
    }
    catch (error) {
      entry.leases--;

      throw error;
    }

    let released = false;
    const held = entry;

    return {
      project,
      [Symbol.dispose]: () => {
        if (!released) {
          released = true;
          this.#release(slug, held);
        }
      }
    };
  }

  close(
    slug: string
  ): Promise<void> {
    return this.retire(slug, async() => undefined);
  }

  retire<TResult>(
    slug: string,
    action: () => Promise<TResult>
  ): Promise<TResult> {
    const entry = this.#entries.get(slug);
    this.#entries.delete(slug);
    if (entry !== undefined && entry.idle !== null) {
      clearTimeout(entry.idle);
    }
    const previous = this.#closing.get(slug) ?? Promise.resolve();
    const done = previous
      .then(() => (entry === undefined ? undefined : disposeOpened(entry.opening)))
      .then(action);
    const closing = done.then(() => undefined, () => undefined);
    this.#closing.set(slug, closing);
    closing.finally(() => {
      if (this.#closing.get(slug) === closing) {
        this.#closing.delete(slug);
      }
    });

    return done;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    const slugs = new Set([
      ...this.#entries.keys(),
      ...this.#closing.keys()
    ]);
    await Promise.all([...slugs].map((slug) => this.close(slug)));
  }

  #start(
    slug: string
  ): OpenEntry<TProject> {
    const entry = new OpenEntry(this.#open(slug));
    entry.opening.catch(() => {
      if (this.#entries.get(slug) === entry) {
        this.#entries.delete(slug);
      }
    });
    this.#entries.set(slug, entry);

    return entry;
  }

  #release(
    slug: string,
    entry: OpenEntry<TProject>
  ): void {
    entry.leases--;
    if (
      entry.leases > 0 ||
      this.#idleMs === null ||
      this.#entries.get(slug) !== entry
    ) {
      return;
    }
    entry.idle = setTimeout(() => {
      this.close(slug).catch((error: unknown) => {
        console.error(error);
      });
    }, this.#idleMs);
    entry.idle.unref();
  }
}

async function disposeOpened(
  opening: Promise<AsyncDisposable>
): Promise<void> {
  let project: AsyncDisposable;
  try {
    project = await opening;
  }
  catch {
    return;
  }

  await project[Symbol.asyncDispose]();
}
