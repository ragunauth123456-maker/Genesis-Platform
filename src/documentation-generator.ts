/**
 * Documentation Generator
 *
 * Takes entities, endpoints, apiRoutes, and domain from a GenerationResult and produces:
 *   - OpenAPI 3.0 Spec — complete JSON swagger spec
 *   - API Reference — markdown API docs
 *   - User Guide — markdown user documentation
 *   - Developer Guide — markdown developer docs
 *   - README — comprehensive project README
 */

import type { GeneratedEntity, GeneratedEndpoint, Relationship } from "./generate";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DocumentationProject {
  openApiSpec: string;
  apiReference: string;
  userGuide: string;
  developerGuide: string;
  readme: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function serviceName(domain: string): string {
  const words = domain.split(/\s+/).filter(w => w.length > 1);
  if (words.length === 0) return "Genesis App";
  return words.map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function appSlug(domain: string): string {
  return domain.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "genesis-app";
}

function entityToTag(entityName: string): string {
  return entityName.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

function tsTypeToOpenApiType(tsType: string): { type: string; format?: string } {
  const t = tsType.toLowerCase();
  if (t === "string" || t === "text" || t === "varchar" || t === "uuid") return { type: "string" };
  if (t === "number" || t === "integer" || t === "int" || t === "bigint") return { type: "integer", format: "int64" };
  if (t === "float" || t === "double" || t === "decimal") return { type: "number", format: "float" };
  if (t === "boolean" || t === "bool") return { type: "boolean" };
  if (t === "date" || t === "datetime" || t === "timestamp") return { type: "string", format: "date-time" };
  if (t === "json" || t === "jsonb") return { type: "object" };
  return { type: "string" };
}

function inferRelationshipsFromEndpoints(entities: GeneratedEntity[], endpoints: GeneratedEndpoint[]): Relationship[] {
  const rels: Relationship[] = [];
  const entityNames = entities.map(e => e.name.toLowerCase());

  for (const ep of endpoints) {
    const pathMatch = ep.path.match(/\/([^/]+)\/([^/]+)/);
    if (pathMatch) {
      const parent = pathMatch[1].toLowerCase();
      const child = pathMatch[2].toLowerCase();
      if (entityNames.includes(parent) && entityNames.includes(child)) {
        if (!rels.find(r => r.from.toLowerCase() === parent && r.to.toLowerCase() === child)) {
          rels.push({
            from: parent.charAt(0).toUpperCase() + parent.slice(1),
            to: child.charAt(0).toUpperCase() + child.slice(1),
            type: "one-to-many",
            foreignKey: `${parent}_id`,
          });
        }
      }
    }
  }

  // Ensure all entities have at least basic coverage
  for (const entity of entities) {
    for (const other of entities) {
      if (entity.name === other.name) continue;
      const en = entity.name.toLowerCase();
      const on = other.name.toLowerCase();
      const hasFk = entity.fields.some(f => f.name.toLowerCase() === `${on}_id`);
      if (hasFk && !rels.find(r => r.from.toLowerCase() === on && r.to.toLowerCase() === en)) {
        rels.push({
          from: other.name,
          to: entity.name,
          type: "one-to-many",
          foreignKey: `${on}_id`,
        });
      }
    }
  }

  return rels;
}

// ── OpenAPI Spec Generator ─────────────────────────────────────────────────────

function generateOpenApiSpec(
  entities: GeneratedEntity[],
  endpoints: GeneratedEndpoint[],
  apiRoutes: string,
  domain: string,
): string {
  const appName = serviceName(domain);
  const slug = appSlug(domain);
  const relationships = inferRelationshipsFromEndpoints(entities, endpoints);

  // Build entity schemas
  const schemas: Record<string, any> = {};
  for (const entity of entities) {
    const props: Record<string, any> = {
      id: { type: "string", format: "uuid", description: `Unique identifier for the ${entity.name}` },
      createdAt: { type: "string", format: "date-time", description: "Timestamp when the record was created" },
      updatedAt: { type: "string", format: "date-time", description: "Timestamp when the record was last updated" },
    };
    for (const field of entity.fields) {
      props[field.name] = {
        ...tsTypeToOpenApiType(field.type),
        description: field.description || `${field.name} field of ${entity.name}`,
      };
    }
    // Add foreign key fields from relationships
    for (const rel of relationships) {
      if (rel.to === entity.name) {
        props[rel.foreignKey] = {
          type: "string",
          format: "uuid",
          description: `Foreign key to ${rel.from}`,
        };
      }
    }

    schemas[entity.name] = { type: "object", properties: props, required: ["id", "createdAt", "updatedAt"] };
    schemas[`Create${entity.name}`] = {
      type: "object",
      required: entity.fields.filter(f => f.required).map(f => f.name),
      properties: Object.fromEntries(
        entity.fields.map(f => [f.name, { ...tsTypeToOpenApiType(f.type), description: f.description || f.name }]),
      ),
    };
    schemas[`Update${entity.name}`] = {
      type: "object",
      properties: Object.fromEntries(
        entity.fields.map(f => [f.name, { ...tsTypeToOpenApiType(f.type), description: f.description || f.name }]),
      ),
    };
  }

  // Build paths from endpoints
  const paths: Record<string, any> = {};
  for (const ep of endpoints) {
    const tag = entityToTag(ep.path.split("/")[1] || "root");
    const method = ep.method.toLowerCase();

    const pathObj: any = {
      tags: [tag],
      summary: ep.description,
      operationId: `${method}${ep.path.replace(/[{}]/g, "").replace(/\//g, "_")}`,
      responses: {
        "200": { description: "Successful operation" },
        "400": { description: "Bad request" },
        "401": { description: "Unauthorized" },
        "500": { description: "Internal server error" },
      },
    };

    // Add path parameters
    const pathParams = ep.path.match(/\{[^}]+\}/g);
    if (pathParams) {
      pathObj.parameters = pathParams.map(p => ({
        name: p.replace(/[{}]/g, ""),
        in: "path",
        required: true,
        schema: { type: "string" },
      }));
    }

    // Add request body for POST/PUT/PATCH
    if (["post", "put", "patch"].includes(method)) {
      const entityName = ep.path.split("/")[1];
      const entity = entities.find(e => e.name.toLowerCase() === entityName?.toLowerCase());
      const schemaRef = method === "post"
        ? `#/components/schemas/Create${entity?.name || "Entity"}`
        : `#/components/schemas/Update${entity?.name || "Entity"}`;
      pathObj.requestBody = {
        required: true,
        content: { "application/json": { schema: { $ref: schemaRef } } },
      };
    }

    // Add response schema for GET
    if (method === "get") {
      const entityName = ep.path.split("/")[1];
      const entity = entities.find(e => e.name.toLowerCase() === entityName?.toLowerCase());
      const isList = !ep.path.match(/\{[^}]+\}/);
      if (entity) {
        const ref = `#/components/schemas/${entity.name}`;
        pathObj.responses["200"] = {
          description: isList ? `List of ${entity.name} records` : `${entity.name} record`,
          content: {
            "application/json": {
              schema: isList
                ? { type: "array", items: { $ref: ref } }
                : { $ref: ref },
            },
          },
        };
      }
    }

    if (!paths[ep.path]) paths[ep.path] = {};
    paths[ep.path][method] = pathObj;
  }

  const openApi = {
    openapi: "3.0.3",
    info: {
      title: `${appName} API`,
      version: "1.0.0",
      description: `REST API for ${appName} — auto-generated by Genesis Platform. Domain: ${domain}.`,
      contact: { name: "Genesis Platform", url: "https://genesis-platform.com" },
      license: { name: "MIT" },
    },
    servers: [
      { url: "http://localhost:3000/api", description: "Local development" },
      { url: "https://api.{slug}.com/api".replace("{slug}", slug), description: "Production" },
    ],
    tags: entities.map(e => ({
      name: entityToTag(e.name),
      description: `Operations related to ${e.name}`,
    })),
    paths,
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT access token for authenticated requests",
        },
      },
      responses: {
        UnauthorizedError: {
          description: "Access token is missing or invalid",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
      },
    },
  };

  (openApi.components.schemas as any).Error = {
    type: "object",
    properties: {
      code: { type: "integer", description: "HTTP status code" },
      message: { type: "string", description: "Error message" },
    },
  };

  return JSON.stringify(openApi, null, 2);
}

