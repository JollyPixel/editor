// Import Third-party Dependencies
import * as z from "zod";

// CONSTANTS
export const AGENT_TOKEN_VIA = "golem";
export const AGENT_TOKEN_DEFAULT_NAME = "Golem";
export const AGENT_TOKEN_NAME_MAX_LENGTH = 32;
const kSubjectPrefix = "agent:";

export const agentTokenNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(AGENT_TOKEN_NAME_MAX_LENGTH);

export const agentTokenSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string(),
  createdAt: z.number()
});

export type AgentToken = z.infer<typeof agentTokenSchema>;

const kAgentProfileSchema = z.object({
  username: z.string(),
  peerId: z.string(),
  via: z.literal(AGENT_TOKEN_VIA),
  ownerId: z.string()
});

export type AgentProfile = z.infer<typeof kAgentProfileSchema>;

export function agentTokenSubject(
  tokenId: string
): string {
  return kSubjectPrefix + tokenId;
}

export function agentTokenId(
  subject: string
): string | null {
  return subject.startsWith(kSubjectPrefix) ?
    subject.slice(kSubjectPrefix.length) :
    null;
}

export function isAgentProfile(
  profile: { readonly via?: string; }
): boolean {
  return profile.via === AGENT_TOKEN_VIA;
}

export function parseAgentProfile(
  metadata: Readonly<Record<string, unknown>>
): AgentProfile | null {
  const profile = kAgentProfileSchema.safeParse(metadata);

  return profile.success ? profile.data : null;
}
