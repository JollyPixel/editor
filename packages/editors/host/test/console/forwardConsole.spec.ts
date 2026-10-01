// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Appearance } from "#src/appearance/PageAppearance.ts";
import { forwardConsole } from "#src/console/forwardConsole.ts";
import {
  appearanceMessage,
  SHELL_MESSAGE_TYPE,
  ShellChannel
} from "#src/launch/ShellChannel.ts";

// CONSTANTS
const kShellOrigin = "http://studio.test";

interface FakeShell {
  shell: ShellChannel;
  posted: unknown[];
  push(appearance: Appearance): void;
}

function fakeShell(
  appearance: Appearance | null = null
): FakeShell {
  const posted: unknown[] = [];
  const port = Object.assign(new MessageChannel().port1, {
    postMessage: (message: unknown) => {
      posted.push(message);
    }
  });

  return {
    shell: new ShellChannel({
      port,
      origin: kShellOrigin,
      appearance
    }),
    posted,
    push: (pushed) => {
      window.dispatchEvent(new MessageEvent("message", {
        source: port,
        origin: kShellOrigin,
        data: appearanceMessage(pushed)
      }));
    }
  };
}

function scope(): HTMLElement {
  const element = document.createElement("jolly-scope");
  element.setAttribute("theme", "dark");
  element.setAttribute("density", "comfortable");
  document.body.append(element);

  return element;
}

function pressCtrlK(): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "k",
    ctrlKey: true,
    cancelable: true
  });
  window.dispatchEvent(event);

  return event;
}

describe("forwardConsole", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("Ctrl+K asks the shell to toggle its console", () => {
    const { shell, posted } = fakeShell();
    const page = forwardConsole(shell);

    const event = pressCtrlK();
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      shiftKey: true
    }));

    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(posted, [
      {
        type: SHELL_MESSAGE_TYPE,
        command: "toggle-console"
      }
    ]);
    page.dispose();
  });

  test("applies the launch appearance to every scope", () => {
    const [first, second] = [scope(), scope()];

    const page = forwardConsole(fakeShell({
      theme: "auto",
      density: "compact"
    }).shell);

    for (const element of [first, second]) {
      assert.equal(element.hasAttribute("theme"), false);
      assert.equal(element.getAttribute("density"), "compact");
    }
    page.dispose();
  });

  test("follows the appearance the shell pushes", () => {
    const element = scope();
    const { shell, push } = fakeShell();
    const page = forwardConsole(shell);

    push({
      theme: "light",
      density: "default"
    });

    assert.equal(element.getAttribute("theme"), "light");
    assert.equal(element.getAttribute("density"), "default");
    page.dispose();
  });

  test("dispose stops forwarding and following", () => {
    const element = scope();
    const { shell, posted, push } = fakeShell();
    const page = forwardConsole(shell);

    page.dispose();
    pressCtrlK();
    push({
      theme: "light",
      density: "compact"
    });

    assert.deepEqual(posted, []);
    assert.equal(element.getAttribute("theme"), "dark");
  });
});
