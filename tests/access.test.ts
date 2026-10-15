import { describe, expect, it } from "vitest";
import { canEdit, resolveAccessRole } from "../src/utils/access";
describe("document access rules", () => {
  const shares = [{ userId: "editor-1", role: "editor" as const }, { userId: "viewer-1", role: "viewer" as const }];
  it("always recognizes the owner", () => { expect(resolveAccessRole({ ownerId: "owner-1", userId: "owner-1", shares })).toBe("owner"); });
  it("distinguishes editor, viewer, and unshared user", () => { expect(resolveAccessRole({ ownerId: "owner-1", userId: "editor-1", shares })).toBe("editor"); expect(resolveAccessRole({ ownerId: "owner-1", userId: "viewer-1", shares })).toBe("viewer"); expect(resolveAccessRole({ ownerId: "owner-1", userId: "stranger", shares })).toBeNull(); });
  it("allows edits for owners and editors, never viewers or strangers", () => { expect(canEdit("owner")).toBe(true); expect(canEdit("editor")).toBe(true); expect(canEdit("viewer")).toBe(false); expect(canEdit(null)).toBe(false); });
});
