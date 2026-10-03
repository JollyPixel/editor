# Remote consoles

A page that has no console of its own can still register commands. The page serves its
`CommandConsole` on a `MessagePort`, and the page that shows a console mirrors it. The studio
uses this for editor frames: each frame serves the console its features registered on, and the
studio shows the active frame's namespaces in its own console.

```ts
import {
  CommandConsole,
  ConsoleMirror,
  ConsoleServer
} from "@jolly-pixel/console";

const { port1, port2 } = new MessageChannel();

// The page that registers
const server = new ConsoleServer(editorCommands, port1);

// The page that shows the console
const mirror = new ConsoleMirror(port2, shellCommands);
mirror.active = true;
```

Both classes are in the root entry and use nothing but the port, so they run under `node --test`
with Node's `MessageChannel`.

## ConsoleServer

```ts
class ConsoleServer {
  constructor(commands: CommandConsole, port: MessagePort);
  close(): void;
}
```

The server posts a snapshot of the console's namespaces when it starts, after every registry
change (batched to one per microtask), after every command or write it runs, and whenever the
mirror asks. A snapshot carries each command's arguments and each variable's current value. An
argument's `autocomplete` and a variable's `get` and `set` stay on the page; every other field of
the definition crosses as is.

Only namespaces are served. Root commands and variables, the built-in `/clear` and `/help`
included, stay on the page.

The server runs what the mirror sends:

- A command runs with the arguments the mirror already bound and coerced. Its `print` and `error`
  lines go back to the mirror as they happen. `ctx.signal` aborts when the mirror cancels the run
  or when the command is unregistered on the page.
- A write carries the value as text and goes through the same coercion as a typed variable
  write, then runs the variable's `set` and sends back whether it was accepted and the value
  `get` reads afterwards.
- An `autocomplete` request runs the argument's function. A throw answers with no values.

`close()` aborts the running commands, stops listening and closes the port.

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

A mirror starts inactive: it receives snapshots but registers nothing. Setting `active` to `true`
registers every served namespace on `commands` and keeps them in step with later snapshots;
setting it back to `false` removes them.

The mirrored entries behave like local ones:

| Entry | Behaviour |
|---|---|
| command | runs on the page; output lines stream into the scrollback and the echo stays pending until the page answers; a throw on the page becomes an error entry with its message |
| argument with `autocomplete` | asks the page for its values |
| variable read | returns the value of the latest snapshot or write |
| variable write | runs on the page and prints the value read back there, or `<address> rejected "<literal>"` |

A variable read never waits for the page, because the console reads values synchronously for its
hints. The mirror refreshes the values when it becomes active, when its console emits `opened`
while it is active, and after every command or write. A value changed on the page by something
else while the console is open shows its old value until one of those happens. See
[ADR-0008](./adr/0008-mirrored-variables-read-a-cached-value.md).

A snapshot that only changes values keeps the registrations. A namespace whose commands, arguments
or variables changed is registered again, which aborts its running commands like any replacement
([ADR-0003](./adr/0003-last-registration-wins.md)).

### Conflicts

A served namespace whose name is already registered on the console is skipped, and `onConflict`
is called once per name for the mirror. The console's own namespace wins; a later snapshot
registers the served one once the name is free.

### Cancelling and closing

Deactivating removes the mirrored namespaces. A command still running is cancelled on the page and
prints `/<address> was cancelled`. `close()` removes them too, settles every pending request
(commands and writes reject with `RemoteCancelledError`, completions resolve to no values) and
closes the port.

`refresh()` asks the page for a new snapshot.
