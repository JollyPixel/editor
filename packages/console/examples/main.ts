// Import Third-party Dependencies
import "@jolly-pixel/ui";
import { CommandConsole } from "@jolly-pixel/console";
import "@jolly-pixel/console/element";

// CONSTANTS
const kShapes = ["cube", "sphere", "cross"] as const;

type Shape = typeof kShapes[number];

const brush = {
  size: 1,
  shape: "cube" as Shape,
  ghost: true
};

const commands = new CommandConsole();

const brushNamespace = commands.registerNamespace("brush", {
  description: "Voxel brush"
});
brushNamespace.registerVariable("size", {
  type: "number",
  description: "Brush size in voxels, from 1 to 16",
  get: () => brush.size,
  set: (value) => {
    brush.size = Math.min(Math.max(Math.round(value), 1), 16);
    renderBrush();
  }
});
brushNamespace.registerVariable("shape", {
  type: "enum",
  description: "Brush shape",
  enumValues: kShapes,
  get: () => brush.shape,
  set: (value) => {
    brush.shape = value;
    renderBrush();
  }
});
brushNamespace.registerVariable("ghost", {
  type: "boolean",
  description: "Show the ghost block under the cursor",
  get: () => brush.ghost,
  set: (value) => {
    brush.ghost = value;
    renderBrush();
  }
});
brushNamespace.registerCommand("grow", {
  description: "Grow or shrink the brush",
  args: [{ name: "delta", type: "number", required: true }],
  execute: ({ delta }, ctx) => {
    brush.size = Math.min(Math.max(brush.size + delta, 1), 16);
    renderBrush();
    ctx.print(`brush size ${brush.size}`);
  }
});
brushNamespace.registerCommand("reset", {
  description: "Restore the default brush",
  args: [],
  closeOnExecute: true,
  execute: () => {
    brush.size = 1;
    brush.shape = "cube";
    brush.ghost = true;
    renderBrush();
  }
});

commands.registerCommand("say", {
  description: "Print a message",
  args: [{ name: "text", type: "string", required: true, rest: true }],
  execute: ({ text }, ctx) => ctx.print(text)
});
commands.registerCommand("wait", {
  description: "Resolve after a delay, in milliseconds",
  args: [{ name: "ms", type: "number" }],
  execute: async({ ms = 1000 }, ctx) => {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      ctx.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("aborted"));
      });
    });
    ctx.print(`waited ${ms} ms`);
  }
});
commands.registerCommand("fail", {
  description: "Reject with an error",
  args: [],
  execute: async() => {
    throw new Error("this command always fails");
  }
});

const element = document.querySelector("jolly-console");
if (element !== null) {
  element.console = commands;
}

document.querySelector("#open-console")
  ?.addEventListener("click", () => commands.open());
wireDialog("#open-dialog", "#dialog", true);
wireDialog("#open-locked-dialog", "#locked-dialog", false);
renderBrush();

function renderBrush(): void {
  output("#brush-size", String(brush.size));
  output("#brush-shape", brush.shape);
  output("#brush-ghost", String(brush.ghost));
}

function output(
  selector: string,
  text: string
): void {
  const target = document.querySelector(selector);
  if (target !== null) {
    target.textContent = text;
  }
}

function wireDialog(
  buttonSelector: string,
  dialogSelector: string,
  dismissible: boolean
): void {
  const dialog = document.querySelector<HTMLElementTagNameMap["jolly-dialog"]>(
    dialogSelector
  );
  if (dialog === null) {
    return;
  }
  dialog.dismissible = dismissible;
  dialog.querySelector("[data-action=close]")
    ?.addEventListener("click", () => dialog.close("done"));
  document.querySelector(buttonSelector)
    ?.addEventListener("click", () => void dialog.showModal());
}
