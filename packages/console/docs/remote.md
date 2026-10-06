# Remote consoles

Lets a page without its own console (an editor iframe, for example) expose its commands to a
console on another page, through a `MessagePort`. The studio uses this for editor frames.

```ts
import {
  CommandConsole,
  ConsoleMirror,
  ConsoleServer
} from "@jolly-pixel/console";

const { port1, port2 } = new MessageChannel();

// The page that registers commands
const server = new ConsoleServer(editorCommands, port1);

// The page that shows the console
const mirror = new ConsoleMirror(port2, shellCommands);
mirror.active = true;
```

## ConsoleServer

```ts
class ConsoleServer {
  constructor(commands: CommandConsole, port: MessagePort);
  close(): void;
}
```

Shares the console's namespaces and runs the commands and writes the mirror sends. Root commands
and variables, `/clear`, `/help` and `/revert` included, are not shared.

When a shared command returns a revert function, the server keeps it (the last 100) and the mirror
records the run as revertible, so `/revert` on the mirror's console reverts it on the server page.
The server refuses a revert once that command has been unregistered or replaced on its page.

`close()` cancels running commands and closes the port.

## ConsoleMirror

```ts
class ConsoleMirror {
  constructor(
    port: MessagePort,
    commands: CommandConsole,
    options?: ConsoleMirrorOptions
  );
  active: boolean;
  refresh(): void;
  close(): void;
}

interface ConsoleMirrorOptions {
  onConflict?: (namespace: string) => void;
}
```

Setting `active` to `true` adds the shared namespaces to `commands`; `false` removes them. A mirror
starts inactive.

Mirrored commands and variables work like local ones, with one difference: a variable shows the
last value received, refreshed when the console opens and after each command or write. A value
changed on the other page while the console is open is shown on the next refresh. `refresh()`
forces one.

| Situation | Result |
|---|---|
| a shared namespace has the same name as a local one | the local one wins and `onConflict` is called |
| the remote `get` throws | reading the variable throws `RemoteValueMissingError` |
| the mirror is deactivated during a command | the command is cancelled and prints `/<address> was cancelled` |
| `close()` with pending commands or writes | they reject with `RemoteCancelledError` |
| `/revert` reaches a change of an inactive mirror | the change is skipped, its namespace is not registered |
