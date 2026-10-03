# Console architecture

The package has two entries. The root entry is the headless `CommandConsole`:
the registry, the input grammar, search and execution, with no DOM.
`@jolly-pixel/console/element` is the Lit `jolly-console` dialog. It keeps the
prompt, renders the scrollback through `jolly-console-log` and the suggestion
list through a controller, listens to four `CommandConsole` events and hands
each submitted line back to `submit()`.

## Workspace map

```mermaid
flowchart TB
    subgraph Root["@jolly-pixel/console, no DOM"]
        Console["CommandConsole<br/>register, submit, open, close"]
        Console --> Registry["Registry<br/>root NamespaceEntry + named namespaces"]
        Console --> History["InputHistory<br/>submitted lines"]
        Console --> Scrollback["Scrollback<br/>echo, info and error entries"]
        Console --> Builtins["builtins<br/>/help, /clear"]
        Console --> Classify["classify<br/>command, variable or search"]
        Classify --> Registry
        Search["search + score<br/>ranked results, typo tier"] --> Registry
        Search --> Typo["typo<br/>Levenshtein tolerance"]
        Browse["browse<br/>empty-prompt sections"] --> Registry
        Complete["complete<br/>token under the caret"] --> Classify
        Complete --> Typo
    end

    subgraph Element["@jolly-pixel/console/element"]
        Dialog["ConsoleElement<br/>jolly-console dialog and prompt"]
        Dialog --> Log["ConsoleLogElement<br/>jolly-console-log scrollback"]
        Dialog --> Keyboard["KeyboardController<br/>Ctrl+K, key to action, hints"]
        Dialog --> Suggestions["SuggestionController<br/>list, highlight, gray suffix, usage"]
    end

    Suggestions --> Classify
    Suggestions --> Search
    Suggestions --> Complete
    Suggestions --> Browse
    Dialog -->|"submit(line)"| Console
    Console -. "registry-changed, scrollback-changed,<br/>open-requested, close-requested" .-> Dialog
```

The element imports root modules; nothing in the root imports the element or
Lit. The package exports no instance: each editor page constructs one and
passes it down.

| Folder | Holds |
|---|---|
| `registry/` | `Registry`, `NamespaceEntry`, definition types and validation, `ConsoleFeature` |
| `input/` | `tokenize`, `classify`, `coerce` |
| `execution/` | `bindArguments`, variable access, `InputHistory`, `Scrollback`, builtins and `help` |
| `search/` | `score` tiers, `search`, `complete`, `browse` sections, `typo` tolerance over the `levenshtein` port |
| `element/` | `ConsoleElement` and its styles, `ConsoleLogElement`, `KeyboardController`, `SuggestionController` |

## One keystroke

```mermaid
flowchart TB
    Text["Prompt text changes"] --> Classify["classify(text, registry)"]
    Classify --> Mode{"Mode?"}
    Mode -->|"search"| Empty{"Query empty?"}
    Empty -->|"yes"| Browse["browse(registry, history)<br/>sections"]
    Browse --> Plain
    Empty -->|"no"| Search["search(query)<br/>rank by tier, then score"]
    Search --> Preselect["List with the first result highlighted"]
    Mode -->|"command or variable"| Complete["complete(text, caret)<br/>may await autocomplete()"]
    Complete --> Latest{"Latest request?"}
    Latest -->|"no"| Drop["Discard the result"]
    Latest -->|"yes"| Plain["List with nothing highlighted"]
    Preselect --> Show["Render suggestions"]
    Plain --> Show
```

Search and browse are synchronous. Completion can wait on an `autocomplete()`
promise, so `SuggestionController` numbers each request and drops a result that arrives after a newer
one; the previous completion list stays on screen meanwhile. The list renders
in the prompt shadow root so the combobox IDREFs resolve
([ADR-0007](./docs/adr/0007-the-suggestion-list-shares-the-prompt-shadow-root.md)). An exact variable
match puts the prompt in variable mode before search is tried.

## Submitting a line

```mermaid
sequenceDiagram
    participant Element as jolly-console
    participant Console as CommandConsole
    participant Registry
    participant Handler as Command or variable

    Element->>Console: submit(line)
    Console->>Console: push to history, echo to scrollback
    Console->>Registry: classify(line)
    alt variable
        Console->>Handler: coerce the literal, set(value) if given, then get()
        Console->>Console: info entry with the value
    else command
        Console->>Console: bindArguments, tokens to typed values
        Console->>Handler: execute(values, ctx)
        Handler-->>Console: ctx.print / ctx.error
        Note over Console,Handler: A returned promise keeps the echo pending until it settles
        opt closeOnExecute
            Console-->>Element: close-requested
        end
    else search text
        Console->>Console: error entry, not a variable
    end
    Console-->>Element: scrollback-changed
```

An error thrown while binding or by the handler becomes an error entry;
`submit()` never rethrows. `ctx.signal` aborts when the command is replaced or
unregistered while it runs. While open, the element re-adopts the ambient theme
whenever a `theme` attribute changes, so `theme light` restyles the open
console.

## Registration lifetime

```mermaid
stateDiagram-v2
    [*] --> Registered: registerCommand(name, def)
    Registered --> Replaced: same address registered again
    Replaced --> [*]: signal aborts, old handle becomes a no-op
    Registered --> Unregistered: handle.unregister()
    Unregistered --> [*]: signal aborts, registry-changed
```

The last registration wins for commands, variables and whole namespaces, and a
handle only removes the entry it created. Variables follow the same rules
without a signal. Every change emits `registry-changed`, which refreshes the
list of an open element.

```mermaid
flowchart TB
    List["Editor feature list"] --> Register["registerConsoleFeatures(commands, features, context)"]
    Register --> Feature["feature(commands, context)<br/>registers one namespace"]
    Feature --> Threw{"Threw?"}
    Threw -->|"no"| Collect["Collect its handle"]
    Threw -->|"yes"| Unwind["Unregister collected handles<br/>in reverse, rethrow"]
    Collect --> Combined["One RegistrationHandle<br/>unregisters all in reverse"]
```

## In an editor

```mermaid
flowchart TB
    Standalone["mountStandalone(definition)"] --> Mount["mountConsole()<br/>CommandConsole, stored theme and density,<br/>jolly-console on body"]
    Mount --> Boot["launch, session, definition.mount()"]
    Boot --> Context["EditorContext.commands"]
    Boot -->|"boot fails"| Dispose["dispose()<br/>element removed, registry cleared"]
    Context --> VoxelMap["voxel-map<br/>CONSOLE_FEATURES over the workspace"]
    Context --> PixelArt["pixel-art demo<br/>keybindConsole over keybinding settings"]
    VoxelMap --> Brush["brush namespace"]
    PixelArt --> Keybind["keybind namespace"]
    VoxelMap -. "editor dispose()" .-> Release["feature handle unregisters"]
    PixelArt -. "editor dispose()" .-> Release
```

The host owns the instance. An editor registers its features during `mount()`
and unregisters them on dispose. A new command goes in a feature module plus one
line in the editor's feature list.

For API details, see [CommandConsole](./docs/CommandConsole.md),
[features](./docs/features.md), the [input grammar](./docs/grammar.md),
[jolly-console](./docs/element.md) and the
[architecture decisions](./docs/adr/README.md).
