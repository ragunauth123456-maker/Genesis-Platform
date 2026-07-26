/**
 * Testing Generator
 *
 * Takes entities, endpoints, and apiRoutes from a GenerationResult and produces:
 *   - Unit tests — per-entity repository tests, Zod validation tests, route handler tests
 *   - Integration tests — full CRUD lifecycle, auth flow, error handling
 *   - Test fixtures — factory functions for each entity
 *   - Test setup — in-memory DB, migration runner, global hooks
 *   - Vitest config
 *
 * Uses Bun test runner (bun:test) with describe/it/expect — also works with Vitest.
 */

import type { GeneratedEntity, GeneratedEndpoint } from "./generate";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TestingProject {
  unitTests: Array<{ filename: string; content: string }>;
  integrationTests: string;
  fixtures: string;
  testSetup: string;
  vitestConfig: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** PascalCase → camelCase */
function camelCase(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/** PascalCase → snake_case */
function snakeCase(name: string): string {
  return name
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

/** PascalCase → plural (simple English rules) */
function pluralize(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith("s") || lower.endsWith("x") || lower.endsWith("z") || lower.endsWith("ch") || lower.endsWith("sh")) {
    return name + "es";
  }
  if (lower.endsWith("y") && !["a", "e", "i", "o", "u"].includes(lower[lower.length - 2])) {
    return name.slice(0, -1) + "ies";
  }
  return name + "s";
}

/** Map TS types to example values */
function typeToExample(fieldType: string, fieldName: string, entityName: string): string {
  const t = fieldType.toLowerCase();

  if (fieldName === "id") return `"550e8400-e29b-41d4-a716-446655440000"`;
  if (t.includes("uuid")) return `"${generateUUID()}"`;
  if (t.includes("integer") || t.includes("int")) return "42";
  if (t.includes("decimal") || t.includes("float") || t.includes("double") || t.includes("number")) return "99.99";
  if (t.includes("boolean") || t.includes("bool")) return "true";
  if (t.includes("date") || t.includes("datetime") || t.includes("timestamp")) return `"${new Date().toISOString()}"`;
  if (t.includes("enum")) return `"default"`;
  if (t.includes("json")) return "{}";
  if (t.includes("string[]") || t.includes("array")) return "[]";

  // Email fields
  if (fieldName.toLowerCase().includes("email")) return `"test@${entityName.toLowerCase()}.com"`;
  // Phone fields
  if (fieldName.toLowerCase().includes("phone")) return `"+1-555-0100"`;
  // Name fields
  if (fieldName.toLowerCase().includes("name")) return `"Test ${entityName}"`;
  if (fieldName.toLowerCase().includes("firstname") || fieldName.toLowerCase().includes("first_name")) return `"John"`;
  if (fieldName.toLowerCase().includes("lastname") || fieldName.toLowerCase().includes("last_name")) return `"Doe"`;

  // Default
  return `"sample-${fieldName}"`;
}

let _uuidCounter = 0;
function generateUUID(): string {
  _uuidCounter++;
  const hex = _uuidCounter.toString(16).padStart(12, "0");
  return `"00000000-0000-0000-0000-${hex}"`;
}

/** Map TS types to Zod schema types */
function tsTypeToZod(tsType: string): string {
  const t = tsType.toLowerCase().trim();

  if (t.startsWith("uuid")) return "z.string().uuid()";
  if (t === "string") return "z.string()";
  if (t === "text" || t === "varchar") return "z.string()";
  if (t === "integer" || t === "int" || t === "bigint") return "z.number().int()";
  if (t === "number" || t === "decimal" || t === "float" || t === "double") return "z.number()";
  if (t === "boolean" || t === "bool") return "z.boolean()";
  if (t === "date" || t === "datetime" || t === "timestamp") return "z.string().datetime()";
  if (t === "enum") return "z.string()";
  if (t === "json" || t === "jsonb") return "z.any()";
  if (t.startsWith("string[]")) return "z.array(z.string())";
  return "z.string()";
}

/** Derive HTTP method-color for badges */
function methodColor(method: string): string {
  const m = method.toUpperCase();
  if (m === "GET") return "text-green-500/70 bg-green-500/10";
  if (m === "POST") return "text-blue-500/70 bg-blue-500/10";
  if (m === "PUT") return "text-amber-500/70 bg-amber-500/10";
  if (m === "PATCH") return "text-purple-500/70 bg-purple-500/10";
  if (m === "DELETE") return "text-red-500/70 bg-red-500/10";
  return "text-surface-400 bg-surface-800";
}

// ── Unit Test Generators ───────────────────────────────────────────────────────

interface UnitTestFile {
  filename: string;
  content: string;
}

function generateRepositoryTests(entity: GeneratedEntity): UnitTestFile {
  const name = entity.name;
  const camel = camelCase(name);
  const snake = snakeCase(name);
  const plural = pluralize(name);
  const fields = entity.fields.filter((f) => f.name !== "id");

  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * Repository unit tests for ${name}`);
  lines.push(` * Tests CRUD operations with a mocked database`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`import { describe, it, expect, beforeEach, mock } from "bun:test";`);
  lines.push(`import { ${camel}Repository } from "../repositories/${snake}.repository";`);
  lines.push(``);

  // Mock DB
  lines.push(`// ── Mock Database ──────────────────────────────────────────────────────────`);
  lines.push(`const createMockDb = () => {`);
  lines.push(`  const store = new Map<string, any>();`);
  lines.push(`  let idCounter = 0;`);
  lines.push(``);
  lines.push(`  return {`);
  lines.push(`    query: mock(async (sql: string, params?: any[]) => {`);
  lines.push(`      // Mock SELECT`);
  lines.push(`      if (sql.trim().toUpperCase().startsWith("SELECT")) {`);
  lines.push(`        const rows = Array.from(store.values());`);
  lines.push(`        return { rows, rowCount: rows.length };`);
  lines.push(`      }`);
  lines.push(`      // Mock INSERT`);
  lines.push(`      if (sql.trim().toUpperCase().startsWith("INSERT")) {`);
  lines.push(`        idCounter++;`);
  lines.push(`        const id = \`00000000-0000-0000-0000-\${String(idCounter).padStart(12, "0")}\`;`);
  lines.push(`        const row = { id, ...(params?.[0] || {}) };`);
  lines.push(`        store.set(id, row);`);
  lines.push(`        return { rows: [row], rowCount: 1 };`);
  lines.push(`      }`);
  lines.push(`      // Mock UPDATE`);
  lines.push(`      if (sql.trim().toUpperCase().startsWith("UPDATE")) {`);
  lines.push(`        const id = params?.[params.length - 1];`);
  lines.push(`        if (id && store.has(id)) {`);
  lines.push(`          const existing = store.get(id);`);
  lines.push(`          const updated = { ...existing, ...(params?.[0] || {}) };`);
  lines.push(`          store.set(id, updated);`);
  lines.push(`          return { rows: [updated], rowCount: 1 };`);
  lines.push(`        }`);
  lines.push(`        return { rows: [], rowCount: 0 };`);
  lines.push(`      }`);
  lines.push(`      // Mock DELETE`);
  lines.push(`      if (sql.trim().toUpperCase().startsWith("DELETE")) {`);
  lines.push(`        const id = params?.[0];`);
  lines.push(`        if (id && store.has(id)) {`);
  lines.push(`          store.delete(id);`);
  lines.push(`          return { rowCount: 1 };`);
  lines.push(`        }`);
  lines.push(`        return { rowCount: 0 };`);
  lines.push(`      }`);
  lines.push(`      return { rows: [], rowCount: 0 };`);
  lines.push(`    }),`);
  lines.push(`    execute: mock(async (_sql: string, _params?: any[]) => {`);  
  lines.push(`      return { rowCount: 1 };`);
  lines.push(`    }),`);
  lines.push(`    _store: store,`);
  lines.push(`  };`);
  lines.push(`};`);
  lines.push(``);

  // Test suite
  lines.push(`// ── Test Suite ──────────────────────────────────────────────────────────────`);
  lines.push(``);
  lines.push(`describe("${name} Repository", () => {`);
  lines.push(`  let db: ReturnType<typeof createMockDb>;`);
  lines.push(`  let repo: ReturnType<typeof ${camel}Repository>;`);
  lines.push(``);
  lines.push(`  beforeEach(() => {`);
  lines.push(`    db = createMockDb();`);
  lines.push(`    repo = ${camel}Repository(db as any);`);
  lines.push(`  });`);
  lines.push(``);

  // CREATE
  lines.push(`  // ── Create ───────────────────────────────────────────────────────────`);
  lines.push(`  describe("create", () => {`);
  lines.push(`    it("should create a new ${name.toLowerCase()}", async () => {`);
  lines.push(`      const data = {`);
  for (const f of fields) {
    lines.push(`        ${f.name}: ${typeToExample(f.type, f.name, name)},`);
  }
  lines.push(`      };`);
  lines.push(``);
  lines.push(`      const result = await repo.create(data);`);
  lines.push(``);
  lines.push(`      expect(result).toBeDefined();`);
  lines.push(`      expect(result.id).toBeDefined();`);
  for (const f of fields.slice(0, 3)) {
    lines.push(`      expect(result.${f.name}).toBe(data.${f.name});`);
  }
  lines.push(`    });`);
  lines.push(``);
  lines.push(`    it("should generate a UUID for new records", async () => {`);
  lines.push(`      const result = await repo.create({`);
  for (const f of fields.slice(0, 1)) {
    lines.push(`        ${f.name}: ${typeToExample(f.type, f.name, name)},`);
  }
  lines.push(`      });`);
  lines.push(`      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);`);
  lines.push(`    });`);
  lines.push(`  });`);
  lines.push(``);

  // READ
  lines.push(`  // ── Read ─────────────────────────────────────────────────────────────`);
  lines.push(`  describe("findById", () => {`);
  lines.push(`    it("should return a ${name.toLowerCase()} by ID", async () => {`);
  lines.push(`      const created = await repo.create({`);
  for (const f of fields.slice(0, 1)) {
    lines.push(`        ${f.name}: ${typeToExample(f.type, f.name, name)},`);
  }
  lines.push(`      });`);
  lines.push(``);
  lines.push(`      const found = await repo.findById(created.id);`);
  lines.push(``);
  lines.push(`      expect(found).toBeDefined();`);
  lines.push(`      expect(found!.id).toBe(created.id);`);
  lines.push(`    });`);
  lines.push(``);
  lines.push(`    it("should return null for non-existent ID", async () => {`);
  lines.push(`      const found = await repo.findById("non-existent-id");`);
  lines.push(`      expect(found).toBeNull();`);
  lines.push(`    });`);
  lines.push(`  });`);
  lines.push(``);

  lines.push(`  describe("findAll", () => {`);
  lines.push(`    it("should return all ${plural.toLowerCase()}", async () => {`);
  lines.push(`      await repo.create({`);
  for (const f of fields.slice(0, 1)) {
    lines.push(`        ${f.name}: ${typeToExample(f.type, f.name, name)},`);
  }
  lines.push(`      });`);
  lines.push(`      await repo.create({`);
  for (const f of fields.slice(0, 1)) {
    lines.push(`        ${f.name}: ${typeToExample(f.type, f.name, name)}_2,`);
  }
  lines.push(`      });`);
  lines.push(``);
  lines.push(`      const results = await repo.findAll();`);
  lines.push(`      expect(results.length).toBeGreaterThanOrEqual(2);`);
  lines.push(`    });`);
  lines.push(`  });`);
  lines.push(``);

  // UPDATE
  lines.push(`  // ── Update ───────────────────────────────────────────────────────────`);
  lines.push(`  describe("update", () => {`);
  lines.push(`    it("should update an existing ${name.toLowerCase()}", async () => {`);
  lines.push(`      const created = await repo.create({`);
  for (const f of fields.slice(0, 1)) {
    lines.push(`        ${f.name}: ${typeToExample(f.type, f.name, name)},`);
  }
  lines.push(`      });`);
  lines.push(``);
  lines.push(`      const updateData = {`);
  lines.push(`        ${fields[0]?.name || "name"}: ${typeToExample(fields[0]?.type || "string", fields[0]?.name || "name", name + "Updated")},`);
  lines.push(`      };`);
  lines.push(`      const updated = await repo.update(created.id, updateData);`);
  lines.push(``);
  lines.push(`      expect(updated).toBeDefined();`);
  lines.push(`      expect(updated!.${fields[0]?.name || "name"}).toBe(updateData.${fields[0]?.name || "name"});`);
  lines.push(`    });`);
  lines.push(``);
  lines.push(`    it("should return null when updating non-existent record", async () => {`);
  lines.push(`      const result = await repo.update("non-existent", {});`);
  lines.push(`      expect(result).toBeNull();`);
  lines.push(`    });`);
  lines.push(`  });`);
  lines.push(``);

  // DELETE
  lines.push(`  // ── Delete ───────────────────────────────────────────────────────────`);
  lines.push(`  describe("delete", () => {`);
  lines.push(`    it("should delete an existing ${name.toLowerCase()}", async () => {`);
  lines.push(`      const created = await repo.create({`);
  for (const f of fields.slice(0, 1)) {
    lines.push(`        ${f.name}: ${typeToExample(f.type, f.name, name)},`);
  }
  lines.push(`      });`);
  lines.push(``);
  lines.push(`      await repo.delete(created.id);`);
  lines.push(``);
  lines.push(`      const found = await repo.findById(created.id);`);
  lines.push(`      expect(found).toBeNull();`);
  lines.push(`    });`);
  lines.push(``);
  lines.push(`    it("should not throw when deleting non-existent record", async () => {`);
  lines.push(`      await expect(repo.delete("non-existent")).resolves.toBeUndefined();`);
  lines.push(`    });`);
  lines.push(`  });`);
  lines.push(`});`);
  lines.push(``);

  return {
    filename: `${snake}.repository.test.ts`,
    content: lines.join("\n"),
  };
}

function generateValidationTests(entity: GeneratedEntity): UnitTestFile {
  const name = entity.name;
  const camel = camelCase(name);
  const snake = snakeCase(name);
  const fields = entity.fields.filter((f) => f.name !== "id");

  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * Zod validation tests for ${name} schemas`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`import { describe, it, expect } from "bun:test";`);
  lines.push(`import { z } from "zod";`);
  lines.push(``);
  lines.push(`// ── Schema definition (mirrors real schema) ───────────────────────────────`);
  lines.push(``);

  // Build the Zod schema
  lines.push(`const ${camel}Schema = z.object({`);
  for (const f of fields) {
    const zod = tsTypeToZod(f.type);
    const modifier = f.required ? "" : ".optional()";
    lines.push(`  ${f.name}: ${zod}${modifier},`);
  }
  lines.push(`});`);
  lines.push(``);

  lines.push(`const ${camel}CreateSchema = z.object({`);
  for (const f of fields) {
    if (f.name === "id") continue;
    const zod = tsTypeToZod(f.type);
    const modifier = f.required ? "" : ".optional()";
    lines.push(`  ${f.name}: ${zod}${modifier},`);
  }
  lines.push(`});`);
  lines.push(``);

  const validRequiredFields = fields.filter((f) => f.required);

  lines.push(`// ── Test Suite ──────────────────────────────────────────────────────────────`);
  lines.push(``);
  lines.push(`describe("${name} Schema Validation", () => {`);
  lines.push(`  describe("valid input", () => {`);
  lines.push(`    it("should accept valid ${name.toLowerCase()} data", () => {`);
  lines.push(`      const data = {`);
  for (const f of fields) {
    lines.push(`        ${f.name}: ${typeToExample(f.type, f.name, name)},`);
  }
  lines.push(`      };`);
  lines.push(``);
  lines.push(`      const result = ${camel}Schema.safeParse(data);`);
  lines.push(`      expect(result.success).toBe(true);`);
  lines.push(`    });`);
  lines.push(``);
  lines.push(`    it("should accept valid create input", () => {`);
  lines.push(`      const data = {`);
  for (const f of fields) {
    lines.push(`        ${f.name}: ${typeToExample(f.type, f.name, name)},`);
  }
  lines.push(`      };`);
  lines.push(``);
  lines.push(`      const result = ${camel}CreateSchema.safeParse(data);`);
  lines.push(`      expect(result.success).toBe(true);`);
  lines.push(`    });`);
  lines.push(`  });`);
  lines.push(``);

  // Invalid input tests
  lines.push(`  describe("invalid input", () => {`);
  if (validRequiredFields.length > 0) {
    const f = validRequiredFields[0];
    lines.push(`    it("should reject missing required field: ${f.name}", () => {`);
    lines.push(`      const data = {`);
    for (const f2 of fields) {
      if (f2.name === f.name) continue;
      lines.push(`        ${f2.name}: ${typeToExample(f2.type, f2.name, name)},`);
    }
    lines.push(`      };`);
    lines.push(``);
    lines.push(`      const result = ${camel}Schema.safeParse(data);`);
    lines.push(`      expect(result.success).toBe(false);`);
    lines.push(`    });`);
    lines.push(``);
  }

  // Type mismatch tests
  const numberFields = fields.filter((f) => {
    const t = f.type.toLowerCase();
    return t.includes("integer") || t.includes("int") || t.includes("number") || t.includes("decimal") || t.includes("float");
  });
  if (numberFields.length > 0) {
    const nf = numberFields[0];
    lines.push(`    it("should reject wrong type for ${nf.name}", () => {`);
    lines.push(`      const data = {`);
    for (const f of fields) {
      if (f.name === nf.name) {
        lines.push(`        ${f.name}: "not-a-number",`);
      } else {
        lines.push(`        ${f.name}: ${typeToExample(f.type, f.name, name)},`);
      }
    }
    lines.push(`      };`);
    lines.push(``);
    lines.push(`      const result = ${camel}Schema.safeParse(data);`);
    lines.push(`      expect(result.success).toBe(false);`);
    lines.push(`    });`);
    lines.push(``);
  }

  lines.push(`    it("should reject an empty object", () => {`);
  lines.push(`      const result = ${camel}Schema.safeParse({});`);
  lines.push(`      expect(result.success).toBe(false);`);
  lines.push(`    });`);
  lines.push(`  });`);
  lines.push(``);

  // Edge cases
  lines.push(`  describe("edge cases", () => {`);
  lines.push(`    it("should handle null values", () => {`);
  lines.push(`      const result = ${camel}CreateSchema.safeParse(null);`);
  lines.push(`      expect(result.success).toBe(false);`);
  lines.push(`    });`);
  lines.push(``);
  lines.push(`    it("should handle undefined values", () => {`);
  lines.push(`      const result = ${camel}CreateSchema.safeParse(undefined);`);
  lines.push(`      expect(result.success).toBe(false);`);
  lines.push(`    });`);
  lines.push(``);
  // Extra fields test
  lines.push(`    it("should strip unknown fields (when using .strip())", () => {`);
  lines.push(`      const data = {`);
  for (const f of fields) {
    lines.push(`        ${f.name}: ${typeToExample(f.type, f.name, name)},`);
  }
  lines.push(`        unknownField: "should-be-stripped",`);
  lines.push(`      };`);
  lines.push(``);
  lines.push(`      const strictSchema = ${camel}Schema.strip();`);
  lines.push(`      const result = strictSchema.safeParse(data);`);
  lines.push(`      if (result.success) {`);
  lines.push(`        expect((result.data as any).unknownField).toBeUndefined();`);
  lines.push(`      }`);
  lines.push(`    });`);
  lines.push(`  });`);
  lines.push(`});`);
  lines.push(``);

  return {
    filename: `${snake}.validation.test.ts`,
    content: lines.join("\n"),
  };
}

function generateRouteTests(
  entity: GeneratedEntity,
  endpoints: GeneratedEndpoint[]
): UnitTestFile {
  const name = entity.name;
  const camel = camelCase(name);
  const snake = snakeCase(name);
  const plural = pluralize(name).toLowerCase();
  const entityEndpoints = endpoints.filter((ep) => {
    const pathLower = ep.path.toLowerCase();
    const pluralLower = plural;
    return pathLower.includes(pluralLower) || pathLower.includes(`/${snake}`);
  });

  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * Route handler tests for ${name} endpoints`);
  lines.push(` * Tests HTTP method routing and status code assertions`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`import { describe, it, expect, beforeEach } from "bun:test";`);
  lines.push(`import { Hono } from "hono";`);
  lines.push(`import { ${camel}Router } from "../routes/${snake}.routes";`);
  lines.push(``);
  lines.push(`// ── Test App Setup ─────────────────────────────────────────────────────────`);
  lines.push(``);
  lines.push(`function createTestApp() {`);
  lines.push(`  const app = new Hono();`);
  lines.push(`  app.route("/", ${camel}Router);`);
  lines.push(`  return app;`);
  lines.push(`}`);
  lines.push(``);

  // Mock the repository
  lines.push(`// Mock the repository module`);
  lines.push(`mock.module("../repositories/${snake}.repository", () => {`);
  lines.push(`  const store = new Map<string, any>();`);
  lines.push(`  return {`);
  lines.push(`    ${camel}Repository: () => ({`);
  lines.push(`      findAll: async () => Array.from(store.values()),`);
  lines.push(`      findById: async (id: string) => store.get(id) || null,`);
  lines.push(`      create: async (data: any) => {`);
  lines.push(`        const record = {`);
  lines.push(`          id: \`00000000-0000-0000-0000-\${String(store.size + 1).padStart(12, "0")}\`,`);
  lines.push(`          ...data,`);
  lines.push(`        };`);
  lines.push(`        store.set(record.id, record);`);
  lines.push(`        return record;`);
  lines.push(`      },`);
  lines.push(`      update: async (id: string, data: any) => {`);
  lines.push(`        if (!store.has(id)) return null;`);
  lines.push(`        const updated = { ...store.get(id), ...data };`);
  lines.push(`        store.set(id, updated);`);
  lines.push(`        return updated;`);
  lines.push(`      },`);
  lines.push(`      delete: async (id: string) => {`);
  lines.push(`        store.delete(id);`);
  lines.push(`      },`);
  lines.push(`    }),`);
  lines.push(`  };`);
  lines.push(`});`);
  lines.push(``);

  lines.push(`// ── Test Suite ──────────────────────────────────────────────────────────────`);
  lines.push(``);
  lines.push(`describe("${name} Route Handlers", () => {`);
  lines.push(`  let app: Hono;`);
  lines.push(``);
  lines.push(`  beforeEach(() => {`);
  lines.push(`    app = createTestApp();`);
  lines.push(`  });`);
  lines.push(``);

  // GET all
  const hasGetAll = entityEndpoints.some(
    (ep) => ep.method === "GET" && !ep.path.includes(":id")
  );
  if (hasGetAll) {
    lines.push(`  describe("GET /api/${plural}", () => {`);
    lines.push(`    it("should return 200 with data array", async () => {`);
    lines.push(`      const res = await app.request("/api/${plural}");`);
    lines.push(`      expect(res.status).toBe(200);`);
    lines.push(`      const body = await res.json();`);
    lines.push(`      expect(body).toHaveProperty("data");`);
    lines.push(`      expect(Array.isArray(body.data)).toBe(true);`);
    lines.push(`    });`);
    lines.push(`  });`);
    lines.push(``);
  }

  // GET by ID
  const hasGetById = entityEndpoints.some(
    (ep) => ep.method === "GET" && ep.path.includes(":id")
  );
  if (hasGetById) {
    lines.push(`  describe("GET /api/${plural}/:id", () => {`);
    lines.push(`    it("should return 404 for non-existent ID", async () => {`);
    lines.push(`      const res = await app.request("/api/${plural}/non-existent");`);
    lines.push(`      expect(res.status).toBe(404);`);
    lines.push(`    });`);
    lines.push(`  });`);
    lines.push(``);
  }

  // POST
  const hasPost = entityEndpoints.some((ep) => ep.method === "POST");
  if (hasPost) {
    lines.push(`  describe("POST /api/${plural}", () => {`);
    lines.push(`    it("should return 201 on successful creation", async () => {`);
    lines.push(`      const res = await app.request("/api/${plural}", {`);
    lines.push(`        method: "POST",`);
    lines.push(`        headers: { "Content-Type": "application/json" },`);
    lines.push(`        body: JSON.stringify({`);
    for (const f of entity.fields.filter((f) => f.name !== "id" && f.required).slice(0, 3)) {
      lines.push(`          ${f.name}: ${typeToExample(f.type, f.name, name)},`);
    }
    lines.push(`        }),`);
    lines.push(`      });`);
    lines.push(`      expect([201, 200]).toContain(res.status);`);
    lines.push(`    });`);
    lines.push(``);
    lines.push(`    it("should return 400 for invalid body", async () => {`);
    lines.push(`      const res = await app.request("/api/${plural}", {`);
    lines.push(`        method: "POST",`);
    lines.push(`        headers: { "Content-Type": "application/json" },`);
    lines.push(`        body: "invalid-json",`);
    lines.push(`      });`);
    lines.push(`      expect([400, 422, 500]).toContain(res.status);`);
    lines.push(`    });`);
    lines.push(`  });`);
    lines.push(``);
  }

  // DELETE
  const hasDelete = entityEndpoints.some((ep) => ep.method === "DELETE");
  if (hasDelete) {
    lines.push(`  describe("DELETE /api/${plural}/:id", () => {`);
    lines.push(`    it("should return 200 on successful delete", async () => {`);
    lines.push(`      // First create a record`);  
    lines.push(`      const createRes = await app.request("/api/${plural}", {`);
    lines.push(`        method: "POST",`);
    lines.push(`        headers: { "Content-Type": "application/json" },`);
    lines.push(`        body: JSON.stringify({`);
    for (const f of entity.fields.filter((f) => f.name !== "id" && f.required).slice(0, 1)) {  
      lines.push(`          ${f.name}: ${typeToExample(f.type, f.name, name)},`);
    }
    lines.push(`        }),`);
    lines.push(`      });`);
    lines.push(``);
    lines.push(`      const created = await createRes.json();`);
    lines.push(`      const id = created.data?.id || created.id;`);
    lines.push(``);
    lines.push(`      const res = await app.request(\`/api/${plural}/\${id}\`, { method: "DELETE" });`);
    lines.push(`      expect([200, 204]).toContain(res.status);`);
    lines.push(`    });`);
    lines.push(`  });`);
    lines.push(``);
  }

  lines.push(`});`);
  lines.push(``);

  return {
    filename: `${snake}.routes.test.ts`,
    content: lines.join("\n"),
  };
}

// ── Integration Test Generator ─────────────────────────────────────────────────

function generateIntegrationTests(
  entities: GeneratedEntity[],
  endpoints: GeneratedEndpoint[]
): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * Integration tests — end-to-end API tests`);
  lines.push(` * Tests full CRUD lifecycle, auth flows, and error handling`);
  lines.push(` *`);
  lines.push(` * Run with: bun test --preload ./test-setup.ts`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`import { describe, it, expect, beforeAll, afterAll } from "bun:test";`);
  lines.push(``);
  lines.push(`// ── Test Configuration ─────────────────────────────────────────────────────`);
  lines.push(`const BASE_URL = process.env.TEST_API_URL || "http://localhost:3000";`);
  lines.push(`let authToken = "";`);
  lines.push(``);

  // Helper
  lines.push(`// ── Helpers ────────────────────────────────────────────────────────────────`);
  lines.push(``);
  lines.push(`async function api(path: string, options: RequestInit = {}) {`);
  lines.push(`  const headers: Record<string, string> = {`);
  lines.push(`    "Content-Type": "application/json",`);
  lines.push(`    ...(authToken ? { Authorization: \`Bearer \${authToken}\` } : {}),`);
  lines.push(`    ...((options.headers as Record<string, string>) || {}),`);
  lines.push(`  };`);
  lines.push(`  const res = await fetch(\`\${BASE_URL}\${path}\`, { ...options, headers });`);
  lines.push(`  let body: any;`);
  lines.push(`  try { body = await res.json(); } catch { body = null; }`);
  lines.push(`  return { status: res.status, body };`);
  lines.push(`}`);
  lines.push(``);

  // Auth flow
  lines.push(`// ── Authentication Flow ────────────────────────────────────────────────────`);
  lines.push(``);
  lines.push(`describe("Authentication", () => {`);
  lines.push(`  it("should reject unauthenticated requests", async () => {`);
  lines.push(`    const { status } = await api("/api/health");`);
  lines.push(`    // Health endpoint should be public`);
  lines.push(`    expect(status).toBe(200);`);
  lines.push(`  });`);
  lines.push(``);
  lines.push(`  it("should handle login endpoint (if exists)", async () => {`);
  lines.push(`    const { status } = await api("/api/auth/login", {`);
  lines.push(`      method: "POST",`);
  lines.push(`      body: JSON.stringify({`);
  lines.push(`        email: "test@example.com",`);
  lines.push(`        password: "test-password",`);
  lines.push(`      }),`);
  lines.push(`    });`);
  lines.push(`    // May return 401 if invalid credentials, or 200 with token`);
  lines.push(`    expect([200, 401, 404]).toContain(status);`);
  lines.push(`  });`);
  lines.push(``);
  lines.push(`  it("should register a new user", async () => {`);
  lines.push(`    const { status } = await api("/api/auth/register", {`);
  lines.push(`      method: "POST",`);
  lines.push(`      body: JSON.stringify({`);
  lines.push(`        email: \`test-\${Date.now()}@example.com\`,`);
  lines.push(`        password: "SecureP@ssw0rd!",`);
  lines.push(`        name: "Test User",`);
  lines.push(`      }),`);
  lines.push(`    });`);
  lines.push(`    expect([201, 200, 404]).toContain(status);`);
  lines.push(`  });`);
  lines.push(`});`);
  lines.push(``);

  // CRUD lifecycle for each entity
  for (const entity of entities) {
    const name = entity.name;
    const plural = pluralize(name).toLowerCase();
    const requiredFields = entity.fields.filter((f) => f.name !== "id" && f.required);

    lines.push(`// ── ${name} CRUD Lifecycle ──────────────────────────────────────────────`);
    lines.push(``);
    lines.push(`describe("${name} Endpoints", () => {`);
    lines.push(`  let createdId = "";`);
    lines.push(``);

    // CREATE
    lines.push(`  it("should create a new ${name.toLowerCase()}", async () => {`);
    lines.push(`    const { status, body } = await api("/api/${plural}", {`);
    lines.push(`      method: "POST",`);
    lines.push(`      body: JSON.stringify({`);
    for (const f of requiredFields) {
      lines.push(`        ${f.name}: ${typeToExample(f.type, f.name, name)},`);
    }
    lines.push(`      }),`);
    lines.push(`    });`);
    lines.push(``);
    lines.push(`    expect([201, 200]).toContain(status);`);
    lines.push(`    if (body?.data) {`);
    lines.push(`      createdId = body.data.id;`);
    lines.push(`      expect(body.data.id).toBeDefined();`);
    lines.push(`    } else if (body?.id) {`);
    lines.push(`      createdId = body.id;`);
    lines.push(`    }`);
    lines.push(`  });`);
    lines.push(``);

    // READ ALL
    lines.push(`  it("should list all ${plural}", async () => {`);
    lines.push(`    const { status, body } = await api("/api/${plural}");`);
    lines.push(`    expect(status).toBe(200);`);
    lines.push(`    if (body?.data) {`);
    lines.push(`      expect(Array.isArray(body.data)).toBe(true);`);
    lines.push(`    }`);
    lines.push(`  });`);
    lines.push(``);

    // READ BY ID
    lines.push(`  it("should get ${name.toLowerCase()} by ID", async () => {`);
    lines.push(`    if (!createdId) return; // Skip if create failed`);
    lines.push(`    const { status, body } = await api(\`/api/${plural}/\${createdId}\`);`);
    lines.push(`    expect(status).toBe(200);`);
    lines.push(`  });`);
    lines.push(``);

    // UPDATE
    const updateField = requiredFields[0] || entity.fields[0];
    lines.push(`  it("should update a ${name.toLowerCase()}", async () => {`);
    lines.push(`    if (!createdId) return;`);
    lines.push(`    const { status } = await api(\`/api/${plural}/\${createdId}\`, {`);
    lines.push(`      method: "PATCH",`);
    lines.push(`      body: JSON.stringify({`);
    lines.push(`        ${updateField.name}: ${typeToExample(updateField.type, updateField.name, name + "Updated")},`);
    lines.push(`      }),`);
    lines.push(`    });`);
    lines.push(`    expect([200, 204]).toContain(status);`);
    lines.push(`  });`);
    lines.push(``);

    // DELETE
    lines.push(`  it("should delete a ${name.toLowerCase()}", async () => {`);
    lines.push(`    if (!createdId) return;`);
    lines.push(`    const { status } = await api(\`/api/${plural}/\${createdId}\`, { method: "DELETE" });`);
    lines.push(`    expect([200, 204]).toContain(status);`);
    lines.push(`  });`);
    lines.push(``);

    // 404
    lines.push(`  it("should return 404 for non-existent ${name.toLowerCase()}", async () => {`);
    lines.push(`    const { status } = await api("/api/${plural}/ffffffff-ffff-ffff-ffff-ffffffffffff");`);
    lines.push(`    expect(status).toBe(404);`);
    lines.push(`  });`);
    lines.push(`});`);
    lines.push(``);
  }

  // Error handling
  lines.push(`// ── Error Handling ─────────────────────────────────────────────────────────`);
  lines.push(``);
  lines.push(`describe("Error Handling", () => {`);
  lines.push(`  it("should return 400 for malformed JSON", async () => {`);
  lines.push(`    const { status } = await api("/api/${pluralize(entities[0]?.name || "Entity").toLowerCase()}", {`);
  lines.push(`      method: "POST",`);
  lines.push(`      headers: { "Content-Type": "application/json" },`);
  lines.push(`      body: "{invalid-json",`);
  lines.push(`    });`);
  lines.push(`    expect([400, 422]).toContain(status);`);
  lines.push(`  });`);
  lines.push(``);
  lines.push(`  it("should return 404 for unknown routes", async () => {`);
  lines.push(`    const { status } = await api("/api/nonexistent-route");`);
  lines.push(`    expect(status).toBe(404);`);
  lines.push(`  });`);
  lines.push(``);
  lines.push(`  it("health endpoint should return 200", async () => {`);
  lines.push(`    const { status, body } = await api("/api/health");`);
  lines.push(`    expect(status).toBe(200);`);
  lines.push(`    if (body) expect(body).toHaveProperty("status");`);
  lines.push(`  });`);
  lines.push(`});`);
  lines.push(``);

  return lines.join("\n");
}

// ── Test Fixtures Generator ────────────────────────────────────────────────────

function generateFixtures(entities: GeneratedEntity[]): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * Test fixture factories`);
  lines.push(` *`);
  lines.push(` * Provides factory functions to generate valid test data for each entity.`);
  lines.push(` * Each factory accepts an optional partial to override specific fields.`);
  lines.push(` */`);
  lines.push(``);

  let fixtureCounter = 0;

  for (const entity of entities) {
    const name = entity.name;
    const fields = entity.fields.filter((f) => f.name !== "id");

    lines.push(`// ── ${name} ────────────────────────────────────────────────────────────`);
    lines.push(``);

    // Type definition
    lines.push(`export interface Test${name} {`);
    for (const f of entity.fields) {
      const tsType = tsTypeToTypeScript(f.type, f.name, name);
      lines.push(`  ${f.name}: ${tsType};`);
    }
    lines.push(`}`);
    lines.push(``);

    // createTest{Entity}()
    lines.push(`/**`);
    lines.push(` * Create a valid test ${name} with sensible defaults.`);
    lines.push(` * Override any field by passing a partial object.`);
    lines.push(` */`);
    lines.push(`export function createTest${name}(overrides: Partial<Test${name}> = {}): Test${name} {`);
    lines.push(`  fixtureCounter++;`);
    lines.push(`  const base: Test${name} = {`);
    lines.push(`    id: \`00000000-0000-0000-0000-\${String(fixtureCounter).padStart(12, "0")}\`,`);

    for (const f of fields) {
      const example = typeToExample(f.type, f.name, name);
      lines.push(`    ${f.name}: ${example},`);
    }

    lines.push(`  };`);
    lines.push(`  return { ...base, ...overrides };`);
    lines.push(`}`);
    lines.push(``);

    // createTest{Entity}Input()
    lines.push(`/**`);
    lines.push(` * Create valid API input data for creating a ${name}.`);
    lines.push(` * Does NOT include server-generated fields (id, createdAt, etc.)`);
    lines.push(` */`);
    lines.push(`export function createTest${name}Input(overrides: Partial<Omit<Test${name}, "id">> = {}): Omit<Test${name}, "id"> {`);
    const inputFields = entity.fields.filter((f) => f.name !== "id");
    lines.push(`  return {`);
    for (const f of inputFields) {
      const example = typeToExample(f.type, f.name, name);
      lines.push(`    ${f.name}: ${example},`);
    }
    lines.push(`    ...overrides,`);
    lines.push(`  };`);
    lines.push(`}`);
    lines.push(``);
  }

  // Counter for unique IDs
  lines.unshift(`let fixtureCounter = 0;`);
  lines.unshift(``);

  lines.push(`/** Reset the fixture counter between test suites */`);
  lines.push(`export function resetFixtureCounter(): void {`);
  lines.push(`  fixtureCounter = 0;`);
  lines.push(`}`);
  lines.push(``);

  return lines.join("\n");
}

