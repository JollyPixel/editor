// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";

test.beforeEach(async({ map }) => {
  await map.panes.open("Blocks");
});

test("a dragged block carries its preview, lands, and drags again", async({ map }) => {
  const { library } = map.blocks;
  await expect(library.options).toHaveCount(32);
  const [first, second, third, fourth] = await library.names();

  await library.lift(first);
  await library.carryOver(third);

  await expect(library.ghost).toBeVisible();
  await expect(library.landing).toBeVisible();
  await expect.poll(() => library.ghostPainted()).toBe(true);
  expect((await library.names()).slice(0, 3)).toEqual([second, third, first]);

  await library.drop();

  await expect(library.ghost).toHaveCount(0);
  await expect.poll(
    async() => (await library.names()).slice(0, 3)
  ).toEqual([second, third, first]);

  await library.lift(first);
  await library.carryOver(fourth);
  await expect(library.ghost).toBeVisible();
  await library.drop();

  await expect.poll(
    async() => (await library.names()).slice(0, 4)
  ).toEqual([second, third, fourth, first]);
});
