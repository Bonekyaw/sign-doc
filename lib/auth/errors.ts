export class AuthError extends Error {
  readonly code: "UNAUTHORIZED" | "FORBIDDEN";

  constructor(message: string, code: "UNAUTHORIZED" | "FORBIDDEN" = "UNAUTHORIZED") {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}
