import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLoginRedirectPath } from "@/lib/auth/login-redirect";

describe("getLoginRedirectPath", () => {
  it("uses safe relative next path when provided", () => {
    assert.equal(
      getLoginRedirectPath("ADMIN", "/schedule/2026/5"),
      "/schedule/2026/5",
    );
  });

  it("rejects protocol-relative next paths", () => {
    assert.equal(getLoginRedirectPath("ADMIN", "//evil.example"), "/");
  });

  it("sends doctors to my-schedule by default", () => {
    assert.equal(getLoginRedirectPath("DOCTOR", ""), "/my-schedule");
  });

  it("sends admins to dashboard by default", () => {
    assert.equal(getLoginRedirectPath("ADMIN", ""), "/");
    assert.equal(getLoginRedirectPath("OWNER", ""), "/");
  });
});
