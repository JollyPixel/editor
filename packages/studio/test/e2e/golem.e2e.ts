// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  GolemChatPane,
  TestAgent
} from "./support/golem.ts";

test("the golem chat carries a person's message to an agent and its answers back", async({
  studio,
  account,
  commands,
  page,
  baseURL
}) => {
  const chat = new GolemChatPane(page);
  await studio.open();
  using agent = await TestAgent.connect(page.request, baseURL ?? "", "Builder");
  await expect(chat.root).toBeHidden();

  const heard = agent.heard("add a tower");
  await commands.open();
  await commands.submit("/golem add a tower");
  await expect(chat.root).toBeVisible();
  await expect(chat.prompt).toBeFocused();
  expect((await heard).username).toBe(account);

  agent.chat.publishActivity({
    label: "Placing the tower",
    assetId: "scene-1"
  });
  await agent.chat.say("On it");
  await expect(chat.agents).toContainText("Builder");
  await expect(chat.agents).toContainText("Placing the tower");
  await expect(chat.messages).toContainText("add a tower");
  await expect(chat.messages).toContainText("On it");

  await chat.close.click();
  await expect(chat.root).toBeHidden();
  await agent.chat.say("Done");
  await expect(page.getByRole("status").filter({ hasText: "Done" }))
    .toBeVisible();
});