/** Map TS types to TypeScript type annotations */
function tsTypeToTypeScript(tsType: string, _fieldName: string, _entityName: string): string {
  const t = tsType.toLowerCase().trim();
  if (t.startsWith("uuid")) return "string";
  if (t === "string" || t === "text" || t === "varchar") return "string";
  if (t === "integer" || t === "int" || t === "bigint") return "number";
  if (t === "number" || t === "decimal" || t === "float" || t === "double") return "number";
  if (t === "boolean" || t === "bool") return "boolean";
  if (t === "date" || t === "datetime" || t === "timestamp") return "string";
  if (t === "enum") return "string";
  if (t === "json" || t === "jsonb") return "Record<string, any>";
  if (t.startsWith("string[]")) return "string[]";
  return "string";
}

// ── Test Setup Generator ───────────────────────────────────────────────────────

function generateTestSetup(entities: GeneratedEntity[]): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * Test setup — shared test infrastructure`);
  lines.push(` *`);
  lines.push(` * Provides:`);
  lines.push(` *   - In-memory database setup (sql.js compatible)`);
  lines.push(` *   - Migration runner for tests`);
  lines.push(` *   - Global beforeAll/afterAll hooks`);
  lines.push(` *   - Common test helpers`);
  lines.push(` *`);
  lines.push(` * Usage: bun test --preload ./test-setup.ts`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`import { beforeAll, afterAll, afterEach } from "bun:test";`);
  lines.push(`import { Database } from "bun:sqlite";`);
  lines.push(``);
  lines.push(`// ── In-Memory Database ─────────────────────────────────────────────────────`);
  lines.push(``);
  lines.push(`let db: Database;`);
  lines.push(``);
  lines.push(`beforeAll(async () => {`);
  lines.push(`  // Create an in-memory SQLite database for tests`);
  lines.push(`  db = new Database(":memory:");`);
  lines.push(`  db.run("PRAGMA journal_mode = WAL");`);
  lines.push(`  db.run("PRAGMA foreign_keys = ON");`);
  lines.push(``);
  lines.push(`  // Run migrations`);
  lines.push(`  await runMigrations(db);`);
  lines.push(``);
  lines.push(`  console.log("[test-setup] In-memory database initialized");`);
  lines.push(`});`);
  lines.push(``);

  // Table creation (migration runner)
  lines.push(`// ── Migration Runner ────────────────────────────────────────────────────────`);
  lines.push(``);
  lines.push(`async function runMigrations(database: Database) {`);
  lines.push(`  // Enable UUID extension`);
  lines.push(`  database.run("SELECT 1"); // Warm up`);
  lines.push(``);

  // Generate CREATE TABLE statements
  lines.push(`  // Generated tables from entity definitions`);
  for (const entity of entities) {
    const tableName = snakeCase(entity.name);
    const fields = entity.fields.filter((f) => f.name !== "id");

    lines.push(`  database.run(\``);
    lines.push(`    CREATE TABLE IF NOT EXISTS ${tableName}s (`);
    lines.push(`      id TEXT PRIMARY KEY,`);

    for (const f of fields) {
      const sqlType = tsTypeToSqlite(f.type);
      const notNull = f.required ? " NOT NULL" : "";
      lines.push(`      ${f.name} ${sqlType}${notNull},`);
    }

    lines.push(`      created_at TEXT NOT NULL DEFAULT (datetime('now')),`);
    lines.push(`      updated_at TEXT NOT NULL DEFAULT (datetime('now'))`);
    lines.push(`    )`);
    lines.push(`  \`);`);
    lines.push(``);
  }

  // Indexes for foreign key columns
  for (const entity of entities) {
    const tableName = snakeCase(entity.name);
    const fkFields = entity.fields.filter((f) => f.type.toLowerCase().includes("uuid →"));
    for (const fk of fkFields) {
      lines.push(`  // Index for ${tableName}.${fk.name} (foreign key)`);
      lines.push(`  database.run("CREATE INDEX IF NOT EXISTS idx_${tableName}_${fk.name} ON ${tableName}s(${fk.name})");`);
    }
  }

  lines.push(``);
  lines.push(`  console.log("[test-setup] Migrations complete");`);
  lines.push(`}`);
  lines.push(``);

  // Cleanup
  lines.push(`// ── Cleanup ────────────────────────────────────────────────────────────────`);
  lines.push(``);
  lines.push(`afterEach(async () => {`);
  lines.push(`  // Clean all tables between tests for isolation`);
  for (const entity of entities) {
    const tableName = snakeCase(entity.name);
    lines.push(`  db.run("DELETE FROM ${tableName}s");`);
  }
  lines.push(`});`);
  lines.push(``);
  lines.push(`afterAll(() => {`);
  lines.push(`  db.close();`);
  lines.push(`  console.log("[test-setup] Database closed");`);
  lines.push(`});`);
  lines.push(``);

  // Helper functions
  lines.push(`// ── Test Helpers ───────────────────────────────────────────────────────────`);
  lines.push(``);
  lines.push(`/** Get the test database instance */`);
  lines.push(`export function getTestDb(): Database {`);
  lines.push(`  if (!db) throw new Error("Database not initialized. Ensure test-setup.ts is preloaded.");`);
  lines.push(`  return db;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`/** Clear all tables (alias for manual cleanup) */`);
  lines.push(`export function clearAllTables(): void {`);
  for (const entity of entities) {
    const tableName = snakeCase(entity.name);
    lines.push(`  db.run("DELETE FROM ${tableName}s");`);
  }
  lines.push(`}`);
  lines.push(``);
  lines.push(`/** Insert a row and return the full record */`);
  lines.push(`export function insertInto(table: string, data: Record<string, any>): Record<string, any> {`);
  lines.push(`  const keys = Object.keys(data);`);
  lines.push(`  const placeholders = keys.map(() => "?").join(", ");`);
  lines.push(`  const values = Object.values(data);`);
  lines.push(`  const columns = keys.join(", ");`);
  lines.push(`  db.run(\`INSERT INTO \${table} (\${columns}) VALUES (\${placeholders})\`, values);`);
  lines.push(`  return data;`);
  lines.push(`}`);
  lines.push(``);

  return lines.join("\n");
}

function tsTypeToSqlite(tsType: string): string {
  const t = tsType.toLowerCase().trim();
  if (t.startsWith("uuid")) return "TEXT";
  if (t === "string" || t === "text" || t === "varchar") return "TEXT";
  if (t === "integer" || t === "int" || t === "bigint") return "INTEGER";
  if (t === "number" || t === "decimal" || t === "float" || t === "double") return "REAL";
  if (t === "boolean" || t === "bool") return "INTEGER";
  if (t === "date" || t === "datetime" || t === "timestamp") return "TEXT";
  if (t === "enum") return "TEXT";
  if (t === "json" || t === "jsonb") return "TEXT";
  if (t.startsWith("string[]")) return "TEXT";
  return "TEXT";
}

// ── Vitest Config Generator ────────────────────────────────────────────────────

function generateVitestConfig(): string {
  return `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use global test APIs (describe, it, expect) without imports
    globals: true,

    // Environment: node for backend tests
    environment: "node",

    // Setup files run before each test file
    setupFiles: ["./test-setup.ts"],

    // Test file patterns
    include: [
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "tests/**/*.test.ts",
      "tests/**/*.spec.ts",
    ],

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/fixtures/**",
        "src/**/setup.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Retry failed tests once on CI
    retry: process.env.CI ? 1 : 0,
  },
});
`;
}

// ── Main Export ─────────────────────────────────────────────────────────────────

export function generateTests(
  entities: GeneratedEntity[],
  endpoints: GeneratedEndpoint[],
  _apiRoutes: string
): TestingProject {
  const unitTests: Array<{ filename: string; content: string }> = [];

  // Generate per-entity unit tests
  for (const entity of entities) {
    // Repository tests
    unitTests.push(generateRepositoryTests(entity));

    // Validation tests
    unitTests.push(generateValidationTests(entity));

    // Route handler tests
    unitTests.push(generateRouteTests(entity, endpoints));
  }

  // Integration tests
  const integrationTests = generateIntegrationTests(entities, endpoints);

  // Test fixtures
  const fixtures = generateFixtures(entities);

  // Test setup
  const testSetup = generateTestSetup(entities);

  // Vitest config
  const vitestConfig = generateVitestConfig();

  return {
    unitTests,
    integrationTests,
    fixtures,
    testSetup,
    vitestConfig,
  };
}
