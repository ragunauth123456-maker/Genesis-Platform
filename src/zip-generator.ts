/**
 * ZIP Generator
 * Takes a GenerationResult and produces a downloadable ZIP file
 * containing the complete project directory structure.
 *
 * Uses JSZip for in-memory ZIP creation — no filesystem writes needed.
 */

import JSZip from "jszip";
import type { GenerationResult } from "./generate";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate a ZIP archive containing all project files.
 * Returns the ZIP as a base64-encoded string (suitable for TanStack server functions).
 */
export async function generateProjectZip(
  result: GenerationResult
): Promise<string> {
  const zip = new JSZip();
  const domainSlug = slugify(result.domain || "generated-app");
  const projectRoot = `${domainSlug}-project`;

  // ── Root README.md ─────────────────────────────────────────────────────
  const rootReadme = buildRootReadme(result);
  zip.file(`${projectRoot}/README.md`, rootReadme);

  // ── Backend ────────────────────────────────────────────────────────────
  if (result.backendProject) {
    const bp = result.backendProject;
    const bRoot = `${projectRoot}/backend`;
    zip.file(`${bRoot}/package.json`, bp.packageJson);
    zip.file(`${bRoot}/tsconfig.json`, bp.tsconfigJson);
    zip.file(`${bRoot}/.env.example`, bp.envExample);
    zip.file(`${bRoot}/README.md`, bp.readme);
    zip.file(`${bRoot}/src/index.ts`, bp.indexTs);
    zip.file(`${bRoot}/src/config.ts`, bp.configTs);
    for (const mw of bp.middleware) {
      zip.file(`${bRoot}/src/middleware/${mw.filename}`, mw.content);
    }
    // Also include the generated API routes as routes.ts
    if (result.apiRoutes) {
      zip.file(`${bRoot}/src/routes.ts`, result.apiRoutes);
    }
  }

  // ── Database ───────────────────────────────────────────────────────────
  if (result.databaseProject) {
    const dp = result.databaseProject;
    const dRoot = `${projectRoot}/database`;
    zip.file(`${dRoot}/docker-compose.yml`, dp.dockerCompose);
    zip.file(`${dRoot}/.env.example`, dp.envExample);
    for (const mig of dp.migrations) {
      zip.file(`${dRoot}/migrations/${mig.filename}`, mig.content);
    }
    zip.file(`${dRoot}/src/connection.ts`, dp.connectionCode);
    zip.file(`${dRoot}/src/migrate.ts`, dp.migrateCode);
    zip.file(`${dRoot}/src/seed.ts`, dp.seedCode);
  }

  // ── Frontend ───────────────────────────────────────────────────────────
  if (result.frontendProject) {
    const fp = result.frontendProject;
    const fRoot = `${projectRoot}/frontend`;
    zip.file(`${fRoot}/package.json`, fp.files.find(f => f.filename === "package.json")?.content || "");
    zip.file(`${fRoot}/tsconfig.json`, fp.files.find(f => f.filename === "tsconfig.json")?.content || "");
    zip.file(`${fRoot}/tsconfig.node.json`, fp.files.find(f => f.filename === "tsconfig.node.json")?.content || "");
    zip.file(`${fRoot}/vite.config.ts`, fp.files.find(f => f.filename === "vite.config.ts")?.content || "");
    zip.file(`${fRoot}/tailwind.config.js`, fp.files.find(f => f.filename === "tailwind.config.js")?.content || "");
    zip.file(`${fRoot}/postcss.config.js`, fp.files.find(f => f.filename === "postcss.config.js")?.content || "");
    zip.file(`${fRoot}/index.html`, fp.indexHtml);
    zip.file(`${fRoot}/src/index.tsx`, fp.indexTsx);
    zip.file(`${fRoot}/src/App.tsx`, fp.appTsx);
    zip.file(`${fRoot}/src/types.ts`, fp.files.find(f => f.filename === "src/types.ts")?.content || "");
    zip.file(`${fRoot}/src/index.css`, fp.files.find(f => f.filename === "src/index.css")?.content || "");
    // Component files
    for (const file of fp.files) {
      if (file.filename.startsWith("src/components/")) {
        zip.file(`${fRoot}/${file.filename}`, file.content);
      }
    }
    // Frontend README
    zip.file(`${fRoot}/README.md`, buildFrontendReadme(result));
  }

  // ── Dashboard ───────────────────────────────────────────────────────────
  if (result.dashboardProject) {
    const dRoot = `${projectRoot}/dashboard`;
    zip.file(`${dRoot}/Dashboard.tsx`, result.dashboardProject.dashboardTsx);
    zip.file(`${dRoot}/README.md`, buildDashboardReadme(result));
  }

  // ── Deploy ─────────────────────────────────────────────────────────────
  if (result.deploymentProject) {
    const dep = result.deploymentProject;
    const deployRoot = `${projectRoot}/deploy`;
    zip.file(`${deployRoot}/Dockerfile`, dep.dockerfile);
    zip.file(`${deployRoot}/Dockerfile.frontend`, dep.dockerfileFrontend);
    zip.file(`${deployRoot}/docker-compose.prod.yml`, dep.dockerComposeProd);
    zip.file(`${deployRoot}/fly.toml`, dep.flyToml);
    zip.file(`${deployRoot}/deploy.sh`, dep.deployScript);
    zip.folder(`${deployRoot}/.github/workflows`);
    zip.file(`${deployRoot}/.github/workflows/deploy.yml`, dep.githubActions);
    zip.file(`${deployRoot}/README.md`, buildDeployReadme(result));
  }

  // ── Workflows ───────────────────────────────────────────────────────────
  if (result.workflowProject) {
    const wp = result.workflowProject;
    const wRoot = `${projectRoot}/workflows`;
    // Write each state machine
    wp.stateMachines.forEach((sm, i) => {
      const safeName = sm.entity.toLowerCase().replace(/[^a-z0-9]/g, "-");
      zip.file(`${wRoot}/state-machines/${safeName}.ts`, sm.tsCode);
      zip.file(`${wRoot}/state-machines/${safeName}.mermaid`, sm.mermaid);
    });
    // Write each approval flow
    wp.approvalFlows.forEach((af, i) => {
      const safeName = af.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      zip.file(`${wRoot}/approval-flows/${safeName}.ts`, af.tsCode);
      zip.file(`${wRoot}/approval-flows/${safeName}.mermaid`, af.mermaid);
    });
    // Write each process flow
    wp.processFlows.forEach((pf, i) => {
      const safeName = pf.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      zip.file(`${wRoot}/process-flows/${safeName}.ts`, pf.tsCode);
      zip.file(`${wRoot}/process-flows/${safeName}.mermaid`, pf.mermaid);
    });
    // Write workflow engine
    zip.file(`${wRoot}/workflow-engine.ts`, wp.workflowEngine);
    // Workflows README
    zip.file(`${wRoot}/README.md`, buildWorkflowsReadme(result));
  }

  // ── Reports ───────────────────────────────────────────────────────────────
  if (result.reportProject) {
    const rp = result.reportProject;
    const rRoot = `${projectRoot}/reports`;

    // Write summary reports
    const summaryReports = rp.reports.filter((r) => r.type === "summary");
    summaryReports.forEach((r) => {
      const safeName = r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      zip.file(`${rRoot}/summary/${safeName}.ts`, r.tsCode);
    });

    // Write detail reports
    const detailReports = rp.reports.filter((r) => r.type === "detail");
    detailReports.forEach((r) => {
      const safeName = r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      zip.file(`${rRoot}/detail/${safeName}.ts`, r.tsCode);
    });

    // Write dashboard report
    const dashboardReports = rp.reports.filter((r) => r.type === "dashboard");
    dashboardReports.forEach((r) => {
      const safeName = r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      zip.file(`${rRoot}/dashboard/${safeName}.ts`, r.tsCode);
    });

    // Write scheduled config
    if (result.scheduledConfigJson) {
      zip.file(`${rRoot}/scheduled-reports.json`, result.scheduledConfigJson);
    }

    // Write report runner
    if (result.reportRunner) {
      zip.file(`${rRoot}/report-runner.ts`, result.reportRunner);
    }

    // Reports README
    zip.file(`${rRoot}/README.md`, buildReportsReadme(result));
  }

  // ── Also include SQL schema at root level for convenience ──────────────
  if (result.sql) {
    zip.file(`${projectRoot}/database/schema.sql`, result.sql);
  }

  // Generate and return as base64
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(buffer).toString("base64");
}

