// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { accountSchema } from "../account/Account.ts";
import { ACCOUNTS_ERROR_CODES } from "../account/errors/AccountsError.ts";
import { ACCOUNTS_REQUEST_ERROR_CODES } from "./routes.ts";

export const credentialsBodySchema = z.object({
  username: z.string(),
  password: z.string()
});

export const registrationBodySchema = credentialsBodySchema.extend({
  masterPassword: z.string().optional()
});

export const accountReplySchema = z.object({
  account: accountSchema
});

export const failureReplySchema = z.object({
  code: z.enum([
    ...ACCOUNTS_ERROR_CODES,
    ...ACCOUNTS_REQUEST_ERROR_CODES
  ]).catch("unknown"),
  message: z.string().optional().catch(undefined)
});

export type CredentialsBody = z.input<typeof credentialsBodySchema>;
export type RegistrationBody = z.input<typeof registrationBodySchema>;
export type AccountReply = z.input<typeof accountReplySchema>;
export type FailureReply = z.input<typeof failureReplySchema>;
