/**
 * Report Generator
 *
 * Takes entities, endpoints, and SQL from a GenerationResult and produces:
 *   - Summary reports with aggregation queries (COUNT, SUM, AVG, GROUP BY)
 *   - Detail reports with full table exports
 *   - Cross-entity dashboard report combining KPIs
 *   - Scheduled report configurations
 *   - A reusable report runner
 *
 * Output is rendered as TypeScript modules with SQL queries, CSV exports, and JSON formatting.
 */

import type { GeneratedEntity, GeneratedEndpoint, Relationship } from "./generate";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ReportDef {
  name: string;
  entity: string;
  type: "summary" | "detail" | "dashboard";
  sql: string;
  tsCode: string;
}

export interface ScheduledReportConfig {
  name: string;
  entity: string;
  schedule: "daily" | "weekly" | "monthly";
  recipients: string[];
  format: "csv" | "json" | "pdf";
  description: string;
}

export interface ReportProject {
  reports: ReportDef[];
  scheduledConfig: ScheduledReportConfig[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toPascalCase(text: string): string {
  return text
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^./, (s) => s.toUpperCase());
}

function tableName(entity: string): string {
  return slugify(entity).replace(/-/g, "_") + "s";
}

/** Guess which field might be a numeric/metric field */
function findNumericFields(fields: GeneratedEntity["fields"]): GeneratedEntity["fields"][number][] {
  const numericTypes = ["integer", "decimal", "float", "number", "bigint", "smallint", "real", "double"];
  return fields.filter(
    (f) => numericTypes.includes(f.type.toLowerCase()) || f.name.match(/amount|price|total|cost|revenue|fee|salary|budget|quantity|qty|count|rate|score|rating|value|balance|profit|loss|tax|discount|commission/i)
  );
}

/** Guess which field might be a date field */
function findDateFields(fields: GeneratedEntity["fields"]): GeneratedEntity["fields"][number][] {
  const dateTypes = ["date", "datetime", "timestamp", "timestamptz"];
  return fields.filter(
    (f) =>
      dateTypes.includes(f.type.toLowerCase()) ||
      f.name.match(/date|time|created|updated|deleted|started|ended|expired|due|scheduled/i)
  );
}

/** Guess which field might be categorical (for GROUP BY) */
function findCategoryFields(fields: GeneratedEntity["fields"]): GeneratedEntity["fields"][number][] {
  return fields.filter(
    (f) =>
      f.type === "enum" ||
      f.type === "boolean" ||
      f.name.match(/status|type|category|role|priority|level|state|kind|gender|stage|phase/i)
  );
}

/** Guess a "name" or display field */
function findDisplayField(entity: GeneratedEntity): string {
  const nameFields = entity.fields.filter((f) =>
    f.name.match(/^name$|^title$|^label$|^display/i)
  );
  if (nameFields.length > 0) return nameFields[0].name;
  // fall back to first string field that isn't id
  const strField = entity.fields.find(
    (f) => f.type === "string" && f.name !== "id"
  );
  return strField ? strField.name : entity.fields[1]?.name || "id";
}

// ── SQL Query Builders ─────────────────────────────────────────────────────────

function buildSummarySQL(entity: GeneratedEntity, categoryField: GeneratedEntity["fields"] | null): string {
  const tbl = tableName(entity.name);
  const numericFields = findNumericFields(entity.fields);
  const dateFields = findDateFields(entity.fields);
  const countExpr = `COUNT(*) AS total_count`;

  const aggExprs: string[] = [];
  for (const nf of numericFields.slice(0, 3)) {
    aggExprs.push(`SUM(${nf.name}) AS total_${nf.name}`);
    aggExprs.push(`AVG(${nf.name}) AS avg_${nf.name}`);
    aggExprs.push(`MIN(${nf.name}) AS min_${nf.name}`);
    aggExprs.push(`MAX(${nf.name}) AS max_${nf.name}`);
  }

  const groupClause = categoryField ? `GROUP BY ${categoryField.name}\nORDER BY ${categoryField.name}` : "";

  const selectCols = categoryField
    ? [categoryField.name, countExpr, ...aggExprs.slice(0, 8)]
    : [countExpr, ...aggExprs.slice(0, 8)];

  // Recent period filter if date field exists
  let whereClause = "";
  if (dateFields.length > 0) {
    const df = dateFields[0];
    whereClause = `WHERE ${df.name} >= NOW() - INTERVAL '30 days'\n`;
  }

  return `SELECT\n  ${selectCols.join(",\n  ")}\nFROM ${tbl}\n${whereClause}${groupClause};`;
}

function buildDetailSQL(entity: GeneratedEntity): string {
  const tbl = tableName(entity.name);
  const cols = entity.fields.map((f) => f.name).join(",\n  ");
  const dateFields = findDateFields(entity.fields);
  let whereClause = "";
  if (dateFields.length > 0) {
    const df = dateFields[0];
    whereClause = `WHERE ${df.name} >= $1\n`;
  }

  return `SELECT\n  ${cols}\nFROM ${tbl}\n${whereClause}ORDER BY ${entity.fields[0].name}\nLIMIT $2 OFFSET $3;`;
}

function buildDashboardSQL(entities: GeneratedEntity[]): string {
  // Generate CTEs with key metrics from each entity, then join them
  const ctes: string[] = [];
  for (const entity of entities) {
    const tbl = tableName(entity.name);
    const numericFields = findNumericFields(entity.fields);
    const metrics: string[] = [`COUNT(*) AS ${tbl}_count`];
    for (const nf of numericFields.slice(0, 2)) {
      metrics.push(`COALESCE(SUM(${nf.name}), 0) AS ${tbl}_total_${nf.name}`);
      metrics.push(`COALESCE(AVG(${nf.name}), 0) AS ${tbl}_avg_${nf.name}`);
    }
    ctes.push(`${tbl}_metrics AS (\n  SELECT\n    ${metrics.join(",\n    ")}\n  FROM ${tbl}\n)`);
  }

  // Combine into a single dashboard row
  const selects = entities
    .map((e) => {
      const tbl = tableName(e.name);
      const numericFields = findNumericFields(e.fields);
      const parts = [`m${entities.indexOf(e)}.${tbl}_count`];
      for (const nf of numericFields.slice(0, 2)) {
        parts.push(`m${entities.indexOf(e)}.${tbl}_total_${nf.name}`);
        parts.push(`m${entities.indexOf(e)}.${tbl}_avg_${nf.name}`);
      }
      return parts.join(",\n    ");
    })
    .join(",\n    ");

  const joins = entities
    .map((e, i) => `CROSS JOIN ${tableName(e.name)}_metrics m${i}`)
    .join("\n  ");

  return `WITH\n  ${ctes.join(",\n  ")}\nSELECT\n  ${selects}\nFROM\n  ${joins}\n;`;
}

// ── TypeScript Code Generators ─────────────────────────────────────────────────

function buildSummaryTS(reportName: string, entity: GeneratedEntity, sql: string): string {
  const entityName = entity.name;
  const displayField = findDisplayField(entity);
  const numericFields = findNumericFields(entity.fields);
  const categoryField = findCategoryFields(entity.fields)[0];

  const metricTypes = numericFields
    .slice(0, 3)
    .flatMap((nf) => [
      `  total_${nf.name}: number;`,
      `  avg_${nf.name}: number;`,
      `  min_${nf.name}: number;`,
      `  max_${nf.name}: number;`,
    ])
    .join("\n");

  const catType = categoryField
    ? `  ${categoryField.name}: string;\n`
    : "";

  return `/**
 * ${reportName} — Summary Report for ${entityName}
 * Generated by Genesis Platform
 *
 * Provides aggregated metrics: counts, totals, averages, mins, maxes.
 * Grouped by ${categoryField ? categoryField.name : "N/A (overall)"}.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ${entityName}SummaryRow {
${catType}  total_count: number;
${metricTypes}
}

export interface ${entityName}SummaryResult {
  rows: ${entityName}SummaryRow[];
  generatedAt: string;
  sql: string;
}

// ── SQL Query ──────────────────────────────────────────────────────────────────

export const SQL = \`${sql}\`;

// ── Execute (database-agnostic interface) ──────────────────────────────────────

export async function execute(
  db: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }
): Promise<${entityName}SummaryResult> {
  const result = await db.query(SQL);
  return {
    rows: result.rows as ${entityName}SummaryRow[],
    generatedAt: new Date().toISOString(),
    sql: SQL,
  };
}

// ── CSV Export ─────────────────────────────────────────────────────────────────

export function toCSV(result: ${entityName}SummaryResult): string {
  if (result.rows.length === 0) return "";
  const headers = Object.keys(result.rows[0]).join(",");
  const rows = result.rows.map((row) =>
    Object.values(row)
      .map((v) => (typeof v === "string" ? \`"\${v.replace(/"/g, '""')}"\` : v))
      .join(",")
  );
  return [headers, ...rows].join("\\n");
}

// ── JSON Response ──────────────────────────────────────────────────────────────

export function toJSON(result: ${entityName}SummaryResult): string {
  return JSON.stringify(result, null, 2);
}

// ── PDF Stub (placeholder for html-to-pdf template) ────────────────────────────

export function toHTML(result: ${entityName}SummaryResult): string {
  const rows = result.rows
    .map(
      (row) =>
        \`<tr>\${Object.entries(row)
          .map(([k, v]) => \`<td>\${v}</td>\`)
          .join("")}</tr>\`
    )
    .join("\\n");
  return \`
<!DOCTYPE html>
<html>
<head><title>${reportName}</title></head>
<body>
  <h1>${reportName}</h1>
  <p>Generated: \${result.generatedAt}</p>
  <table border="1">
    <thead><tr>\${Object.keys(result.rows[0] || {}).map((k) => \`<th>\${k}</th>\`).join("")}</tr></thead>
    <tbody>\${rows}</tbody>
  </table>
</body>
</html>\`;
}
`;
}

function buildDetailTS(reportName: string, entity: GeneratedEntity, sql: string): string {
  const entityName = entity.name;
  const fields = entity.fields;

  const fieldTypes = fields
    .map((f) => {
      const tsType =
        f.type === "integer" || f.type === "bigint" || f.type === "smallint"
          ? "number"
          : f.type === "decimal" || f.type === "float" || f.type === "real" || f.type === "double"
            ? "number"
            : f.type === "boolean"
              ? "boolean"
              : f.type === "date" || f.type === "datetime" || f.type === "timestamp"
                ? "string"
                : f.type === "JSON"
                  ? "Record<string, unknown>"
                  : "string";
      return `  ${f.name}: ${tsType};`;
    })
    .join("\n");

  return `/**
 * ${reportName} — Detail Report for ${entityName}
 * Generated by Genesis Platform
 *
 * Full table export with filtering and pagination.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ${entityName}DetailRow {
${fieldTypes}
}

export interface ${entityName}DetailResult {
  rows: ${entityName}DetailRow[];
  total: number;
  page: number;
  pageSize: number;
  generatedAt: string;
  sql: string;
}

// ── SQL Query ──────────────────────────────────────────────────────────────────

export const SQL = \`${sql}\`;

// ── Execute (database-agnostic interface) ──────────────────────────────────────

export interface DetailParams {
  startDate?: string;   // $1 — filter on date field
  pageSize?: number;    // $2 — LIMIT (default 100)
  offset?: number;      // $3 — OFFSET (default 0)
}

export async function execute(
  db: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  params: DetailParams = {}
): Promise<${entityName}DetailResult> {
  const startDate = params.startDate || new Date(0).toISOString();
  const pageSize = params.pageSize || 100;
  const offset = params.offset || 0;
  const result = await db.query(SQL, [startDate, pageSize, offset]);
  return {
    rows: result.rows as ${entityName}DetailRow[],
    total: result.rows.length,
    page: Math.floor(offset / pageSize) + 1,
    pageSize,
    generatedAt: new Date().toISOString(),
    sql: SQL,
  };
}

// ── CSV Export ─────────────────────────────────────────────────────────────────

export function toCSV(result: ${entityName}DetailResult): string {
  if (result.rows.length === 0) return "";
  const headers = Object.keys(result.rows[0]).join(",");
  const rows = result.rows.map((row) =>
    Object.values(row)
      .map((v) => (typeof v === "string" ? \`"\${v.replace(/"/g, '""')}"\` : v))
      .join(",")
  );
  return [headers, ...rows].join("\\n");
}

// ── JSON Response ──────────────────────────────────────────────────────────────

export function toJSON(result: ${entityName}DetailResult): string {
  return JSON.stringify(result, null, 2);
}

// ── PDF Stub ───────────────────────────────────────────────────────────────────

export function toHTML(result: ${entityName}DetailResult): string {
  const headers = Object.keys(result.rows[0] || {}).map((k) => \`<th>\${k}</th>\`).join("");
  const rows = result.rows
    .map(
      (row) =>
        \`<tr>\${Object.values(row)
          .map((v) => \`<td>\${v}</td>\`)
          .join("")}</tr>\`
    )
    .join("\\n");
  return \`
<!DOCTYPE html>
<html>
<head><title>${reportName}</title></head>
<body>
  <h1>${reportName}</h1>
  <p>Page \${result.page} · \${result.pageSize} per page · Generated: \${result.generatedAt}</p>
  <table border="1">
    <thead><tr>\${headers}</tr></thead>
    <tbody>\${rows}</tbody>
  </table>
</body>
</html>\`;
}
`;
}

function buildDashboardTS(entityName: string, entities: GeneratedEntity[], sql: string): string {
  const metricDefs = entities
    .map((e) => {
      const tbl = tableName(e.name);
      const numericFields = findNumericFields(e.fields);
      const metricLines = [`    ${tbl}_count: number;`];
      for (const nf of numericFields.slice(0, 2)) {
        metricLines.push(`    ${tbl}_total_${nf.name}: number;`);
        metricLines.push(`    ${tbl}_avg_${nf.name}: number;`);
      }
      return metricLines.join("\n");
    })
    .join("\n");

  return `/**
 * ${entityName} Dashboard — Cross-Entity KPI Report
 * Generated by Genesis Platform
 *
 * Combines key performance indicators from all entities into one view.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DashboardMetrics {
${metricDefs}
}

export interface DashboardResult {
  metrics: DashboardMetrics;
  generatedAt: string;
  sql: string;
}

// ── SQL Query ──────────────────────────────────────────────────────────────────

export const SQL = \`${sql}\`;

// ── Execute ────────────────────────────────────────────────────────────────────

export async function execute(
  db: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }
): Promise<DashboardResult> {
  const result = await db.query(SQL);
  return {
    metrics: result.rows[0] as DashboardMetrics,
    generatedAt: new Date().toISOString(),
    sql: SQL,
  };
}

// ── CSV Export ─────────────────────────────────────────────────────────────────

export function toCSV(result: DashboardResult): string {
  const metrics = result.metrics;
  return Object.entries(metrics)
    .map(([k, v]) => \`"\${k}",\${v}\`)
    .join("\\n");
}

// ── JSON Response ──────────────────────────────────────────────────────────────

export function toJSON(result: DashboardResult): string {
  return JSON.stringify(result, null, 2);
}

// ── PDF Stub ───────────────────────────────────────────────────────────────────

export function toHTML(result: DashboardResult): string {
  const metrics = result.metrics;
  const rows = Object.entries(metrics)
    .map(([k, v]) => \`<tr><td>\${k}</td><td>\${v}</td></tr>\`)
    .join("\\n");
  return \`
<!DOCTYPE html>
<html>
<head><title>${entityName} Dashboard</title></head>
<body>
  <h1>${entityName} — Cross-Entity KPI Dashboard</h1>
  <p>Generated: \${result.generatedAt}</p>
  <table border="1">
    <thead><tr><th>Metric</th><th>Value</th></tr></thead>
    <tbody>\${rows}</tbody>
  </table>
</body>
</html>\`;
}
`;
}

// ── Scheduled Reports Config ───────────────────────────────────────────────────

function buildScheduledConfig(entities: GeneratedEntity[]): ScheduledReportConfig[] {
  const configs: ScheduledReportConfig[] = [];

  for (const entity of entities) {
    const displayField = findDisplayField(entity);
    configs.push({
      name: `${entity.name} Daily Summary`,
      entity: entity.name,
      schedule: "daily",
      recipients: ["admin@example.com"],
      format: "csv",
      description: `Daily ${entity.name} summary with counts and metric totals.`,
    });
    configs.push({
      name: `${entity.name} Weekly Detail Export`,
      entity: entity.name,
      schedule: "weekly",
      recipients: ["reports@example.com"],
      format: "csv",
      description: `Full ${entity.name} data export delivered every Monday.`,
    });
  }

  // Monthly cross-entity dashboard
  configs.push({
    name: `Monthly KPI Dashboard`,
    entity: "All",
    schedule: "monthly",
    recipients: ["executive@example.com"],
    format: "pdf",
    description: `Cross-entity KPI dashboard combining metrics from all modules.`,
  });

  return configs;
}

// ── Report Runner ──────────────────────────────────────────────────────────────

function buildReportRunner(reports: ReportDef[], scheduledConfig: ScheduledReportConfig[]): string {
  const reportRegistry = reports
    .map((r) => {
      const safeName = toPascalCase(r.name.replace(/[^a-z0-9]/gi, " ").trim());
      return `  ${JSON.stringify(r.name)}: {
    entity: "${r.entity}",
    type: "${r.type}",
    module: "./reports/${slugify(r.name)}",
  },`;
    })
    .join("\n");

  const scheduleLines = scheduledConfig
    .map((sc) => {
      return `  ${JSON.stringify(sc.name)}: {
    entity: "${sc.entity}",
    schedule: "${sc.schedule}",
    recipients: ${JSON.stringify(sc.recipients)},
    format: "${sc.format}",
    description: "${sc.description}",
  },`;
    })
    .join("\n");

  return `/**
 * Report Runner — Execute and schedule all generated reports
 * Generated by Genesis Platform
 *
 * Usage:
 *   import { runAllReports, runReport, runScheduled } from "./report-runner";
 *
 *   // Run a single report
 *   const result = await runReport(db, "User Summary");
 *
 *   // Run all reports
 *   const all = await runAllReports(db);
 *
 *   // Run reports due for scheduling
 *   await runScheduled(db);
 */

// ── Report Registry ────────────────────────────────────────────────────────────

export interface ReportInfo {
  entity: string;
  type: "summary" | "detail" | "dashboard";
  module: string;
}

export const reportRegistry: Record<string, ReportInfo> = {
${reportRegistry}
};

// ── Scheduled Report Config ────────────────────────────────────────────────────

export interface ScheduledReport {
  entity: string;
  schedule: "daily" | "weekly" | "monthly";
  recipients: string[];
  format: "csv" | "json" | "pdf";
  description: string;
}

export const scheduledReports: Record<string, ScheduledReport> = {
${scheduleLines}
};

// ── Runner ─────────────────────────────────────────────────────────────────────

export interface ReportResult {
  reportName: string;
  data: unknown;
  csv?: string;
  json?: string;
  error?: string;
  durationMs: number;
}

export async function runReport(
  db: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  reportName: string
): Promise<ReportResult> {
  const info = reportRegistry[reportName];
  if (!info) {
    return { reportName, data: null, error: \`Unknown report: \${reportName}\`, durationMs: 0 };
  }

  const start = Date.now();
  try {
    const mod = await import(info.module);
    const result = await mod.execute(db);

    return {
      reportName,
      data: result,
      csv: typeof mod.toCSV === "function" ? mod.toCSV(result) : undefined,
      json: typeof mod.toJSON === "function" ? mod.toJSON(result) : undefined,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      reportName,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

export async function runAllReports(
  db: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }
): Promise<ReportResult[]> {
  const results: ReportResult[] = [];
  for (const reportName of Object.keys(reportRegistry)) {
    results.push(await runReport(db, reportName));
  }
  return results;
}

export function getScheduledReports(): Array<{ name: string } & ScheduledReport> {
  return Object.entries(scheduledReports).map(([name, config]) => ({
    name,
    ...config,
  }));
}

export function getReportsDue(schedule: "daily" | "weekly" | "monthly"): string[] {
  return Object.entries(scheduledReports)
    .filter(([, config]) => config.schedule === schedule)
    .map(([name]) => name);
}

export async function runScheduled(
  db: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  schedule: "daily" | "weekly" | "monthly" = "daily"
): Promise<ReportResult[]> {
  const reportNames = getReportsDue(schedule);
  const results: ReportResult[] = [];
  for (const name of reportNames) {
    results.push(await runReport(db, name));
  }
  return results;
}
`;
}

// ── Main Generator ─────────────────────────────────────────────────────────────

export function generateReports(
  entities: GeneratedEntity[],
  _endpoints: GeneratedEndpoint[],
  _sql: string
): ReportProject {
  const reports: ReportDef[] = [];

  // ── Summary Reports ──
  for (const entity of entities) {
    const categoryField = findCategoryFields(entity.fields)[0] || null;
    const sql = buildSummarySQL(entity, categoryField);
    const name = `${entity.name} Summary`;
    reports.push({
      name,
      entity: entity.name,
      type: "summary",
      sql,
      tsCode: buildSummaryTS(name, entity, sql),
    });
  }

  // ── Detail Reports ──
  for (const entity of entities) {
    const sql = buildDetailSQL(entity);
    const name = `${entity.name} Detail`;
    reports.push({
      name,
      entity: entity.name,
      type: "detail",
      sql,
      tsCode: buildDetailTS(name, entity, sql),
    });
  }

  // ── Cross-Entity Dashboard ──
  if (entities.length > 0) {
    const sql = buildDashboardSQL(entities);
    const name = "Cross-Entity KPI Dashboard";
    reports.push({
      name,
      entity: "All",
      type: "dashboard",
      sql,
      tsCode: buildDashboardTS("CrossEntityDashboard", entities, sql),
    });
  }

  const scheduledConfig = buildScheduledConfig(entities);

  return { reports, scheduledConfig };
}

// ── Report Runner (exported for zip) ────────────────────────────────────────────

export function buildReportRunnerCode(reportProject: ReportProject): string {
  return buildReportRunner(reportProject.reports, reportProject.scheduledConfig);
}

// ── Scheduled Config JSON ──────────────────────────────────────────────────────

export function buildScheduledConfigJSON(reportProject: ReportProject): string {
  return JSON.stringify(
    {
      scheduledReports: reportProject.scheduledConfig,
      generatedAt: new Date().toISOString(),
      generatedBy: "Genesis Platform",
    },
    null,
    2
  );
}
