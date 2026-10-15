export type AccessRole = "owner" | "viewer" | "editor" | null;
export function resolveAccessRole(input: { ownerId: string; userId: string; shares: Array<{ userId: string; role: "viewer" | "editor" }> }): AccessRole {
  if (input.ownerId === input.userId) return "owner";
  const share = input.shares.find((item) => item.userId === input.userId);
  return share?.role ?? null;
}
export function canEdit(role: AccessRole): boolean { return role === "owner" || role === "editor"; }
