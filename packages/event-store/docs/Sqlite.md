# SQLite persistence

Use this backend for a file-backed store or when an application already works
with SQLite. It uses Node's built-in `node:sqlite` module and passes its string
`location` to `DatabaseSync`.

```ts
EventStore.persistence.sqlite<TMap>(
  location?: string
): Promise<TypedEventStore<TMap>>
```

The optional `TMap` schema map is described in
[EventStore](./EventStore.md#schema-map); it defaults to an unconstrained map.

```ts
import * as EventStore from "@jolly-pixel/event-store";

using store = await EventStore.persistence.sqlite("./events.sqlite");
```

Passing a file path creates or opens a durable database. The default location
is `":memory:"`, which lasts only until its SQLite connection closes.

The factory returns a promise because the main package entry point loads the
Node-only backend when the factory is called. Importing the main entry point is
safe in a browser bundle as long as the SQLite factory is not called.

## Node-only entry point

Node.js applications can import the factory directly:

```ts
import { createSqliteEventStore } from "@jolly-pixel/event-store/sqlite";

using store = await createSqliteEventStore("./events.sqlite");
```

The `./sqlite` entry point also exports `SQL_SCHEMA` and `SqliteEventLog` for
applications that manage their own `DatabaseSync` connection:

```ts
import { DatabaseSync } from "node:sqlite";
import { createEventStore } from "@jolly-pixel/event-store";
import {
  SQL_SCHEMA,
  SqliteEventLog
} from "@jolly-pixel/event-store/sqlite";

const database = new DatabaseSync("./events.sqlite");
database.exec(SQL_SCHEMA);
using store = createEventStore(new SqliteEventLog(database));
```

`SqliteEventLog` expects the schema to exist. Closing the log, either directly
or through the store, also closes the connection passed to its constructor.

## Schema initialization

The factory runs `SQL_SCHEMA` before returning. It creates the `events` table
and its indexes when they do not exist.

`CREATE TABLE IF NOT EXISTS` does not alter an existing table. A database made
with a schema that predates the unique `(asset_id, event_version)` constraint
must be migrated by the application or recreated.

## Multiple connections

Each insert assigns the next asset version in the `INSERT` statement, while the
schema's unique `(asset_id, event_version)` constraint prevents two connections
from storing the same version for one asset. If SQLite rejects the insert,
`writer.append` returns a `Result` error under the shared
[`EventStore` contract](./EventStore.md#writer).

## Compaction

[`compact`](./EventStore.md#compaction) deletes superseded rows. With the
default `reclaim: true`, it runs `VACUUM` after a deletion so the file can
release freed pages. Pass `reclaim: false` to skip `VACUUM` and leave the file
at its current size.
