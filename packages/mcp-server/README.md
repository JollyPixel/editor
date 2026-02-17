<h1 align="center">
  MCP-Server
</h1>

<p align="center">
  MCP server for @jolly-pixel/engine — exposes docs, source, and tools to LLMs
</p>

## 📌 About

This package implements a [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server
that gives LLMs structured access to the `@jolly-pixel/engine` codebase.
It exposes documentation, source code, and prompt templates so that AI assistants
can understand and generate code that follows the engine's conventions.

## 💃 Getting Started

Link the `jolly-pixel-mcp` binary:

```bash
npm link
```

### Running the server

```bash
jolly-pixel-mcp
```

The server communicates over **stdio** using the MCP protocol.

## ⚙️ Configuration

### VS Code (GitHub Copilot / Copilot Chat)

Create (or edit) `.vscode/mcp.json` at the workspace root:

```json
{
  "servers": {
    "jolly-pixel-engine": {
      "command": "jolly-pixel-mcp"
    }
  }
}
```

### Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "jolly-pixel-engine": {
      "command": "jolly-pixel-mcp"
    }
  }
}
```

## 📚 API

### Resources

| Name | URI | Description |
| --- | --- | --- |
| `engine-readme` | `docs://engine/readme` | The main README of `@jolly-pixel/engine` |
| `engine-architecture` | `docs://engine/architecture` | The architecture document of `@jolly-pixel/runtime` |

### Tools

| Name | Description |
| --- | --- |
| `list-docs` | List all available documentation files for the engine |
| `read-doc` | Read a specific documentation file by relative path |
| `read-source` | Read a specific source file by relative path |
| `list-source-files` | List all TypeScript source files in the engine |
| `search-code` | Search for a pattern (string or regex) across engine source files |
| `get-api-summary` | Get the public API summary for a module (actor, components, systems, controls, audio, ui) |

### Prompts

| Name | Description |
| --- | --- |
| `create-behavior` | Generate a new Behavior class for an Actor |
| `create-actor-setup` | Generate a complete Actor setup with components |

## 🔍 Debugging

Use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to test the server interactively:

```bash
npx @modelcontextprotocol/inspector jolly-pixel-mcp
```

## License

MIT
