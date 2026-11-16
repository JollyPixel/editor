// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { OpenProjects } from "#src/projects/node/OpenProjects.ts";

// CONSTANTS
const kIdleMs = 1_000;

class FakeProject implements AsyncDisposable {
  readonly slug: string;
  closed = false;
  #closing: Promise<void>;

  constructor(
    slug: string,
    closing: Promise<void> = Promise.resolve()
  ) {
    this.slug = slug;
    this.#closing = closing;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.#closing;
    this.closed = true;
  }
}

function countingProjects(
  open: (slug: string) => Promise<FakeProject> = async(slug) => new FakeProject(slug)
): {
  projects: OpenProjects<FakeProject>;
  opened: FakeProject[];
} {
  const opened: FakeProject[] = [];
  const projects = new OpenProjects<FakeProject>({
    idleMs: kIdleMs,
    open: async(slug) => {
      const project = await open(slug);
      opened.push(project);

      return project;
    }
  });

  return {
    projects,
    opened
  };
}

function settled(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

describe("OpenProjects", () => {
  test("shares one opening between concurrent requests", async() => {
    const { projects, opened } = countingProjects();

    const [first, second] = await Promise.all([
      projects.acquire("castle"),
      projects.acquire("castle")
    ]);

    assert.equal(opened.length, 1);
    assert.equal(first.project, second.project);
  });

  test("opens again after a failed opening", async() => {
    let attempts = 0;
    const { projects, opened } = countingProjects(async(slug) => {
      attempts++;
      if (attempts === 1) {
        throw new Error("the disk is busy");
      }

      return new FakeProject(slug);
    });

    await assert.rejects(projects.acquire("castle"), /the disk is busy/);
    using lease = await projects.acquire("castle");

    assert.equal(lease.project, opened[0]);
    assert.equal(attempts, 2);
  });

  test("closes a project once it has had no lease for the idle delay", async(context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const { projects, opened } = countingProjects();
    const held = await projects.acquire("castle");
    const released = await projects.acquire("castle");

    released[Symbol.dispose]();
    context.mock.timers.tick(kIdleMs);
    await settled();
    assert.equal(opened[0].closed, false);

    held[Symbol.dispose]();
    context.mock.timers.tick(kIdleMs - 1);
    await settled();
    assert.equal(opened[0].closed, false);

    context.mock.timers.tick(1);
    await settled();
    assert.equal(opened[0].closed, true);

    using _reopened = await projects.acquire("castle");
    assert.equal(opened.length, 2);
  });

  test("a request during the close waits, then opens the project again", async() => {
    const closing = Promise.withResolvers<void>();
    const { projects, opened } = countingProjects(
      async(slug) => new FakeProject(slug, closing.promise)
    );
    using _first = await projects.acquire("castle");

    const closed = projects.close("castle");
    const reopening = projects.acquire("castle");
    closing.resolve();
    await closed;
    using reopened = await reopening;

    assert.equal(opened.length, 2);
    assert.equal(opened[0].closed, true);
    assert.equal(reopened.project, opened[1]);
  });
});
