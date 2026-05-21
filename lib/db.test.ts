import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTransientDbError } from "@/lib/db";

describe("isTransientDbError", () => {
  it("detects ECONNRESET from driver errors", () => {
    assert.equal(isTransientDbError({ code: "ECONNRESET" }), true);
  });

  it("detects Prisma connection error codes", () => {
    assert.equal(isTransientDbError({ code: "P1017" }), true);
  });

  it("walks nested error causes", () => {
    assert.equal(
      isTransientDbError({
        code: "P2024",
        cause: { code: "ECONNRESET" },
      }),
      true,
    );
  });

  it("ignores non-transient errors", () => {
    assert.equal(isTransientDbError({ code: "P2002" }), false);
  });
});
