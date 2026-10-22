// Import Third-party Dependencies
import { AccountsError } from "@jolly-pixel/accounts";
import { InvalidPreferencesError } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { ApiError } from "./ApiError.ts";
import { accountsFailure } from "./accountsFailure.ts";
import { InvalidSettingsError } from "../../project/errors/InvalidSettingsError.ts";
import { ProjectRightRefusedError } from "../../../shared/errors/ProjectRightRefusedError.ts";
import { RoleInUseError } from "../../project/errors/RoleInUseError.ts";
import { UnknownScopeError } from "../../preferences/errors/UnknownScopeError.ts";
import { UnknownAssetError } from "../../shares/errors/UnknownAssetError.ts";

// CONSTANTS
const kPayloadTooLarge = 413;

export interface FrameworkError extends Error {
  statusCode?: number;
}

export function apiFailure(
  error: FrameworkError
): ApiError | null {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof AccountsError) {
    return accountsFailure(error);
  }
  if (error instanceof ProjectRightRefusedError) {
    return new ApiError(403, "refused", error.message);
  }
  if (error instanceof UnknownAssetError || error instanceof UnknownScopeError) {
    return new ApiError(404, "not-found", error.message);
  }
  if (error instanceof InvalidSettingsError) {
    return new ApiError(400, "invalid-settings", error.message);
  }
  if (error instanceof InvalidPreferencesError) {
    return new ApiError(400, "invalid-request", error.message);
  }
  if (error instanceof RoleInUseError) {
    return new ApiError(409, "role-in-use", error.message);
  }
  if (error.statusCode === kPayloadTooLarge) {
    return new ApiError(
      kPayloadTooLarge,
      "payload-too-large",
      "the request body is too large"
    );
  }
  if (
    error.statusCode !== undefined &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    return new ApiError(
      error.statusCode,
      "invalid-request",
      "the request is malformed"
    );
  }

  return null;
}
