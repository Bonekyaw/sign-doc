export const ACCESS_TOKEN_COOKIE = "access_token";

export const SESSION_MAX_AGE_SECONDS = Number(
  process.env.SESSION_MAX_AGE_SECONDS ?? 60 * 60 * 8,
);
