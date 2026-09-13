// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import type { Binding } from "../../src/facade/Binding.ts";
import type { Button } from "../../src/facade/Button.ts";
import type { Disposable } from "../../src/facade/Container.ts";
import type { FacadeItem } from "../../src/facade/FacadeItem.ts";
import type { Folder } from "../../src/facade/Folder.ts";
import type { Monitor } from "../../src/facade/Monitor.ts";
import type { Pane } from "../../src/facade/Pane.ts";
import type { Presence } from "../../src/facade/Presence.ts";
import type { Separator } from "../../src/facade/Separator.ts";

interface ItemShell {
  readonly element: HTMLElement;
  hidden: boolean;
  disabled: boolean;
  dispose(): void;
}

test("every facade item keeps the shared public shell", () => {
  expect<Binding<{ speed: number; }, "speed">>().type.toBeAssignableTo<ItemShell>();
  expect<Button>().type.toBeAssignableTo<ItemShell>();
  expect<Folder>().type.toBeAssignableTo<ItemShell>();
  expect<Monitor<{ fps: number; }, "fps">>().type.toBeAssignableTo<ItemShell>();
  expect<Pane>().type.toBeAssignableTo<ItemShell>();
  expect<Presence>().type.toBeAssignableTo<ItemShell>();
  expect<Separator>().type.toBeAssignableTo<ItemShell>();
});

test("every facade item is disposable by a container", () => {
  expect<Button>().type.toBeAssignableTo<Disposable>();
  expect<Presence>().type.toBeAssignableTo<Disposable>();
  expect<Separator>().type.toBeAssignableTo<Disposable>();
});

test("the element type survives the base class", () => {
  expect<Presence["element"]>().type.toBe<HTMLElementTagNameMap["jolly-presence"]>();
  expect<FacadeItem["element"]>().type.toBe<HTMLElement>();
});

test("the disabled hooks stay out of the public surface", () => {
  expect<Button>().type.not.toBeAssignableTo<{ readDisabled(): boolean; }>();
  expect<Separator>().type.not.toBeAssignableTo<{
    writeDisabled(value: boolean): void;
  }>();
});