// ── API Reference Generator ────────────────────────────────────────────────────

function generateApiReference(
  entities: GeneratedEntity[],
  endpoints: GeneratedEndpoint[],
  apiRoutes: string,
  domain: string,
): string {
  const appName = serviceName(domain);
  const relationships = inferRelationshipsFromEndpoints(entities, endpoints);

  let md = `# ${appName} — API Reference\n\n`;
  md += `> Auto-generated by Genesis Platform. Last updated: ${new Date().toISOString().split("T")[0]}\n\n`;

  // Overview
  md += `## Overview\n\n`;
  md += `The ${appName} API is a RESTful JSON API. All requests use HTTPS and return JSON responses.\n\n`;

  // Authentication
  md += `## Authentication\n\n`;
  md += `All API requests require a valid JWT access token in the \`Authorization\` header:\n\n`;
  md += `\`\`\`http\nAuthorization: Bearer <your-jwt-token>\n\`\`\`\n\n`;
  md += `To obtain a token, send a POST request to \`/auth/login\` with valid credentials.\n\n`;

  // Base URL
  md += `## Base URL\n\n`;
  md += `\`\`\`\nhttp://localhost:3000/api\n\`\`\`\n\n`;

  // Request format
  md += `## Request Format\n\n`;
  md += `- **Content-Type**: \`application/json\` for POST/PUT/PATCH requests\n`;
  md += `- **Accept**: \`application/json\`\n`;
  md += `- **Pagination**: Use \`?page=1&limit=20\` query parameters for list endpoints\n`;
  md += `- **Sorting**: Use \`?sort=createdAt&order=desc\` query parameters\n`;
  md += `- **Filtering**: Use \`?field=value\` query parameters for exact matching\n\n`;

  // Entity endpoints
  const entityEndpoints = new Map<string, GeneratedEndpoint[]>();
  for (const ep of endpoints) {
    const entityName = ep.path.split("/")[1];
    if (!entityEndpoints.has(entityName)) entityEndpoints.set(entityName, []);
    entityEndpoints.get(entityName)!.push(ep);
  }

  for (const entity of entities) {
    const tag = entityToTag(entity.name);
    const eps = entityEndpoints.get(tag) || [];
    if (eps.length === 0) continue;

    md += `## ${entity.name}\n\n`;

    // Entity description
    md += `${entity.name} represents the core ${entity.name.toLowerCase()} records in the system.\n\n`;
    md += `### Fields\n\n`;
    md += `| Field | Type | Required | Description |\n`;
    md += `|-------|------|----------|-------------|\n`;
    md += `| id | UUID | Yes | Unique identifier |\n`;
    for (const field of entity.fields) {
      md += `| ${field.name} | ${field.type} | ${field.required ? "Yes" : "No"} | ${field.description || field.name} |\n`;
    }
    // FK fields
    for (const rel of relationships) {
      if (rel.to === entity.name) {
        md += `| ${rel.foreignKey} | UUID | Yes | Foreign key to ${rel.from} |\n`;
      }
    }
    md += `| createdAt | timestamp | Yes | Record creation time |\n`;
    md += `| updatedAt | timestamp | Yes | Record last update time |\n`;

    // Endpoints for this entity
    md += `\n### Endpoints\n\n`;
    for (const ep of eps) {
      const method = ep.method.toUpperCase();
      md += `#### \`${method} ${ep.path}\`\n\n`;
      md += `${ep.description}\n\n`;

      // Request example for POST
      if (["POST", "PUT", "PATCH"].includes(method)) {
        md += `**Request Body:**\n\n`;
        md += `\`\`\`json\n`;
        const example: Record<string, any> = {};
        for (const field of entity.fields) {
          if (field.required || method === "PUT") {
            example[field.name] = exampleValue(field.type, field.name);
          }
        }
        if (["PUT", "PATCH"].includes(method)) {
          // Don't require all fields for updates
        }
        md += JSON.stringify(example, null, 2);
        md += `\n\`\`\`\n\n`;
      }

      // Response example for GET
      if (method === "GET") {
        md += `**Response:**\n\n`;
        md += `\`\`\`json\n`;
        const resp: Record<string, any> = {
          id: "uuid-here",
        };
        for (const field of entity.fields) {
          resp[field.name] = exampleValue(field.type, field.name);
        }
        for (const rel of relationships) {
          if (rel.to === entity.name) {
            resp[rel.foreignKey] = "related-uuid-here";
          }
        }
        resp.createdAt = new Date().toISOString();
        resp.updatedAt = new Date().toISOString();

        if (ep.path.match(/\{[^}]+\}/)) {
          md += JSON.stringify(resp, null, 2);
        } else {
          md += JSON.stringify({
            data: [resp],
            pagination: { page: 1, limit: 20, total: 100, totalPages: 5 },
          }, null, 2);
        }
        md += `\n\`\`\`\n\n`;
      }
    }
    md += `\n`;
  }

  // Error codes
  md += `## Error Codes\n\n`;
  md += `| Code | Description |\n`;
  md += `|------|-------------|\n`;
  md += `| 200 | Success |\n`;
  md += `| 201 | Created successfully |\n`;
  md += `| 400 | Bad request — invalid input |\n`;
  md += `| 401 | Unauthorized — missing or invalid token |\n`;
  md += `| 403 | Forbidden — insufficient permissions |\n`;
  md += `| 404 | Not found — resource doesn't exist |\n`;
  md += `| 409 | Conflict — duplicate or constraint violation |\n`;
  md += `| 422 | Unprocessable entity — validation error |\n`;
  md += `| 429 | Too many requests — rate limit exceeded |\n`;
  md += `| 500 | Internal server error |\n`;

  // Error response format
  md += `\n### Error Response Format\n\n`;
  md += `\`\`\`json\n`;
  md += JSON.stringify({ code: 400, message: "Validation failed", errors: [{ field: "name", message: "Name is required" }] }, null, 2);
  md += `\n\`\`\`\n`;

  return md;
}

