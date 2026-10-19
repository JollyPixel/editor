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
  const { viewOptions } = panel;
  await panel.modes.select("uv");

  for (const state of [
    { all: true, labels: false, size: true },
    { all: false, labels: true, size: false }
  ]) {
    await viewOptions.apply(state);
    await panel.reload();
    await panel.modes.select("uv");
    await viewOptions.open();
    await expect(viewOptions.showAll).toBeChecked({ checked: state.all });
    await expect(viewOptions.labels).toBeChecked({ checked: state.labels });
    await expect(viewOptions.size).toBeChecked({ checked: state.size });
    await viewOptions.close();
  }
});

test.describe("texture preferences", () => {
  test.use({ editor: playground({ importPolicy: "add" }) });

  test("visibility preferences follow the active texture", async({ panel }) => {
    const { viewOptions } = panel;
    await panel.modes.select("uv");
    await viewOptions.apply({ all: true, labels: true });
    await panel.modes.select("fill");
    await panel.import(await pngFile("second.png", { x: 32, y: 32 }, []));
    await expect(panel.textures.tabs).toHaveCount(2);
    expect(await panel.modes.active()).toBe("fill");
    await panel.modes.select("uv");
    await viewOptions.open();
    await expect(viewOptions.showAll).toBeChecked();
    await expect(viewOptions.labels).toBeChecked();
    await viewOptions.showAll.uncheck();
    await viewOptions.close();
    await panel.textures.tabs.first().click();
    await viewOptions.open();
    await expect(viewOptions.showAll).not.toBeChecked();
    await expect(viewOptions.labels).toBeChecked();
  });
});
