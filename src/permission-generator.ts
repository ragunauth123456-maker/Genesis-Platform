/**
 * Permission Generator
 *
 * Takes entities and endpoints from a GenerationResult and produces:
 *   - Role definitions — auto-generated RBAC roles (admin, manager, editor, viewer, entity-specific)
 *   - Permissions matrix — per-role, per-entity, per-action table + TypeScript object
 *   - RBAC middleware — Hono middleware for JWT/API key role checking
 *   - Permission types — TypeScript types for Role, Permission, PermissionCheck
 *   - Seed script — seed-roles.ts for database role/permission seeding
 *
 * Output is rendered as code artifacts ready for project integration.
 */

import type { GeneratedEntity, GeneratedEndpoint } from "./generate";

// ── Types ──────────────────────────────────────────────────────────────────────

export type RbacAction = "create" | "read" | "update" | "delete" | "export" | "approve";

export interface RoleDef {
  name: string;
  description: string;
  permissions: Array<{
    entity: string;
    actions: RbacAction[];
  }>;
}

export interface PermissionProject {
  roles: RoleDef[];
  permissionsMatrix: string;       // Markdown/HTML table string
  permissionsObject: string;       // TypeScript permissions object
  rbacMiddleware: string;          // Hono middleware code
  permissionTypes: string;         // TypeScript type definitions
  seedScript: string;              // seed-roles.ts
  summary: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** All possible CRUD + extended actions */
const ALL_ACTIONS: RbacAction[] = ["create", "read", "update", "delete", "export", "approve"];
const CRUD_ACTIONS: RbacAction[] = ["create", "read", "update", "delete"];
const READ_ONLY: RbacAction[] = ["read"];
const EDITOR_ACTIONS: RbacAction[] = ["create", "read", "update"];

/** Guess which entities might be "primary" (largest model / most fields) */
function identifyPrimaryEntities(entities: GeneratedEntity[]): Set<string> {
  if (entities.length <= 2) return new Set(entities.map((e) => e.name));

  // Sort by number of fields — top half are primary
  const sorted = [...entities].sort((a, b) => b.fields.length - a.fields.length);
  const cutoff = Math.max(2, Math.ceil(sorted.length / 2));
  return new Set(sorted.slice(0, cutoff).map((e) => e.name));
}

/** Generate entity-specific role names (e.g., housekeeping, receptionist for hotel) */
function deriveEntityRole(entityName: string, domain: string): string | null {
  const lower = entityName.toLowerCase();
  const domainLower = domain.toLowerCase();

  // Common role mappings by entity name
  const roleMap: Record<string, string[]> = {
    guest: ["receptionist", "front-desk", "guest-relations"],
    room: ["housekeeping", "maintenance", "room-manager"],
    booking: ["reservations-agent", "booking-manager"],
    patient: ["nurse", "receptionist", "medical-records"],
    doctor: ["physician", "specialist"],
    appointment: ["scheduler", "appointment-coordinator"],
    product: ["inventory-manager", "catalog-editor"],
    order: ["order-fulfillment", "shipping-coordinator"],
    invoice: ["billing-specialist", "accounts-receivable"],
    employee: ["hr-manager", "hr-coordinator"],
    student: ["teacher", "academic-advisor"],
    course: ["instructor", "curriculum-designer"],
    task: ["project-manager", "team-lead"],
    project: ["project-manager", "program-manager"],
    shipment: ["logistics-coordinator", "warehouse-manager"],
    contact: ["sales-representative", "account-manager"],
    deal: ["sales-manager", "deal-closer"],
  };

  for (const [key, roles] of Object.entries(roleMap)) {
    if (lower.includes(key)) {
      // Return the first role that makes sense for this domain
      return roles[0];
    }
  }

  // Generic fallback: entity-operator
  return `${lower}-operator`;
}

// ── Role Generation ────────────────────────────────────────────────────────────

function generateRoles(entities: GeneratedEntity[], domain: string): RoleDef[] {
  const roles: RoleDef[] = [];
  const primaryEntities = identifyPrimaryEntities(entities);

  // ── Admin — full CRUD on ALL entities ──
  roles.push({
    name: "admin",
    description: "Full administrative access to all entities and operations",
    permissions: entities.map((e) => ({
      entity: e.name,
      actions: [...ALL_ACTIONS],
    })),
  });

  // ── Manager — CRUD + approve on primary entities, read on others ──
  roles.push({
    name: "manager",
    description: "Management access with approval authority on primary entities",
    permissions: entities.map((e) => ({
      entity: e.name,
      actions: primaryEntities.has(e.name)
        ? [...ALL_ACTIONS]
        : [...CRUD_ACTIONS],
    })),
  });

  // ── Editor — create, read, update on assigned entities ──
  roles.push({
    name: "editor",
    description: "Can create, read, and update content on assigned entities",
    permissions: entities.map((e) => ({
      entity: e.name,
      actions: [...EDITOR_ACTIONS],
    })),
  });

  // ── Viewer — read-only on all entities ──
  roles.push({
    name: "viewer",
    description: "Read-only access to all entities",
    permissions: entities.map((e) => ({
      entity: e.name,
      actions: [...READ_ONLY],
    })),
  });

  // ── Entity-specific roles (one per entity) ──
  for (const entity of entities) {
    const roleName = deriveEntityRole(entity.name, domain);
    if (!roleName) continue;

    // Entity-specific role: full CRUD on their entity, read on others
    roles.push({
      name: roleName,
      description: `Specialized role for managing ${entity.name.toLowerCase()} operations`,
      permissions: entities.map((e) => ({
        entity: e.name,
        actions: e.name === entity.name
          ? [...CRUD_ACTIONS, "export"]
          : [...READ_ONLY],
      })),
    });
  }

  return roles;
}

// ── Permissions Matrix (HTML Table) ────────────────────────────────────────────

function buildPermissionsMatrix(roles: RoleDef[], entities: GeneratedEntity[]): string {
  const lines: string[] = [];

  // Header row
  lines.push("| Role | " + entities.map((e) => e.name).join(" | ") + " |");
  lines.push("|" + "------|".repeat(entities.length + 1));

  // One row per role
  for (const role of roles) {
    const cells = entities.map((entity) => {
      const perm = role.permissions.find((p) => p.entity === entity.name);
      if (!perm || perm.actions.length === 0) return "—";
      if (perm.actions.length === ALL_ACTIONS.length) return "🔓 Full";
      // Abbreviate actions
      const short: Record<string, string> = { create: "C", read: "R", update: "U", delete: "D", export: "E", approve: "A" };
      return perm.actions.map((a) => short[a] || a).join("");
    });
    lines.push(`| **${role.name}** | ${cells.join(" | ")} |`);
  }

  return lines.join("\n");
}

// ── Permissions Object (TypeScript) ────────────────────────────────────────────

function buildPermissionsObject(roles: RoleDef[]): string {
  const lines: string[] = [];
  lines.push("/**");
  lines.push(" * Auto-generated permissions object from Genesis Platform.");
  lines.push(" * Maps role → entity → allowed actions.");
  lines.push(" */");
  lines.push("");
  lines.push("export const rolePermissions: Record<string, Record<string, string[]>> = {");

  for (const role of roles) {
    lines.push(`  ${JSON.stringify(role.name)}: {`);
    for (const perm of role.permissions) {
      lines.push(`    ${JSON.stringify(perm.entity)}: ${JSON.stringify(perm.actions)},`);
    }
    lines.push("  },");
  }

  lines.push("};");
  lines.push("");

  // Helper function
  lines.push("/**");
  lines.push(" * Check if a role has permission for an action on an entity.");
  lines.push(" */");
  lines.push("export function hasPermission(");
  lines.push("  role: string,");
  lines.push("  entity: string,");
  lines.push("  action: string");
  lines.push("): boolean {");
  lines.push("  const entityPerms = rolePermissions[role]?.[entity];");
  lines.push("  if (!entityPerms) return false;");
  lines.push("  return entityPerms.includes(action);");
  lines.push("}");

  return lines.join("\n");
}

// ── Permission Types (TypeScript) ──────────────────────────────────────────────

function buildPermissionTypes(): string {
  return `/**
 * Permission type definitions for RBAC system.
 * Generated by Genesis Platform.
 */

// ── Actions ────────────────────────────────────────────────────────────────────

export const ALL_ACTIONS = [
  "create",
  "read",
  "update",
  "delete",
  "export",
  "approve",
] as const;

export type RbacAction = (typeof ALL_ACTIONS)[number];

// ── Permission ─────────────────────────────────────────────────────────────────

export interface EntityPermission {
  entity: string;
  actions: RbacAction[];
}

// ── Role ───────────────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: EntityPermission[];
  createdAt: string;
  updatedAt: string;
}

// ── Permission Check ───────────────────────────────────────────────────────────

export interface PermissionCheck {
  role: string;
  entity: string;
  action: RbacAction;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: string;
}

// ── User-Role Assignment ───────────────────────────────────────────────────────

export interface UserRole {
  userId: string;
  roleId: string;
  assignedAt: string;
  assignedBy?: string;
}

// ── Role Hierarchy ─────────────────────────────────────────────────────────────

export const ROLE_HIERARCHY: Record<string, number> = {
  admin: 100,
  manager: 80,
  editor: 60,
  viewer: 40,
};

export function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

export function roleCanImpersonate(role: string, targetRole: string): boolean {
  return getRoleLevel(role) > getRoleLevel(targetRole);
}
`;
}

// ── RBAC Middleware (Hono) ─────────────────────────────────────────────────────

function buildRbacMiddleware(entities: GeneratedEntity[]): string {
  const entityNames = entities.map((e) => e.name);

  return `/**
 * RBAC Middleware — Hono middleware for role-based access control.
 * Generated by Genesis Platform.
 *
 * Usage:
 *   import { rbacMiddleware } from "./middleware/rbac";
 *   router.use("/api/*", rbacMiddleware);
 *   router.get("/api/admin/*", requireRole("admin"));
 *   router.get("/api/bookings", requirePermission("Booking", "read"));
 */

import type { Context, Next } from "hono";
import { getCookie, bearerAuth } from "hono/xxx-utils"; // Replace with your auth extraction

// ── Types ──────────────────────────────────────────────────────────────────────

export type RbacAction = "create" | "read" | "update" | "delete" | "export" | "approve";

interface JwtPayload {
  sub: string;       // User ID
  role: string;      // Primary role
  roles?: string[];  // All assigned roles
  iat: number;
  exp: number;
}

// ── Permission Matrix ──────────────────────────────────────────────────────────
// Maps role → entity → allowed actions

const PERMISSIONS: Record<string, Record<string, RbacAction[]>> = {
${entityNames.map((name) => {
  return `  ${JSON.stringify(name)}: {
    admin: ["create", "read", "update", "delete", "export", "approve"],
    manager: ["create", "read", "update", "delete", "export", "approve"],
    editor: ["create", "read", "update"],
    viewer: ["read"],
  },`;
}).join("\n")}
};

// ── JWT Extraction ─────────────────────────────────────────────────────────────

/**
 * Extract user identity from the request.
 * Supports JWT in Authorization header (Bearer), cookie, or X-API-Key header.
 */
async function extractUser(c: Context): Promise<JwtPayload | null> {
  // Try Bearer token in Authorization header
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return verifyJwt(token);
  }

  // Try API key in X-API-Key header
  const apiKey = c.req.header("X-API-Key");
  if (apiKey) {
    return verifyApiKey(apiKey);
  }

  // Try session cookie
  const sessionCookie = getCookie(c, "session");
  if (sessionCookie) {
    return verifyJwt(sessionCookie);
  }

  return null;
}

/**
 * Verify and decode a JWT token.
 * Replace with your actual JWT verification logic (jose, jwks, etc.).
 */
async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    // In production: use jose/jwtVerify with your JWKS or secret
    // const { payload } = await jwtVerify(token, secret);
    // return payload as JwtPayload;

    // Placeholder — decode without verification (DEV ONLY)
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    ) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify an API key and return the associated user/role.
 * Replace with your actual API key lookup logic.
 */
async function verifyApiKey(apiKey: string): Promise<JwtPayload | null> {
  // In production: look up API key in database
  // const keyRecord = await db.queryOne(
  //   \`SELECT * FROM api_keys WHERE key = $1 AND revoked_at IS NULL\`,
  //   [apiKey]
  // );

  // Placeholder — default to viewer role
  return {
    sub: "api-key-user",
    role: "viewer",
    roles: ["viewer"],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
}

// ── Entity-Action Mapping from HTTP Method ─────────────────────────────────────

/**
 * Map HTTP method to RBAC action.
 */
function methodToAction(method: string): RbacAction | null {
  switch (method.toUpperCase()) {
    case "GET":    return "read";
    case "POST":   return "create";
    case "PUT":
    case "PATCH":  return "update";
    case "DELETE": return "delete";
    default:       return null;
  }
}

/**
 * Extract entity name from URL path.
 * e.g. "/api/bookings/123/check-in" → "Booking"
 *      "/api/guests" → "Guest"
 */
function pathToEntity(path: string): string | null {
  const parts = path.replace(/^\\/api\\//, "").split("/").filter(Boolean);
  if (parts.length === 0) return null;

  const resource = parts[0]; // "bookings", "guests", etc.

  // Map plural resource names to entity names
  const entityMap: Record<string, string> = {
${entityNames.map((name) => {
  const plural = name.toLowerCase() + (name.toLowerCase().endsWith("s") ? "es" : "s");
  return `    ${JSON.stringify(plural)}: ${JSON.stringify(name)},`;
}).join("\n")}
  };

  return entityMap[resource] || null;
}

// ── Middleware ─────────────────────────────────────────────────────────────────

/**
 * Global RBAC middleware — attaches user and role to context.
 * Does NOT deny requests; use requireRole/requirePermission for enforcement.
 */
export async function rbacMiddleware(c: Context, next: Next) {
  const user = await extractUser(c);
  if (user) {
    c.set("user", user);
    c.set("role", user.role);
    c.set("roles", user.roles || [user.role]);
  }
  await next();
}

// ── Role-gated middleware factory ───────────────────────────────────────────────

/**
 * Require a minimum role level to access this route.
 *
 * Usage:
 *   router.get("/api/admin/users", requireRole("admin"), handler);
 */
export function requireRole(requiredRole: string) {
  return async (c: Context, next: Next) => {
    const user = c.get("user") as JwtPayload | undefined;

    if (!user) {
      return c.json({
        error: "Authentication required",
        code: "UNAUTHORIZED",
      }, 401);
    }

    const userRoles = user.roles || [user.role];
    const hasRole = userRoles.some((r) => r === requiredRole || r === "admin");

    if (!hasRole) {
      return c.json({
        error: \`Role "\${requiredRole}" required. Your role: \${user.role}\`,
        code: "FORBIDDEN",
        requiredRole,
        currentRole: user.role,
      }, 403);
    }

    await next();
  };
}

// ── Permission-gated middleware factory ─────────────────────────────────────────

/**
 * Require a specific permission (entity + action) to access this route.
 * Automatically extracts the entity from the URL path.
 *
 * Usage:
 *   router.get("/api/bookings", requirePermission("Booking", "read"), handler);
 *   router.post("/api/bookings", requirePermission("Booking", "create"), handler);
 */
export function requirePermission(entity: string, action: RbacAction) {
  return async (c: Context, next: Next) => {
    const user = c.get("user") as JwtPayload | undefined;

    if (!user) {
      return c.json({
        error: "Authentication required. Please provide a valid JWT or API key.",
        code: "UNAUTHORIZED",
      }, 401);
    }

    // Admin bypass — admin has all permissions
    const userRoles = user.roles || [user.role];
    if (userRoles.includes("admin")) {
      await next();
      return;
    }

    // Check each role the user has
    let allowed = false;
    for (const role of userRoles) {
      const entityPerms = PERMISSIONS[entity]?.[role];
      if (entityPerms && entityPerms.includes(action)) {
        allowed = true;
        break;
      }
    }

    if (!allowed) {
      return c.json({
        error: \`Permission denied: \${action} access on \${entity}\`,
        code: "FORBIDDEN",
        requiredAction: action,
        requiredEntity: entity,
        currentRole: user.role,
        currentRoles: userRoles,
      }, 403);
    }

    await next();
  };
}

// ── Auto-enforce middleware (infers entity + action from request) ───────────────

/**
 * Automatically enforces RBAC by inferring entity from path and action from method.
 * Use as a blanket middleware on all /api/* routes.
 *
 * Usage:
 *   router.use("/api/*", autoEnforceRbac);
 */
export async function autoEnforceRbac(c: Context, next: Next) {
  const user = c.get("user") as JwtPayload | undefined;

  // Skip unauthenticated requests (let downstream handle 401)
  if (!user) {
    await next();
    return;
  }

  const path = c.req.path;
  const method = c.req.method;
  const action = methodToAction(method);
  const entity = pathToEntity(path);

  // If we can't map this request to an entity+action, allow it through
  if (!entity || !action) {
    await next();
    return;
  }

  // Admin bypass
  const userRoles = user.roles || [user.role];
  if (userRoles.includes("admin")) {
    await next();
    return;
  }

  // Check permission
  let allowed = false;
  for (const role of userRoles) {
    const entityPerms = PERMISSIONS[entity]?.[role];
    if (entityPerms && entityPerms.includes(action)) {
      allowed = true;
      break;
    }
  }

  if (!allowed) {
    return c.json({
      error: \`Permission denied: \${action} on \${entity}\`,
      code: "FORBIDDEN",
      requiredAction: action,
      requiredEntity: entity,
      currentRole: user.role,
    }, 403);
  }

  await next();
}
`;
}

// ── Seed Script ─────────────────────────────────────────────────────────────────

function buildSeedScript(roles: RoleDef[]): string {
  const roleInserts = roles
    .map(
      (r) =>
        `    ["${r.name}", "${r.description}", '${JSON.stringify(r.permissions)}'::jsonb]`
    )
    .join(",\n");

  const roleNames = roles.map((r) => r.name);

  return `/**
 * Seed Script — Create default RBAC roles and permissions.
 * Generated by Genesis Platform.
 *
 * Usage:
 *   bun run seed-roles.ts
 *   # or: ts-node seed-roles.ts
 *   # or import and call seedRoles(db)
 */

import { randomUUID } from "crypto";

// ── Types ──────────────────────────────────────────────────────────────────────

interface RoleRow {
  id: string;
  name: string;
  description: string;
  permissions: Array<{
    entity: string;
    actions: string[];
  }>;
  created_at: string;
  updated_at: string;
}

// ── Seed Data ──────────────────────────────────────────────────────────────────

const DEFAULT_ROLES: Array<Omit<RoleRow, "id" | "created_at" | "updated_at">> = [
  {
    name: "admin",
    description: "Full administrative access to all entities and operations",
    permissions: ${JSON.stringify(roles.find((r) => r.name === "admin")?.permissions || [])},
  },
  {
    name: "manager",
    description: "Management access with approval authority on primary entities",
    permissions: ${JSON.stringify(roles.find((r) => r.name === "manager")?.permissions || [])},
  },
  {
    name: "editor",
    description: "Can create, read, and update content on assigned entities",
    permissions: ${JSON.stringify(roles.find((r) => r.name === "editor")?.permissions || [])},
  },
  {
    name: "viewer",
    description: "Read-only access to all entities",
    permissions: ${JSON.stringify(roles.find((r) => r.name === "viewer")?.permissions || [])},
  },
${roles
  .filter((r) => !["admin", "manager", "editor", "viewer"].includes(r.name))
  .map(
    (r) =>
      `  {
    name: "${r.name}",
    description: "${r.description}",
    permissions: ${JSON.stringify(r.permissions)},
  },`
  )
  .join("\n")}
];

// ── Database Setup ─────────────────────────────────────────────────────────────

/**
 * Create the roles table if it doesn't exist.
 */
const CREATE_TABLE_SQL = \`
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
\`;

// ── Seed Function ──────────────────────────────────────────────────────────────

export interface SeedResult {
  created: string[];
  skipped: string[];
  errors: string[];
}

/**
 * Seed the database with default roles.
 * Uses ON CONFLICT to make it idempotent — safe to run multiple times.
 */
export async function seedRoles(
  db: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  }
): Promise<SeedResult> {
  const result: SeedResult = { created: [], skipped: [], errors: [] };

  // Ensure the tables exist
  try {
    await db.query(CREATE_TABLE_SQL);
  } catch (err) {
    result.errors.push(\`Failed to create roles tables: \${err}\`);
    return result;
  }

  // Insert or skip each role
  for (const role of DEFAULT_ROLES) {
    try {
      const existing = await db.query(
        "SELECT id FROM roles WHERE name = $1",
        [role.name]
      );

      if (existing.rows.length > 0) {
        // Role exists — update permissions (they may have changed)
        await db.query(
          \`UPDATE roles
           SET description = $1, permissions = $2, updated_at = NOW()
           WHERE name = $3\`,
          [role.description, JSON.stringify(role.permissions), role.name]
        );
        result.skipped.push(\`\${role.name} (updated)\`);
      } else {
        // Create new role
        await db.query(
          \`INSERT INTO roles (id, name, description, permissions)
           VALUES ($1, $2, $3, $4)\`,
          [
            randomUUID(),
            role.name,
            role.description,
            JSON.stringify(role.permissions),
          ]
        );
        result.created.push(role.name);
      }
    } catch (err) {
      result.errors.push(
        \`\${role.name}: \${err instanceof Error ? err.message : String(err)}\`
      );
    }
  }

  return result;
}

// ── CLI Runner ─────────────────────────────────────────────────────────────────

async function main() {
  // Replace with your actual database client
  const db = {
    query: async (sql: string, params?: unknown[]) => {
      console.debug("[seed-roles] Executing:", sql.slice(0, 80) + "...");
      return { rows: [] as unknown[] };
    },
  };

  console.log("🌱 Seeding RBAC roles...\\n");
  const result = await seedRoles(db);

  if (result.created.length > 0) {
    console.log("✅ Created roles:", result.created.join(", "));
  }
  if (result.skipped.length > 0) {
    console.log("⏭️  Skipped (already exist):", result.skipped.join(", "));
  }
  if (result.errors.length > 0) {
    console.error("❌ Errors:", result.errors.join("; "));
    process.exit(1);
  }

  console.log(\`\\n📋 Total roles: \${DEFAULT_ROLES.length}\`);
  console.log("✨ Seed complete.\\n");
}

// Run if called directly
if (import.meta.main) {
  main().catch((err) => {
    console.error("Fatal seed error:", err);
    process.exit(1);
  });
}
`;
}

// ── Summary ─────────────────────────────────────────────────────────────────────

function buildSummary(roles: RoleDef[]): string {
  const standardRoles = roles.filter((r) =>
    ["admin", "manager", "editor", "viewer"].includes(r.name)
  );
  const customRoles = roles.filter(
    (r) => !["admin", "manager", "editor", "viewer"].includes(r.name)
  );

  return `Generated ${roles.length} RBAC roles: ${standardRoles.length} standard (${standardRoles.map((r) => r.name).join(", ")}) and ${customRoles.length} entity-specific (${customRoles.map((r) => r.name).join(", ")}). Includes a complete permissions matrix, TypeScript types, Hono RBAC middleware with JWT/API key extraction, and an idempotent seed script.`;
}

// ── Main Generator ─────────────────────────────────────────────────────────────

export function generatePermissions(
  entities: GeneratedEntity[],
  _endpoints: GeneratedEndpoint[],
  domain: string = ""
): PermissionProject {
  const roles = generateRoles(entities, domain);
  const permissionsMatrix = buildPermissionsMatrix(roles, entities);
  const permissionsObject = buildPermissionsObject(roles);
  const rbacMiddleware = buildRbacMiddleware(entities);
  const permissionTypes = buildPermissionTypes();
  const seedScript = buildSeedScript(roles);
  const summary = buildSummary(roles);

  return {
    roles,
    permissionsMatrix,
    permissionsObject,
    rbacMiddleware,
    permissionTypes,
    seedScript,
    summary,
  };
}

// ── Export for generate.ts ─────────────────────────────────────────────────────

export type { PermissionProject as PermissionProjectType };