function exampleValue(type: string, fieldName: string): any {
  const t = type.toLowerCase();
  if (t === "string" || t === "text" || t === "varchar") return fieldName.includes("email") ? "user@example.com" : "example-value";
  if (t === "number" || t === "integer" || t === "int" || t === "bigint") return 42;
  if (t === "float" || t === "double" || t === "decimal") return 99.99;
  if (t === "boolean" || t === "bool") return true;
  if (t === "date" || t === "datetime" || t === "timestamp") return new Date().toISOString();
  if (t === "uuid") return "550e8400-e29b-41d4-a716-446655440000";
  return "string";
}

// ── User Guide Generator ───────────────────────────────────────────────────────

function generateUserGuide(
  entities: GeneratedEntity[],
  endpoints: GeneratedEndpoint[],
  domain: string,
): string {
  const appName = serviceName(domain);
  const slug = appSlug(domain);

  let md = `# ${appName} — User Guide\n\n`;
  md += `> Auto-generated by Genesis Platform. Last updated: ${new Date().toISOString().split("T")[0]}\n\n`;

  // Getting Started
  md += `## Getting Started\n\n`;
  md += `Welcome to ${appName}! This guide will help you get started with the platform and understand its core features.\n\n`;

  md += `### Accessing the Application\n\n`;
  md += `1. Open your web browser and navigate to your ${appName} instance URL\n`;
  md += `2. Log in with your credentials (email and password)\n`;
  md += `3. You will land on the main dashboard, which provides an overview of your data\n\n`;

  md += `### Navigation\n\n`;
  md += `The main navigation sidebar provides access to all modules:\n\n`;
  for (const entity of entities) {
    md += `- **${entity.name}** — Manage your ${entity.name.toLowerCase()} records\n`;
  }
  md += `- **Dashboard** — View analytics and reports\n`;
  md += `- **Settings** — Configure your account and preferences\n\n`;

  // Entity Overviews
  md += `## Entity Overviews\n\n`;
  for (const entity of entities) {
    md += `### ${entity.name}\n\n`;
    md += `${entity.name} represents ${entity.name.toLowerCase()} records in ${appName}. `;
    md += `You can create, view, update, and delete ${entity.name.toLowerCase()} entries.\n\n`;

    md += `**Fields:**\n\n`;
    md += `| Field | Type | Description |\n`;
    md += `|-------|------|-------------|\n`;
    for (const field of entity.fields) {
      md += `| ${field.name} | ${field.type} | ${field.description || field.name} |\n`;
    }
    md += `\n`;

    md += `**Actions:**\n\n`;
    md += `- **Create**: Click the "New ${entity.name}" button and fill in the form\n`;
    md += `- **View**: Click on any ${entity.name} row to see details\n`;
    md += `- **Edit**: Click the edit icon on any ${entity.name} to modify\n`;
    md += `- **Delete**: Click the delete icon and confirm removal\n`;
    md += `- **Search**: Use the search bar to filter ${entity.name} records\n`;
    md += `- **Export**: Click "Export" to download ${entity.name} data as CSV\n\n`;
  }

  // Common Workflows
  md += `## Common Workflows\n\n`;

  // Creating a new record workflow
  md += `### Creating a New Record\n\n`;
  const primaryEntity = entities[0] || { name: "Entity" };
  md += `1. Navigate to the **${primaryEntity.name}** section from the sidebar\n`;
  md += `2. Click the **"New ${primaryEntity.name}"** button (usually top-right)\n`;
  md += `3. Fill in the required fields in the form that appears\n`;
  md += `4. Review your entries for accuracy\n`;
  md += `5. Click **"Save"** or **"Create"** to submit\n`;
  md += `6. You will see a success notification and be redirected to the new record\n\n`;

  // Editing workflow
  md += `### Editing a Record\n\n`;
  md += `1. Navigate to the record you want to edit\n`;
  md += `2. Click the **edit icon** (pencil) or open the record detail page\n`;
  md += `3. Modify the fields you need to change\n`;
  md += `4. Click **"Save"** to apply your changes\n\n`;

  // Searching and filtering
  md += `### Searching and Filtering\n\n`;
  md += `1. Use the **search bar** at the top of any list page\n`;
  md += `2. Type your search query — results update in real-time\n`;
  md += `3. Use the **filter dropdowns** to narrow by specific fields\n`;
  md += `4. Click **"Clear Filters"** to reset all filters\n\n`;

  // Bulk operations
  md += `### Bulk Operations\n\n`;
  md += `1. Select multiple records using the checkboxes\n`;
  md += `2. Use the **bulk actions toolbar** that appears\n`;
  md += `3. Choose an action (delete, export, update status)\n`;
  md += `4. Confirm the operation when prompted\n\n`;

  // Reporting
  md += `### Viewing Reports\n\n`;
  md += `1. Navigate to the **Dashboard** section\n`;
  md += `2. Review the charts and metrics displayed\n`;
  md += `3. Use date range filters to adjust the time period\n`;
  md += `4. Click individual chart elements to drill down into details\n\n`;

  // FAQ
  md += `## Frequently Asked Questions\n\n`;

  md += `### How do I reset my password?\n`;
  md += `Click "Forgot Password" on the login page. You will receive an email with reset instructions.\n\n`;

  md += `### How do I add a new user?\n`;
  md += `Administrators can add users from the **Settings → Users** page. Click "Invite User" and enter their email.\n\n`;

  md += `### Can I export my data?\n`;
  md += `Yes! Navigate to any list view and click the **Export** button. Data can be exported as CSV or JSON.\n\n`;

  md += `### Is there a mobile app?\n`;
  md += `${appName} is fully responsive and works on mobile browsers. A native mobile app is planned for future release.\n\n`;

  md += `### How do I get support?\n`;
  md += `Contact our support team at support@${slug}.com or use the in-app chat widget.\n\n`;

  md += `### Can I customize the dashboard?\n`;
  md += `Yes! Drag and drop widgets to arrange your dashboard. Click "Add Widget" to add new charts and metrics.\n\n`;

  md += `### How is my data backed up?\n`;
  md += `All data is automatically backed up daily. Enterprise plans include real-time replication.\n\n`;

  return md;
}

