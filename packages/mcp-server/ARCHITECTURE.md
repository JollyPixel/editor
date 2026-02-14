# 🏗️ Project Architecture

```
src/
  index.ts              — Entry point: creates the server, registers everything, connects transport
  utils.ts              — Shared collectFiles utility
  resources/
    index.ts            — Registers resources (README, architecture)
  tools/
    index.ts            — Registers tools (list-docs, read-doc, read-source, etc.)
  prompts/
    index.ts            — Registers prompt templates (create-behavior, create-actor-setup)
```
