import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminUserListRoleFilter,
  canAdminManageUserRole,
} from "@/lib/auth/user-management";
import { createUserSchema } from "@/lib/schemas/user";

describe("canAdminManageUserRole", () => {
  it("allows OWNER to manage any role", () => {
    assert.equal(canAdminManageUserRole("OWNER", "ADMIN"), true);
    assert.equal(canAdminManageUserRole("OWNER", "DOCTOR"), true);
  });

  it("allows ADMIN to manage doctor accounts only", () => {
    assert.equal(canAdminManageUserRole("ADMIN", "DOCTOR"), true);
    assert.equal(canAdminManageUserRole("ADMIN", "ADMIN"), false);
    assert.equal(canAdminManageUserRole("ADMIN", "OWNER"), false);
  });
});

describe("adminUserListRoleFilter", () => {
  it("limits ADMIN listings to doctor accounts", () => {
    assert.equal(adminUserListRoleFilter("ADMIN"), "DOCTOR");
    assert.equal(adminUserListRoleFilter("OWNER"), undefined);
  });
});

describe("createUserSchema", () => {
  it("requires a linked doctor for doctor accounts", () => {
    const result = createUserSchema.safeParse({
      username: "drlee",
      password: "password1",
      role: "DOCTOR",
    });
    assert.equal(result.success, false);
  });

  it("accepts valid doctor account input", () => {
    const result = createUserSchema.safeParse({
      username: "drlee",
      password: "password1",
      role: "DOCTOR",
      doctorId: "doc-1",
    });
    assert.equal(result.success, true);
  });
});