// ── Developer Guide Generator ──────────────────────────────────────────────────

function generateDeveloperGuide(
  entities: GeneratedEntity[],
  endpoints: GeneratedEndpoint[],
  apiRoutes: string,
  domain: string,
): string {
  const appName = serviceName(domain);
  const slug = appSlug(domain);

  let md = `# ${appName} — Developer Guide\n\n`;
  md += `> Auto-generated by Genesis Platform. Last updated: ${new Date().toISOString().split("T")[0]}\n\n`;

  // Architecture overview
  md += `## Architecture Overview\n\n`;
  md += `${appName} follows a modern three-tier architecture:\n\n`;
  md += `\`\`\`\n`;
  md += `┌─────────────┐     ┌─────────────┐     ┌─────────────┐\n`;
  md += `│  Frontend   │────▶│   Backend   │────▶│  Database   │\n`;
  md += `│  (React)    │◀────│   (Hono)    │◀────│ (PostgreSQL)│\n`;
  md += `└─────────────┘     └─────────────┘     └─────────────┘\n`;
  md += `                           │\n`;
  md += `                           ▼\n`;
  md += `                    ┌─────────────┐\n`;
  md += `                    │   Redis     │\n`;
  md += `                    │   (Cache)   │\n`;
  md += `                    └─────────────┘\n`;
  md += `\`\`\`\n\n`;

  md += `- **Frontend**: React + TypeScript + Vite + Tailwind CSS\n`;
  md += `- **Backend**: Bun + Hono (TypeScript-first web framework)\n`;
  md += `- **Database**: PostgreSQL with Drizzle ORM\n`;
  md += `- **Cache**: Redis for session and query caching\n`;
  md += `- **Auth**: JWT-based authentication with refresh tokens\n`;
  md += `- **File Storage**: Local disk / S3-compatible storage\n\n`;

  // Project structure
  md += `## Project Structure\n\n`;
  md += `\`\`\`\n`;
  md += `├── backend/\n`;
  md += `│   ├── src/\n`;
  md += `│   │   ├── routes/          # API route handlers\n`;
  md += `│   │   ├── middleware/      # Auth, logging, CORS\n`;
  md += `│   │   ├── db/             # Database schema & migrations\n`;
  md += `│   │   ├── services/       # Business logic layer\n`;
  md += `│   │   ├── utils/          # Shared utilities\n`;
  md += `│   │   └── server.ts       # Entry point\n`;
  md += `│   ├── Dockerfile\n`;
  md += `│   └── package.json\n`;
  md += `├── frontend/\n`;
  md += `│   ├── src/\n`;
  md += `│   │   ├── components/     # Reusable UI components\n`;
  md += `│   │   ├── pages/          # Page components\n`;
  md += `│   │   ├── hooks/          # Custom React hooks\n`;
  md += `│   │   ├── lib/            # API client & utilities\n`;
  md += `│   │   └── main.tsx        # Entry point\n`;
  md += `│   ├── Dockerfile\n`;
  md += `│   └── package.json\n`;
  md += `├── docker-compose.yml\n`;
  md += `├── docker-compose.prod.yml\n`;
  md += `├── Makefile\n`;
  md += `└── README.md\n`;
  md += `\`\`\`\n\n`;

  // Setup instructions
  md += `## Setup Instructions\n\n`;

  md += `### Prerequisites\n\n`;
  md += `- **Bun** (>= 1.0) — JavaScript runtime and package manager\n`;
  md += `- **Docker** (>= 24) — Container runtime for services\n`;
  md += `- **Node.js** (>= 18, optional) — Alternative JS runtime\n`;
  md += `- **PostgreSQL** (>= 15) — If not using Docker\n\n`;

  md += `### Quick Start (Docker)\n\n`;
  md += `\`\`\`bash\n`;
  md += `# Clone the repository\n`;
  md += `git clone https://github.com/your-org/${slug}.git\n`;
  md += `cd ${slug}\n\n`;
  md += `# Start all services\n`;
  md += `docker compose up -d\n\n`;
  md += `# Run database migrations\n`;
  md += `docker compose exec backend bun run migrate\n\n`;
  md += `# Seed the database (optional)\n`;
  md += `docker compose exec backend bun run seed\n\n`;
  md += `# Open the app\n`;
  md += `open http://localhost:3000\n`;
  md += `\`\`\`\n\n`;

  md += `### Local Development\n\n`;
  md += `\`\`\`bash\n`;
  md += `# Install dependencies for both projects\n`;
  md += `cd backend && bun install\n`;
  md += `cd ../frontend && bun install\n\n`;
  md += `# Start PostgreSQL (Docker)\n`;
  md += `docker run -d --name ${slug}-db -p 5432:5432 \\\n`;
  md += `  -e POSTGRES_USER=${slug} \\\n`;
  md += `  -e POSTGRES_PASSWORD=${slug} \\\n`;
  md += `  -e POSTGRES_DB=${slug} \\\n`;
  md += `  postgres:16-alpine\n\n`;
  md += `# Set up environment\n`;
  md += `cp backend/.env.example backend/.env\n`;
  md += `cp frontend/.env.example frontend/.env\n\n`;
  md += `# Run migrations\n`;
  md += `cd backend && bun run migrate\n\n`;
  md += `# Start backend (http://localhost:3001)\n`;
  md += `cd backend && bun run dev\n\n`;
  md += `# In another terminal, start frontend (http://localhost:5173)\n`;
  md += `cd frontend && bun run dev\n`;
  md += `\`\`\`\n\n`;

  // API Overview
  md += `## API Overview\n\n`;
  md += `The backend exposes a RESTful JSON API at \`/api\`. See [API Reference](#api-reference) for complete endpoint documentation.\n\n`;

  md += `### Available Endpoints\n\n`;
  for (const entity of entities) {
    md += `#### ${entity.name}\n`;
    md += `| Method | Path | Description |\n`;
    md += `|--------|------|-------------|\n`;
    const entityEpPatterns = [
      { method: "GET", path: `/${entityToTag(entity.name)}`, desc: `List all ${entity.name.toLowerCase()} records` },
      { method: "POST", path: `/${entityToTag(entity.name)}`, desc: `Create a new ${entity.name.toLowerCase()}` },
      { method: "GET", path: `/${entityToTag(entity.name)}/:id`, desc: `Get ${entity.name.toLowerCase()} by ID` },
      { method: "PUT", path: `/${entityToTag(entity.name)}/:id`, desc: `Update ${entity.name.toLowerCase()}` },
      { method: "DELETE", path: `/${entityToTag(entity.name)}/:id`, desc: `Delete ${entity.name.toLowerCase()}` },
    ];
    for (const ep of entityEpPatterns) {
      md += `| ${ep.method} | \`${ep.path}\` | ${ep.desc} |\n`;
    }
    md += `\n`;
  }

  // Authentication
  md += `## Authentication\n\n`;
  md += `The API uses JWT (JSON Web Token) authentication:\n\n`;
  md += `1. Send a POST request to \`/auth/login\` with email and password\n`;
  md += `2. Receive an access token (15 min expiry) and refresh token (7 days)\n`;
  md += `3. Include the access token in the \`Authorization: Bearer <token>\` header\n`;
  md += `4. When the access token expires, use the refresh token at \`/auth/refresh\`\n\n`;

  md += `### Example Login\n\n`;
  md += `\`\`\`bash\n`;
  md += `curl -X POST http://localhost:3001/api/auth/login \\\n`;
  md += `  -H "Content-Type: application/json" \\\n`;
  md += `  -d '{"email":"admin@example.com","password":"password123"}'\n`;
  md += `\`\`\`\n\n`;

  md += `### Example Authenticated Request\n\n`;
  md += `\`\`\`bash\n`;
  md += `curl http://localhost:3001/api/${entityToTag(entities[0]?.name || "items")} \\\n`;
  md += `  -H "Authorization: Bearer <access-token>"\n`;
  md += `\`\`\`\n\n`;

  // How to extend
  md += `## How to Extend\n\n`;

  md += `### Adding a New Entity\n\n`;
  md += `1. **Database**: Create a new migration in \`backend/src/db/migrations/\`\n`;
  md += `\`\`\`typescript\n`;
  md += `// backend/src/db/schema/new-entity.ts\n`;
  md += `import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";\n\n`;
  md += `export const newEntity = pgTable("new_entity", {\n`;
  md += `  id: uuid("id").defaultRandom().primaryKey(),\n`;
  md += `  name: varchar("name", { length: 255 }).notNull(),\n`;
  md += `  createdAt: timestamp("created_at").defaultNow().notNull(),\n`;
  md += `  updatedAt: timestamp("updated_at").defaultNow().notNull(),\n`;
  md += `});\n`;
  md += `\`\`\`\n\n`;

  md += `2. **API Route**: Add route handlers in \`backend/src/routes/\`\n`;
  md += `\`\`\`typescript\n`;
  md += `// backend/src/routes/new-entity.ts\n`;
  md += `import { Hono } from "hono";\n`;
  md += `const router = new Hono();\n`;
  md += `router.get("/", async (c) => { /* list */ });\n`;
  md += `router.post("/", async (c) => { /* create */ });\n`;
  md += `export default router;\n`;
  md += `\`\`\`\n\n`;

  md += `3. **Frontend Page**: Create a new page component\n`;
  md += `\`\`\`tsx\n`;
  md += `// frontend/src/pages/NewEntityPage.tsx\n`;
  md += `export default function NewEntityPage() {\n`;
  md += `  return <div>{/* Your component code */}</div>;\n`;
  md += `}\n`;
  md += `\`\`\`\n\n`;

  md += `4. **Register the route** in the main router file\n\n`;

  md += `### Adding Custom Business Logic\n\n`;
  md += `Place business logic in \`backend/src/services/\` to keep routes clean:\n\n`;
  md += `\`\`\`typescript\n`;
  md += `// backend/src/services/new-entity-service.ts\n`;
  md += `export class NewEntityService {\n`;
  md += `  async create(data: CreateEntityInput) {\n`;
  md += `    // Validation, business rules, side effects\n`;
  md += `    return await db.insert(newEntity).values(data).returning();\n`;
  md += `  }\n`;
  md += `}\n`;
  md += `\`\`\`\n\n`;

  // Environment
  md += `## Environment Variables\n\n`;
  md += `| Variable | Description | Default |\n`;
  md += `|----------|-------------|--------|\n`;
  md += `| \`DATABASE_URL\` | PostgreSQL connection string | \`postgres://localhost:5432/${slug}\` |\n`;
  md += `| \`REDIS_URL\` | Redis connection string | \`redis://localhost:6379\` |\n`;
  md += `| \`JWT_SECRET\` | Secret for signing JWTs | (required) |\n`;
  md += `| \`PORT\` | Backend server port | \`3001\` |\n`;
  md += `| \`CORS_ORIGIN\` | Allowed CORS origin | \`http://localhost:5173\` |\n`;
  md += `| \`NODE_ENV\` | Environment | \`development\` |\n`;
  md += `| \`LOG_LEVEL\` | Logging verbosity | \`info\` |\n\n`;

  // Testing
  md += `## Testing\n\n`;
  md += `\`\`\`bash\n`;
  md += `# Run all tests\n`;
  md += `cd backend && bun test\n`;
  md += `cd frontend && bun test\n\n`;
  md += `# Run with coverage\n`;
  md += `bun test --coverage\n\n`;
  md += `# Run specific test file\n`;
  md += `bun test src/__tests__/entity.test.ts\n`;
  md += `\`\`\`\n\n`;

  // Deployment
  md += `## Deployment\n\n`;
  md += `See the \`docker-compose.prod.yml\` file for production deployment configuration.\n\n`;
  md += `### Production Checklist\n\n`;
  md += `- [ ] Set strong \`JWT_SECRET\`\n`;
  md += `- [ ] Configure HTTPS (reverse proxy or cloud provider)\n`;
  md += `- [ ] Set up database backups\n`;
  md += `- [ ] Enable rate limiting\n`;
  md += `- [ ] Configure monitoring and alerts\n`;
  md += `- [ ] Set \`NODE_ENV=production\`\n`;
  md += `- [ ] Use a managed PostgreSQL service (RDS, Cloud SQL, etc.)\n`;
  md += `- [ ] Set up CI/CD pipeline\n\n`;

  return md;
}

