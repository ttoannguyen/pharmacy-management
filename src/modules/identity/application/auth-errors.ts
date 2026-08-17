export class UnauthorizedError extends Error {
  readonly code = "UNAUTHENTICATED";

  constructor(message = "Authentication is required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class InvalidCredentialsError extends Error {
  readonly code = "INVALID_CREDENTIALS";

  constructor() {
    super("Invalid email or password.");
    this.name = "InvalidCredentialsError";
  }
}

export class RateLimitedError extends Error {
  readonly code = "AUTH_RATE_LIMITED";
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many login attempts. Please try again later.");
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class AuthConfigurationError extends Error {
  readonly code = "AUTH_CONFIGURATION_ERROR";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AuthConfigurationError";
  }
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";

  constructor(message = "You do not have access to this resource.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class StoreSelectionRequiredError extends Error {
  readonly code = "STORE_SELECTION_REQUIRED";
  readonly stores: ReadonlyArray<{ id: string; code: string; name: string }>;

  constructor(stores: ReadonlyArray<{ id: string; code: string; name: string }>) {
    super("Select an active store before continuing.");
    this.name = "StoreSelectionRequiredError";
    this.stores = stores;
  }
}
