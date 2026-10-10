// Import Internal Dependencies
import {
  test,
  expect,
  playground
} from "./fixtures.ts";
import { pngFile } from "./support/files.ts";

test("drawing modes survive refresh", async({ panel }) => {
  for (const mode of ["fill", "uv"] as const) {
    await panel.modes.select(mode);
    await panel.reload();
    expect(await panel.modes.active()).toBe(mode);
  }
});

test("UV visibility preferences survive refresh independently", async({ panel }) => {
  const { visibility } = panel;
  await panel.modes.select("uv");

  for (const state of [
    { all: true, labels: false, size: true },
    { all: false, labels: true, size: false }
  ]) {
    await visibility.apply(state);
    await panel.reload();
    await panel.modes.select("uv");
    await visibility.open();
    await expect(visibility.showAll).toBeChecked({ checked: state.all });
    await expect(visibility.labels).toBeChecked({ checked: state.labels });
    await expect(visibility.size).toBeChecked({ checked: state.size });
    await visibility.close();
  }
});

test.describe("texture preferences", () => {
  test.use({ editor: playground({ importPolicy: "add" }) });

  test("visibility preferences follow the active texture", async({ panel }) => {
    const { visibility } = panel;
    await panel.modes.select("uv");
    await visibility.apply({ all: true, labels: true });
    await panel.modes.select("fill");
    await panel.import(await pngFile("second.png", { x: 32, y: 32 }, []));
    await expect(panel.textures.tabs).toHaveCount(2);
    expect(await panel.modes.active()).toBe("fill");
    await panel.modes.select("uv");
    await visibility.open();
    await expect(visibility.showAll).toBeChecked();
    await expect(visibility.labels).toBeChecked();
    await visibility.showAll.uncheck();
    await visibility.close();
    await panel.textures.tabs.first().click();
    await visibility.open();
    await expect(visibility.showAll).not.toBeChecked();
    await expect(visibility.labels).toBeChecked();
  });
});