// ── README Generator ───────────────────────────────────────────────────────────

function generateReadme(
  entities: GeneratedEntity[],
  endpoints: GeneratedEndpoint[],
  domain: string,
  apiReference: string,
  userGuide: string,
  developerGuide: string,
): string {
  const appName = serviceName(domain);
  const slug = appSlug(domain);

  let md = `# ${appName}\n\n`;
  md += `> Generated by [Genesis Platform](https://genesis-platform.com) — the Autonomous Software Generation Platform\n\n`;

  // Badges
  md += `![License](https://img.shields.io/badge/license-MIT-blue.svg)\n`;
  md += `![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)\n`;
  md += `![Bun](https://img.shields.io/badge/Bun-1.x-000000?logo=bun)\n`;
  md += `![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react)\n\n`;

  // Overview
  md += `## Overview\n\n`;
  md += `${appName} is a full-stack business application${domain ? ` for ${domain}` : ""}. `;
  md += `It manages the following entities:\n\n`;
  for (const entity of entities) {
    md += `- **${entity.name}** — ${entity.fields.length} fields\n`;
  }
  md += `\n`;

  md += `### Tech Stack\n\n`;
  md += `| Layer | Technology |\n`;
  md += `|-------|-----------|\n`;
  md += `| Frontend | React 18, TypeScript, Vite, Tailwind CSS |\n`;
  md += `| Backend | Bun, Hono (TypeScript) |\n`;
  md += `| Database | PostgreSQL 16 |\n`;
  md += `| ORM | Drizzle ORM |\n`;
  md += `| Cache | Redis |\n`;
  md += `| Auth | JWT (access + refresh tokens) |\n`;
  md += `| Container | Docker & Docker Compose |\n\n`;

  // Quick Start
  md += `## Quick Start\n\n`;
  md += `\`\`\`bash\n`;
  md += `# Clone and start\n`;
  md += `git clone https://github.com/your-org/${slug}.git\n`;
  md += `cd ${slug}\n`;
  md += `docker compose up -d\n`;
  md += `docker compose exec backend bun run migrate\n`;
  md += `open http://localhost:3000\n`;
  md += `\`\`\`\n\n`;

  // Entity Summary
  md += `## Data Model\n\n`;
  md += `| Entity | Fields | Endpoints |\n`;
  md += `|--------|--------|----------|\n`;
  for (const entity of entities) {
    const epCount = endpoints.filter(e => e.path.includes(entityToTag(entity.name))).length;
    md += `| ${entity.name} | ${entity.fields.length} | ${epCount} |\n`;
  }
  md += `\n`;

  // Documentation links
  md += `## Documentation\n\n`;
  md += `- [API Reference](./docs/api-reference.md) — Complete REST API documentation\n`;
  md += `- [User Guide](./docs/user-guide.md) — Getting started and common workflows\n`;
  md += `- [Developer Guide](./docs/developer-guide.md) — Architecture, setup, and extending\n\n`;

  // Features
  md += `## Features\n\n`;
  md += `- 🔐 **JWT Authentication** — Secure login with access and refresh tokens\n`;
  md += `- 📊 **Dashboard** — Real-time analytics and KPIs\n`;
  md += `- 🔔 **Notifications** — Email, push, and in-app notifications\n`;
  md += `- 🔒 **Role-Based Access Control** — Granular permissions per role\n`;
  md += `- 📄 **Reports** — Scheduled and on-demand report generation\n`;
  md += `- 🔄 **Workflows** — Automated business process workflows\n`;
  md += `- 🌐 **REST API** — Full CRUD API for all entities\n`;
  md += `- 🐳 **Docker** — Containerized for easy deployment\n`;
  md += `- 📱 **Responsive** — Works on desktop, tablet, and mobile\n`;
  md += `- 🎨 **Dark Theme** — Modern dark UI out of the box\n\n`;

  // Contributing
  md += `## Contributing\n\n`;
  md += `1. Fork the repository\n`;
  md += `2. Create a feature branch (\`git checkout -b feature/amazing-feature\`)\n`;
  md += `3. Commit your changes (\`git commit -m 'Add amazing feature'\`)\n`;
  md += `4. Push to the branch (\`git push origin feature/amazing-feature\`)\n`;
  md += `5. Open a Pull Request\n\n`;

  // License
  md += `## License\n\n`;
  md += `MIT © ${new Date().getFullYear()} ${appName}\n`;
  md += `\n---\n`;
  md += `*Generated by [Genesis Platform](https://genesis-platform.com)*\n`;

  return md;
}

// ── Main generator function ────────────────────────────────────────────────────

export function generateDocumentation(
  entities: GeneratedEntity[],
  endpoints: GeneratedEndpoint[],
  apiRoutes: string,
  domain: string,
): DocumentationProject {
  const openApiSpec = generateOpenApiSpec(entities, endpoints, apiRoutes, domain);
  const apiReference = generateApiReference(entities, endpoints, apiRoutes, domain);
  const userGuide = generateUserGuide(entities, endpoints, domain);
  const developerGuide = generateDeveloperGuide(entities, endpoints, apiRoutes, domain);
  const readme = generateReadme(entities, endpoints, domain, apiReference, userGuide, developerGuide);

  return { openApiSpec, apiReference, userGuide, developerGuide, readme };
}
