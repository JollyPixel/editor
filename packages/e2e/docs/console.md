# Console

## `new CommandConsole(page)`

Drives the editor command console through its ARIA roles.

### `prompt: Locator`

The `combobox` named "Command".

### `log: Locator`

The `log` named "Console output".

### `open(): Promise<void>`

Presses `Control+k` and waits until the prompt has focus.

### `close(): Promise<void>`

Presses `Escape`.

### `submit(line): Promise<void>`

Opens the console when the prompt is hidden, enters `line` and waits until the
log shows it.

```ts
const commands = new CommandConsole(page);
await commands.submit("brush.size 5");
await commands.close();
```