// ── README builders ───────────────────────────────────────────────────────

function buildRootReadme(result: GenerationResult): string {
  const lines: string[] = [];
  lines.push(`# ${result.domain} — Generated by Genesis Platform`);
  lines.push("");
  lines.push(result.summary);
  lines.push("");
  lines.push("## Project Structure");
  lines.push("");
  lines.push("```");
  lines.push("├── backend/          # Bun + Hono API server");
  lines.push("│   ├── src/");
  lines.push("│   │   ├── index.ts        # Server entry point");
  lines.push("│   │   ├── config.ts       # Environment configuration");
  lines.push("│   │   ├── routes.ts       # API route handlers");
  lines.push("│   │   └── middleware/     # Auth, logging, error handling");
  lines.push("│   ├── package.json");
  lines.push("│   ├── tsconfig.json");
  lines.push("│   └── .env.example");
  lines.push("├── database/         # PostgreSQL schema & tooling");
  lines.push("│   ├── docker-compose.yml  # Local PostgreSQL instance");
  lines.push("│   ├── schema.sql          # Complete DDL");
  lines.push("│   ├── migrations/         # Incremental migrations");
  lines.push("│   └── src/                # Connection, migration runner, seed data");
  lines.push("└── frontend/         # React + TypeScript + Tailwind");
  lines.push("    ├── src/");
  lines.push("    │   ├── index.tsx       # React entry point");
  lines.push("    │   ├── App.tsx         # Root component");
  lines.push("    │   ├── types.ts        # TypeScript types");
  lines.push("    │   ├── index.css       # Tailwind + base styles");
  lines.push("    │   └── components/     # All generated components");
  lines.push("    ├── index.html");
  lines.push("    ├── package.json");
  lines.push("    ├── vite.config.ts");
  lines.push("    └── tailwind.config.js");
  if (result.dashboardProject) {
    lines.push("├── dashboard/        # Admin Dashboard");
    lines.push("│   ├── Dashboard.tsx       # Recharts dashboard with KPIs & charts");
    lines.push("│   └── README.md");
  }
  if (result.deploymentProject) {
    lines.push("├── deploy/           # Deployment configurations");
    lines.push("│   ├── Dockerfile           # Backend multi-stage Bun image");
    lines.push("│   ├── Dockerfile.frontend  # Frontend Vite → nginx image");
    lines.push("│   ├── docker-compose.prod.yml  # Full-stack orchestration");
    lines.push("│   ├── fly.toml             # Fly.io deployment config");
    lines.push("│   ├── deploy.sh            # Build, migrate, deploy script");
    lines.push("│   └── .github/workflows/deploy.yml  # GitHub Actions CI/CD");
  }
  if (result.workflowProject) {
    lines.push("├── workflows/        # State machines, approval flows, process flows");
    lines.push("│   ├── workflow-engine.ts  # Reusable TypeScript workflow engine");
    lines.push("│   ├── state-machines/     # Per-entity state transition definitions");
    lines.push("│   ├── approval-flows/     # Multi-step approval chain definitions");
    lines.push("│   └── process-flows/      # End-to-end business process definitions");
  }
  if (result.reportProject) {
    lines.push("├── reports/          # Report templates, analytics queries, scheduling");
    lines.push("│   ├── report-runner.ts    # Execute and schedule all reports");
    lines.push("│   ├── scheduled-reports.json  # Report scheduling configuration");
    lines.push("│   ├── summary/            # Aggregation reports (COUNT, SUM, AVG, GROUP BY)");
    lines.push("│   ├── detail/             # Full table export reports with filtering");
    lines.push("│   └── dashboard/          # Cross-entity KPI dashboard reports");
  }
  lines.push("```");
  lines.push("");
  lines.push("## Getting Started");
  lines.push("");
  lines.push("### 1. Start the database");
  lines.push("```bash");
  lines.push("cd database");
  lines.push("docker-compose up -d");
  lines.push("bun run src/migrate.ts");
  lines.push("bun run src/seed.ts");
  lines.push("```");
  lines.push("");
  lines.push("### 2. Start the backend");
  lines.push("```bash");
  lines.push("cd backend");
  lines.push("cp .env.example .env");
  lines.push("bun install");
  lines.push("bun run dev");
  lines.push("```");
  lines.push("");
  lines.push("### 3. Start the frontend");
  lines.push("```bash");
  lines.push("cd frontend");
  lines.push("bun install");
  lines.push("bun run dev");
  lines.push("```");
  lines.push("");
  lines.push("## Data Model");
  lines.push("");
  for (const entity of result.entities) {
    lines.push(`### ${entity.name}`);
    lines.push("");
    lines.push("| Field | Type | Required | Description |");
    lines.push("|-------|------|----------|-------------|");
    for (const field of entity.fields) {
      lines.push(
        `| ${field.name} | \`${field.type}\` | ${field.required ? "✓" : ""} | ${field.description || ""} |`
      );
    }
    lines.push("");
  }
  lines.push("## API Endpoints");
  lines.push("");
  lines.push("| Method | Path | Description |");
  lines.push("|--------|------|-------------|");
  for (const ep of result.endpoints) {
    lines.push(`| ${ep.method} | \`${ep.path}\` | ${ep.description} |`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("*Generated by [Genesis Platform](https://genesis-platform.com) — Autonomous Software Generation*");

  return lines.join("\n");
}

function buildFrontendReadme(result: GenerationResult): string {
  const lines: string[] = [];
  lines.push("# Frontend — React + TypeScript + Tailwind");
  lines.push("");
  lines.push("This frontend was generated by Genesis Platform based on your business requirements.");
  lines.push("");
  lines.push("## Tech Stack");
  lines.push("");
  lines.push("- **React 19** with TypeScript");
  lines.push("- **Vite** for development and bundling");
  lines.push("- **Tailwind CSS** for styling");
  lines.push("");
  lines.push("## Components");
  lines.push("");
  for (const comp of result.components) {
    lines.push(`- **${comp.name}** (${comp.type}) — ${comp.description}`);
  }
  lines.push("");
  lines.push("## Getting Started");
  lines.push("");
  lines.push("```bash");
  lines.push("bun install");
  lines.push("bun run dev");
  lines.push("```");
  lines.push("");
  lines.push("The dev server runs at http://localhost:5173");
  return lines.join("\n");
}

function buildDashboardReadme(result: GenerationResult): string {
  const lines: string[] = [];
  const summary = result.dashboardProject?.summary;
  lines.push("# Dashboard — Admin Analytics Dashboard");
  lines.push("");
  lines.push("This admin dashboard was generated by Genesis Platform based on your business requirements.");
  lines.push("");
  lines.push("## Features");
  lines.push("");
  if (summary) {
    lines.push(`- **${summary.kpiCount} KPI cards** — Auto-generated metrics based on entity types`);
    lines.push(`- **${summary.chartCount} charts** — Bar chart, line chart, and donut chart using Recharts`);
  }
  lines.push("- **Recent Activity table** — Latest records from the primary entity");
  lines.push("- **Quick Actions** — Common operations (Add New, Export, Generate Report, Search)");
  lines.push("");
  lines.push("## Tech Stack");
  lines.push("");
  lines.push("- **React** with TypeScript");
  lines.push("- **Recharts** for data visualization");
  lines.push("- **Tailwind CSS** (dark theme)");
  lines.push("");
  lines.push("## Usage");
  lines.push("");
  lines.push("Copy `Dashboard.tsx` into your frontend project's `src/components/` directory.");
  lines.push("");
  lines.push("Make sure your project has `recharts` installed:");
  lines.push("");
  lines.push("```bash");
  lines.push("npm install recharts");
  lines.push("```");
  lines.push("");
  lines.push("Then import and use the component:");
  lines.push("");
  lines.push("```tsx");
  lines.push("import Dashboard from './components/Dashboard';");
  lines.push("```");
  lines.push("");
  lines.push("## Data Integration");
  lines.push("");
  lines.push("The dashboard uses mock data by default. To connect real data:");
  lines.push("1. Replace mock data arrays with API calls to your backend");
  lines.push("2. Wire up KPI values to real database queries");
  lines.push("3. Update chart data from your analytics endpoints");
  lines.push("");
  lines.push("*Generated by [Genesis Platform](https://genesis-platform.com) — Autonomous Software Generation*");
  return lines.join("\n");
}

function buildDeployReadme(result: GenerationResult): string {
  const lines: string[] = [];
  lines.push("# Deploy — Production Deployment Configuration");
  lines.push("");
  lines.push("This deployment configuration was generated by Genesis Platform based on your business requirements.");
  lines.push("");
  lines.push("## Files");
  lines.push("");
  lines.push("| File | Description |");
  lines.push("|------|-------------|");
  lines.push("| `Dockerfile` | Multi-stage Bun production image (backend) |");
  lines.push("| `Dockerfile.frontend` | Vite/React build → nginx serving (frontend) |");
  lines.push("| `docker-compose.prod.yml` | Full-stack orchestration: backend, frontend, PostgreSQL |");
  lines.push("| `fly.toml` | Fly.io deployment configuration |");
  lines.push("| `.github/workflows/deploy.yml` | GitHub Actions CI/CD pipeline |");
  lines.push("| `deploy.sh` | Shell script to build, migrate, and deploy |");
  lines.push("");
  lines.push("## Quick Deploy");
  lines.push("");
  lines.push("### Using Docker Compose");
  lines.push("```bash");
  lines.push("chmod +x deploy.sh");
  lines.push("./deploy.sh deploy");
  lines.push("```");
  lines.push("");
  lines.push("### Using Fly.io");
  lines.push("```bash");
  lines.push("# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/");
  lines.push("flyctl launch --config fly.toml");
  lines.push("flyctl deploy");
  lines.push("```");
  lines.push("");
  lines.push("### Using GitHub Actions");
  lines.push("1. Add these secrets to your GitHub repository:");
  lines.push("   - `FLY_API_TOKEN`: Fly.io deployment token");
  lines.push("2. Push to `main` branch to trigger automatic CI/CD");
  lines.push("");
  lines.push("*Generated by [Genesis Platform](https://genesis-platform.com) — Autonomous Software Generation*");
  return lines.join("\n");
}

function buildWorkflowsReadme(result: GenerationResult): string {
  const wp = result.workflowProject;
  if (!wp) return "# Workflows\n\nNo workflows generated.\n";

  const lines: string[] = [];
  lines.push("# Workflows — Business Process Automation");
  lines.push("");
  lines.push("Generated by Genesis Platform based on your business requirements.");
  lines.push("");

  if (wp.stateMachines.length > 0) {
    lines.push("## State Machines");
    lines.push("");
    lines.push("| Entity | States |");
    lines.push("|--------|--------|");
    for (const sm of wp.stateMachines) {
      lines.push(`| ${sm.entity} | ${sm.states.join(" → ")} |`);
    }
    lines.push("");
    lines.push(`Files are in \`state-machines/\` — each includes the Mermaid diagram and TypeScript code.`);
    lines.push("");
  }

  if (wp.approvalFlows.length > 0) {
    lines.push("## Approval Flows");
    lines.push("");
    for (const af of wp.approvalFlows) {
      lines.push(`- **${af.name}**: ${af.steps.join(" → ")}`);
    }
    lines.push("");
    lines.push(`Files are in \`approval-flows/\`.`);
    lines.push("");
  }

  if (wp.processFlows.length > 0) {
    lines.push("## Process Flows");
    lines.push("");
    for (const pf of wp.processFlows) {
      lines.push(`- **${pf.name}**: ${pf.description}`);
    }
    lines.push("");
    lines.push(`Files are in \`process-flows/\`.`);
    lines.push("");
  }

  lines.push("## Workflow Engine");
  lines.push("");
  lines.push("A reusable TypeScript workflow engine (`workflow-engine.ts`) that supports:");
  lines.push("- Sequential and conditional step execution with retry logic");
  lines.push("- State machine transitions with guard conditions");
  lines.push("- Approval chain routing with amount-based escalations");
  lines.push("- Webhook integration for API-driven workflow triggers");
  lines.push("- Timeout handling and error recovery");
  lines.push("");
  lines.push("## Integration");
  lines.push("");
  lines.push("```typescript");
  lines.push("import { executeWorkflow } from './workflows/workflow-engine';");
  lines.push("import { BookingTransitions, executeBookingTransition } from './workflows/state-machines/booking';");
  lines.push("import { InvoiceApprovalSteps } from './workflows/approval-flows/invoice-approval';");
  lines.push("```");
  lines.push("");
  lines.push("*Generated by [Genesis Platform](https://genesis-platform.com) — Autonomous Software Generation*");
  return lines.join("\n");
}

function buildReportsReadme(result: GenerationResult): string {
  const rp = result.reportProject;
  if (!rp) return "# Reports\n\nNo reports generated.\n";

  const lines: string[] = [];
  lines.push("# Reports — Templates, Analytics & Scheduling");
  lines.push("");
  lines.push("Generated by Genesis Platform based on your business requirements.");
  lines.push("");

  const summaryReports = rp.reports.filter((r) => r.type === "summary");
  const detailReports = rp.reports.filter((r) => r.type === "detail");
  const dashboardReports = rp.reports.filter((r) => r.type === "dashboard");

  if (summaryReports.length > 0) {
    lines.push("## Summary Reports");
    lines.push("");
    lines.push("| Report | Entity | Description |");
    lines.push("|--------|--------|-------------|");
    for (const r of summaryReports) {
      lines.push(`| ${r.name} | ${r.entity} | Aggregation: COUNT, SUM, AVG, MIN, MAX with GROUP BY |`);
    }
    lines.push("");
    lines.push(`Files are in \`summary/\` — each is a self-contained TypeScript module with SQL, CSV export, JSON formatting, and PDF stub.`);
    lines.push("");
  }

  if (detailReports.length > 0) {
    lines.push("## Detail Reports");
    lines.push("");
    lines.push("| Report | Entity | Description |");
    lines.push("|--------|--------|-------------|");
    for (const r of detailReports) {
      lines.push(`| ${r.name} | ${r.entity} | Full table export with date-filtering and pagination |`);
    }
    lines.push("");
    lines.push(`Files are in \`detail/\`.`);
    lines.push("");
  }

  if (dashboardReports.length > 0) {
    lines.push("## Cross-Entity Dashboard Reports");
    lines.push("");
    lines.push("| Report | Description |");
    lines.push("|--------|-------------|");
    for (const r of dashboardReports) {
      lines.push(`| ${r.name} | Combined KPIs from all entities in a single query |`);
    }
    lines.push("");
    lines.push(`Files are in \`dashboard/\`.`);
    lines.push("");
  }

  lines.push("## Report Runner");
  lines.push("");
  lines.push("`report-runner.ts` provides:");
  lines.push("- `runReport(db, reportName)` — Run a single report");
  lines.push("- `runAllReports(db)` — Execute all registered reports");
  lines.push("- `runScheduled(db, schedule)` — Run reports due for daily/weekly/monthly");
  lines.push("- `getReportsDue(schedule)` — List reports that should run now");
  lines.push("");

  lines.push("## Scheduled Reports");
  lines.push("");
  lines.push("`scheduled-reports.json` defines report scheduling:");
  if (rp.scheduledConfig.length > 0) {
    lines.push("");
    lines.push("| Name | Entity | Schedule | Format | Recipients |");
    lines.push("|------|--------|----------|--------|------------|");
    for (const sc of rp.scheduledConfig) {
      lines.push(`| ${sc.name} | ${sc.entity} | ${sc.schedule} | ${sc.format} | ${sc.recipients.join(", ")} |`);
    }
  }
  lines.push("");

  lines.push("## Export Formats");
  lines.push("");
  lines.push("Every report module supports:");
  lines.push("- **SQL** — Raw query for direct database execution");
  lines.push("- **CSV** — `toCSV(result)` for spreadsheet export");
  lines.push("- **JSON** — `toJSON(result)` for API responses");
  lines.push("- **HTML/PDF** — `toHTML(result)` stub for html-to-pdf rendering");
  lines.push("");

  lines.push("## Integration");
  lines.push("");
  lines.push("```typescript");
  lines.push("import { runAllReports, runReport } from './reports/report-runner';");
  lines.push("");
  lines.push("// Run a single report");
  lines.push("const summary = await runReport(db, 'User Summary');");
  lines.push("console.log(summary.csv); // CSV export");
  lines.push("");
  lines.push("// Run all reports");
  lines.push("const all = await runAllReports(db);");
  lines.push("```");
  lines.push("");
  lines.push("*Generated by [Genesis Platform](https://genesis-platform.com) — Autonomous Software Generation*");
  return lines.join("\n");
}
