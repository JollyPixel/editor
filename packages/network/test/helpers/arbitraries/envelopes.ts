// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import type {
  ClientEnvelope,
  Right,
  ServerEnvelope
} from "#src/index.ts";
import {
  jsonPayload,
  metadata,
  objectOf
} from "./json.ts";

// CONSTANTS
const kRoom = fc.string({ maxLength: 8 });
const kText = fc.string({ maxLength: 8 });
const kRight = fc.constantFrom<Right>("read", "write", "void");
const kPeer = fc.record({
  clientId: kText,
  role: kText,
  profile: metadata,
  presence: metadata
});

export const clientEnvelope: fc.Arbitrary<ClientEnvelope> = fc.oneof(
  fc.record({
    room: kRoom,
    kind: fc.constant("join"),
    profile: metadata,
    presence: metadata,
    resume: jsonPayload
  }, { requiredKeys: ["room", "kind"] }),
  fc.record({
    room: kRoom,
    kind: fc.constantFrom("leave", "resync")
  }),
  fc.record({
    room: kRoom,
    kind: fc.constant("message"),
    payload: jsonPayload
  }),
  fc.record({
    room: kRoom,
    kind: fc.constant("presence"),
    patch: metadata
  })
);

export const serverEnvelope: fc.Arbitrary<ServerEnvelope> = fc.oneof(
  fc.record({
    room: kRoom,
    kind: fc.constant("message"),
    payload: jsonPayload
  }),
  fc.record({
    room: kRoom,
    kind: fc.constant("sync"),
    self: kText,
    rights: objectOf(kRight),
    members: fc.array(kPeer, { maxLength: 3 })
  }),
  fc.record({
    room: kRoom,
    kind: fc.constant("peer-joined"),
    clientId: kText,
    role: kText,
    profile: metadata,
    presence: metadata
  }),
  fc.record({
    room: kRoom,
    kind: fc.constant("peer-left"),
    clientId: kText
  }),
  fc.record({
    room: kRoom,
    kind: fc.constant("peer-presence"),
    clientId: kText,
    patch: metadata
  }),
  fc.record({
    room: kRoom,
    kind: fc.constantFrom("denied", "error"),
    event: kText,
    reason: kText
  })
);
