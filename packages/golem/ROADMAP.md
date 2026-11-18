# @jolly-pixel/golem — ROADMAP

## Bridge trial

The bridge is tested against a fake ACP agent only. `local/trial*.ts` sets up
the dev studio (owner, tokens, seeded assets, a person in the chat).

- [ ] Run `jolly-golem bridge --agent claude`: a prompt from the pane, a golem
      tool call allowed without asking, a shell permission answered from the
      pane, Stop during a turn.
- [ ] The same with `--agent codex`, which checks the `is_mcp_tool_approval`
      path.

## Publish

- [ ] Publish `@jolly-pixel/golem` when people outside the repository need it:
      bundle or publish the `asset.*` client entries, and make the setup line
      an `npx` one without the `<checkout>` placeholder.
