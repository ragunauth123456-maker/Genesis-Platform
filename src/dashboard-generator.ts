/**
 * Dashboard Generator
 * Takes entities, endpoints, and relationships and produces a complete,
 * self-contained React Dashboard.tsx component using Recharts.
 *
 * The generated component includes:
 * - KPI cards row (4-6 cards derived from entity types)
 * - Bar chart (entity counts by status/category)
 * - Line chart (trend over time)
 * - Pie/Donut chart (distribution by categorical field)
 * - Recent Activity table
 * - Quick Actions
 */

import type { GeneratedEntity, GeneratedEndpoint, Relationship } from "./generate";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DashboardProject {
  dashboardTsx: string;
  summary: {
    kpiCount: number;
    chartCount: number;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Pick an emoji for an entity based on its name */
function entityEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("booking") || lower.includes("reservation")) return "📅";
  if (lower.includes("guest") || lower.includes("customer") || lower.includes("client") || lower.includes("contact") || lower.includes("patient")) return "👤";
  if (lower.includes("room") || lower.includes("property") || lower.includes("house")) return "🏨";
  if (lower.includes("order") || lower.includes("purchase") || lower.includes("cart")) return "📦";
  if (lower.includes("product") || lower.includes("item") || lower.includes("menu")) return "🏷️";
  if (lower.includes("payment") || lower.includes("invoice") || lower.includes("bill")) return "💳";
  if (lower.includes("revenue") || lower.includes("sale") || lower.includes("deal")) return "💰";
  if (lower.includes("employee") || lower.includes("staff") || lower.includes("worker")) return "👷";
  if (lower.includes("task") || lower.includes("todo") || lower.includes("issue")) return "✅";
  if (lower.includes("shipment") || lower.includes("delivery") || lower.includes("fleet")) return "🚚";
  if (lower.includes("student") || lower.includes("course") || lower.includes("school") || lower.includes("education")) return "🎓";
  if (lower.includes("doctor") || lower.includes("medical") || lower.includes("health")) return "🏥";
  if (lower.includes("subscription") || lower.includes("plan")) return "🔄";
  if (lower.includes("appointment") || lower.includes("schedule")) return "📆";
  if (lower.includes("message") || lower.includes("chat") || lower.includes("notification")) return "💬";
  if (lower.includes("project") || lower.includes("task")) return "📋";
  if (lower.includes("review") || lower.includes("rating") || lower.includes("feedback")) return "⭐";
  if (lower.includes("report") || lower.includes("analytics")) return "📊";
  if (lower.includes("document") || lower.includes("file")) return "📄";
  return "🗂️";
}

/** KPI color palettes (gradient accents) */
const KPI_COLORS = [
  { from: "from-emerald-500", to: "to-teal-500", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  { from: "from-blue-500", to: "to-cyan-500", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
  { from: "from-amber-500", to: "to-orange-500", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  { from: "from-purple-500", to: "to-violet-500", bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30" },
  { from: "from-rose-500", to: "to-pink-500", bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/30" },
  { from: "from-sky-500", to: "to-indigo-500", bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/30" },
];

/** Chart color palette */
const CHART_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4",
  "#f97316", "#ec4899", "#14b8a6", "#6366f1",
];

/** Check if any entity has fields that look price/revenue-related */
function hasRevenueField(entities: GeneratedEntity[]): boolean {
  const revenueTerms = ["price", "amount", "total", "revenue", "cost", "fee", "value", "payment", "salary"];
  for (const e of entities) {
    for (const f of e.fields) {
      if (revenueTerms.some((term) => f.name.toLowerCase().includes(term))) {
        return true;
      }
    }
  }
  return false;
}

/** Find the best entity for revenue KPI */
function findRevenueEntity(entities: GeneratedEntity[]): GeneratedEntity | null {
  const revenueTerms = ["booking", "order", "invoice", "payment", "sale", "deal", "transaction"];
  for (const term of revenueTerms) {
    const match = entities.find((e) => e.name.toLowerCase().includes(term));
    if (match) return match;
  }
  // Fallback: first entity with price/amount field
  return entities.find((e) =>
    e.fields.some((f) => ["price", "amount", "total", "revenue", "cost", "value"].some((t) => f.name.toLowerCase().includes(t)))
  ) || null;
}

/** Find fields that look categorical (enum, status, type, category, stage) */
function findCategoryField(entity: GeneratedEntity): string | null {
  const catTerms = ["status", "type", "category", "stage", "priority", "department", "role", "plan"];
  for (const field of entity.fields) {
    for (const term of catTerms) {
      if (field.name.toLowerCase() === term || field.name.toLowerCase().includes(term)) {
        return field.name;
      }
    }
  }
  // Also check type for enum
  for (const field of entity.fields) {
    if (field.type.toLowerCase() === "enum" || field.type.toLowerCase().startsWith("enum")) {
      return field.name;
    }
  }
  return null;
}

/** Extract enum values from a field description */
function parseEnumValues(field: { description?: string }): string[] {
  if (!field.description) return [];
  // Try to parse comma-separated or space-separated enum values
  const desc = field.description;
  const parts = desc.split(/[,;]\s*/);
  if (parts.length >= 2 && parts.every((p) => p.length < 30)) {
    return parts.map((p) => p.trim()).filter(Boolean);
  }
  // Try space-separated single words
  const words = desc.split(/\s+/);
  if (words.length >= 3 && words.every((w) => w.length < 20 && /^[a-z-]+$/i.test(w))) {
    return words;
  }
  return [];
}

/** Infer category values for a field */
function inferCategoryValues(entity: GeneratedEntity, fieldName: string): string[] {
  const field = entity.fields.find((f) => f.name === fieldName);
  if (!field) return ["Active", "Inactive", "Pending"];

  const parsed = parseEnumValues(field);
  if (parsed.length >= 2) return parsed;

  // Common patterns
  if (fieldName === "status") return ["active", "inactive", "pending", "completed", "cancelled"];
  if (fieldName.includes("stage")) return ["lead", "qualified", "proposal", "negotiation", "closed"];
  if (fieldName === "priority") return ["low", "medium", "high", "urgent"];
  if (fieldName === "type" || fieldName.includes("type")) return ["standard", "premium", "enterprise"];
  if (fieldName === "category") return ["general", "specialized", "custom"];
  if (fieldName === "department") return ["Engineering", "Sales", "Marketing", "HR", "Finance"];

  return ["Option A", "Option B", "Option C", "Option D"];
}

function entitySingular(name: string): string {
  return name;
}

function entityPlural(name: string): string {
  if (name.endsWith("s") || name.endsWith("x") || name.endsWith("z") || name.endsWith("ch") || name.endsWith("sh")) {
    return name + "es";
  }
  if (/[^aeiou]y$/i.test(name)) {
    return name.slice(0, -1) + "ies";
  }
  return name + "s";
}

/** Generate realistic mock numeric data for a category */
function mockCategoryData(
  entity: GeneratedEntity,
  categories: string[]
): { name: string; value: number; fill: string }[] {
  return categories.map((cat, i) => ({
    name: cat.charAt(0).toUpperCase() + cat.slice(1),
    value: Math.floor(Math.random() * 80) + 10,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));
}

/** Generate daily trend data for the last 7-14 days */
function mockTrendData(
  primaryEntity: GeneratedEntity,
  daysBack: number = 14
): { date: string; count: number; amount?: number }[] {
  const data: { date: string; count: number; amount?: number }[] = [];
  const now = new Date();
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = d.toISOString().split("T")[0];
    data.push({
      date: dateStr,
      count: Math.floor(Math.random() * 30) + 5,
      ...(hasRevenueField([primaryEntity]) ? { amount: Math.floor(Math.random() * 5000) + 500 } : {}),
    });
  }
  return data;
}

/** Generate recent activity records */
function mockRecentRecords(
  entity: GeneratedEntity,
  count: number = 8
): { id: string; fields: Record<string, string | number>; date: string; status: string }[] {
  const records: { id: string; fields: Record<string, string | number>; date: string; status: string }[] = [];
  const displayFields = entity.fields
    .filter((f) => f.name !== "id" && !f.name.includes("Id"))
    .slice(0, 3);

  const statusField = entity.fields.find((f) => f.name === "status" || f.name.includes("status") || f.name === "stage");

  const statuses = statusField ? inferCategoryValues(entity, statusField.name) : ["Active", "Pending", "Completed"];
  const names = [
    "Alpha Corp", "Beta Ltd", "Gamma Inc", "Delta LLC", "Epsilon Co",
    "Zeta Group", "Eta Partners", "Theta Holdings", "Iota Systems", "Kappa Industries",
  ];

  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 14);
    const d = new Date(Date.now() - daysAgo * 86400000);
    const fields: Record<string, string | number> = {};
    for (const f of displayFields) {
      if (f.type === "string" || f.type === "text" || f.type === "enum") {
        fields[f.name] = names[i % names.length];
      } else if (f.type === "integer" || f.type === "number" || f.type === "decimal") {
        fields[f.name] = Math.floor(Math.random() * 1000) + 100;
      } else if (f.type === "boolean") {
        fields[f.name] = Math.random() > 0.5 ? "Yes" : "No";
      } else {
        fields[f.name] = `Sample ${f.name}`;
      }
    }
    records.push({
      id: `REC-${String(i + 1).padStart(4, "0")}`,
      fields,
      date: d.toISOString().split("T")[0],
      status: statuses[i % statuses.length],
    });
  }

  return records;
}

// ── JSX Generators ──────────────────────────────────────────────────────────

function generateImports(): string {
  return `import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from "recharts";`;
}

function generateKPICards(entities: GeneratedEntity[]): { jsx: string; count: number } {
  const cards: string[] = [];
  const primaryEntity = entities[0];
  if (!primaryEntity) return { jsx: "", count: 0 };

  const hasRevenue = hasRevenueField(entities);
  const revenueEntity = findRevenueEntity(entities);

  const kpiDefs: { label: string; value: string; icon: string; trend: number; colorIndex: number }[] = [];

  // 1. Total primary entity
  kpiDefs.push({
    label: `Total ${entityPlural(primaryEntity.name)}`,
    value: String(Math.floor(Math.random() * 800) + 200),
    icon: entityEmoji(primaryEntity.name),
    trend: +(Math.random() * 20 - 5).toFixed(1),
    colorIndex: 0,
  });

  // 2. Active / this week count
  kpiDefs.push({
    label: `Active ${entityPlural(primaryEntity.name)}`,
    value: String(Math.floor(Math.random() * 400) + 50),
    icon: "✅",
    trend: +(Math.random() * 15 + 2).toFixed(1),
    colorIndex: 1,
  });

  // 3. Revenue if applicable
  if (hasRevenue && revenueEntity) {
    kpiDefs.push({
      label: `Total Revenue`,
      value: `$${Math.floor(Math.random() * 90000 + 10000).toLocaleString()}`,
      icon: "💰",
      trend: +(Math.random() * 25 + 5).toFixed(1),
      colorIndex: 2,
    });
  }

  // 4. New this month
  kpiDefs.push({
    label: `New This Month`,
    value: String(Math.floor(Math.random() * 100) + 20),
    icon: "🆕",
    trend: +(Math.random() * 30 - 10).toFixed(1),
    colorIndex: 3,
  });

  // 5. Second entity count if available
  if (entities.length >= 2) {
    kpiDefs.push({
      label: `Total ${entityPlural(entities[1].name)}`,
      value: String(Math.floor(Math.random() * 500) + 100),
      icon: entityEmoji(entities[1].name),
      trend: +(Math.random() * 10 + 5).toFixed(1),
      colorIndex: 4,
    });
  }

  // 6. Pending/attention items if third entity
  if (entities.length >= 3) {
    kpiDefs.push({
      label: `Pending ${entityPlural(entities[2].name)}`,
      value: String(Math.floor(Math.random() * 50) + 5),
      icon: "⏳",
      trend: -(Math.random() * 10).toFixed(1),
      colorIndex: 5,
    });
  }

  for (const kpi of kpiDefs) {
    const c = KPI_COLORS[kpi.colorIndex % KPI_COLORS.length];
    const isUp = kpi.trend >= 0;
    cards.push(`          {/* ${kpi.label} */}
          <div className="rounded-2xl border ${c.border} bg-gradient-to-br ${c.from}/10 ${c.to}/10 p-5 backdrop-blur-sm transition-all hover:border-white/10 hover:shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">${kpi.icon}</span>
              <span className={\`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium \${
                ${isUp} ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
              }\`}>
                ${isUp ? "↑" : "↓"} ${Math.abs(kpi.trend)}%
              </span>
            </div>
            <div className="text-3xl font-bold text-white tracking-tight mb-1">${kpi.value}</div>
            <div className="text-sm text-surface-400">${kpi.label}</div>
          </div>`);
  }

  return { jsx: cards.join("\n"), count: kpiDefs.length };
}

function generateBarChart(
  entities: GeneratedEntity[],
  categoryField: string,
  categories: string[]
): string {
  const primaryEntity = entities[0];
  const dataEntries = mockCategoryData(primaryEntity, categories);
  const dataJson = JSON.stringify(dataEntries, null, 8).replace(/"([^"]+)":/g, "$1:");

  return `        {/* Bar Chart — ${primaryEntity.name} by ${categoryField} */}
        <div className="rounded-2xl border border-white/5 bg-surface-900/50 p-6 backdrop-blur-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">${primaryEntity.name} by ${categoryField.charAt(0).toUpperCase() + categoryField.slice(1)}</h3>
              <p className="text-sm text-surface-400 mt-0.5">Distribution across all ${categoryField} categories</p>
            </div>
            <span className="text-xs font-medium text-surface-500 bg-surface-800 rounded-lg px-3 py-1">This Month</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  color: "#e5e7eb",
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="url(#barGradient)" />
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>`;
}

function generateLineChart(primaryEntity: GeneratedEntity): string {
  const trendData = mockTrendData(primaryEntity, 14);
  const hasRevenue = hasRevenueField([primaryEntity]);
  const dataJsonEntries: string[] = [];
  for (const d of trendData) {
    if (hasRevenue) {
      dataJsonEntries.push(`  { date: "${d.date}", count: ${d.count}, amount: ${d.amount} }`);
    } else {
      dataJsonEntries.push(`  { date: "${d.date}", count: ${d.count} }`);
    }
  }

  return `        {/* Line Chart — ${primaryEntity.name} Trend */}
        <div className="rounded-2xl border border-white/5 bg-surface-900/50 p-6 backdrop-blur-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">${primaryEntity.name} Trend</h3>
              <p className="text-sm text-surface-400 mt-0.5">Daily ${primaryEntity.name.toLowerCase()} activity over the last 14 days</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-surface-400">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                Count
              </span>${hasRevenue ? `
              <span className="flex items-center gap-1.5 text-surface-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                Revenue
              </span>` : ""}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  color: "#e5e7eb",
                }}
              />
              <Line type="monotone" dataKey="count" stroke="#818cf8" strokeWidth={2.5} dot={{ fill: "#818cf8", r: 3 }} activeDot={{ r: 6 }} />${hasRevenue ? `
              <Line type="monotone" dataKey="amount" stroke="#34d399" strokeWidth={2.5} dot={{ fill: "#34d399", r: 3 }} activeDot={{ r: 6 }} />` : ""}
            </LineChart>
          </ResponsiveContainer>
        </div>`;
}

function generatePieChart(
  entities: GeneratedEntity[],
  categoryField: string,
  categories: string[]
): string {
  const primaryEntity = entities[0];
  const dataEntries = mockCategoryData(primaryEntity, categories);
  const colorsJson = JSON.stringify(dataEntries.map((d) => d.fill));

  return `        {/* Donut Chart — ${primaryEntity.name} Distribution */}
        <div className="rounded-2xl border border-white/5 bg-surface-900/50 p-6 backdrop-blur-sm">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white">${primaryEntity.name} Distribution</h3>
            <p className="text-sm text-surface-400 mt-0.5">By ${categoryField}</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={110}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((_entry, index) => (
                  <Cell key={\`cell-\${index}\`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  color: "#e5e7eb",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-surface-400">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                />
                {entry.name}: {entry.value}
              </div>
            ))}
          </div>
        </div>`;
}

function generateRecentActivity(primaryEntity: GeneratedEntity): string {
  const records = mockRecentRecords(primaryEntity, 8);
  const displayFields = primaryEntity.fields
    .filter((f) => f.name !== "id" && !f.name.includes("Id"))
    .slice(0, 3);

  const headerCells = displayFields.map((f) =>
    `<th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wider">${f.name}</th>`
  ).join("\n                ");

  const headerCells2 = [
    `<th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wider">ID</th>`,
  ].concat(displayFields.map((f) =>
    `<th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wider hidden sm:table-cell">${f.name}</th>`
  )).concat([
    `<th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wider">Status</th>`,
    `<th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wider hidden md:table-cell">Date</th>`,
  ]).join("\n                ");

  const rowJsx = records.map((rec, i) => {
    const fieldCells = displayFields.map((f) =>
      `<td className="px-4 py-2.5 text-sm text-surface-300 hidden sm:table-cell">${String(rec.fields[f.name] || "-")}</td>`
    ).join("\n                ");
    return `                <tr key={${i}} className="border-b border-white/[0.02] transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 text-sm font-mono text-surface-400">${rec.id}</td>
                  ${fieldCells}
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                      ${rec.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-surface-400 hidden md:table-cell">${rec.date}</td>
                </tr>`;
  }).join("\n");

  return `        {/* Recent Activity */}
        <div className="rounded-2xl border border-white/5 bg-surface-900/50 backdrop-blur-sm overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div>
              <h3 className="text-lg font-semibold text-white">Recent ${entityPlural(primaryEntity.name)}</h3>
              <p className="text-sm text-surface-400 mt-0.5">Latest ${primaryEntity.name.toLowerCase()} records</p>
            </div>
            <button className="text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors">
              View All →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-surface-900/70">
                  ${headerCells2}
                </tr>
              </thead>
              <tbody>
${rowJsx}
              </tbody>
            </table>
          </div>
        </div>`;
}

function generateQuickActions(entities: GeneratedEntity[]): string {
  const primaryName = entities[0]?.name || "Item";
  const secondName = entities[1]?.name || "Record";

  return `        {/* Quick Actions */}
        <div className="rounded-2xl border border-white/5 bg-surface-900/50 p-6 backdrop-blur-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
            <p className="text-sm text-surface-400 mt-0.5">Frequently used operations</p>
          </div>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 rounded-xl bg-brand-500 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-brand-400 hover:glow text-left">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-base">
                ＋
              </span>
              <div>
                <div className="font-semibold">Add New ${primaryName}</div>
                <div className="text-xs text-white/60">Create a new ${primaryName.toLowerCase()} record</div>
              </div>
              <span className="ml-auto text-white/40">→</span>
            </button>
            <button className="w-full flex items-center gap-3 rounded-xl border border-white/5 bg-surface-800 px-4 py-3 text-sm font-medium text-surface-200 transition-all hover:border-white/15 hover:bg-surface-700 text-left">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-700 text-base">
                📤
              </span>
              <div>
                <div className="font-semibold">Export ${entityPlural(primaryName)}</div>
                <div className="text-xs text-surface-500">Download as CSV or PDF</div>
              </div>
              <span className="ml-auto text-surface-600">→</span>
            </button>
            <button className="w-full flex items-center gap-3 rounded-xl border border-white/5 bg-surface-800 px-4 py-3 text-sm font-medium text-surface-200 transition-all hover:border-white/15 hover:bg-surface-700 text-left">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-700 text-base">
                📊
              </span>
              <div>
                <div className="font-semibold">Generate Report</div>
                <div className="text-xs text-surface-500">Monthly ${primaryName.toLowerCase()} analytics</div>
              </div>
              <span className="ml-auto text-surface-600">→</span>
            </button>${entities.length >= 2 ? `
            <button className="w-full flex items-center gap-3 rounded-xl border border-white/5 bg-surface-800 px-4 py-3 text-sm font-medium text-surface-200 transition-all hover:border-white/15 hover:bg-surface-700 text-left">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-700 text-base">
                🔍
              </span>
              <div>
                <div className="font-semibold">Search ${entityPlural(secondName)}</div>
                <div className="text-xs text-surface-500">Find ${secondName.toLowerCase()} records</div>
              </div>
              <span className="ml-auto text-surface-600">→</span>
            </button>` : ""}
          </div>
        </div>`;
}

// ── Mock Data Generator (as JS code strings) ─────────────────────────────────

function generateMockDataBlock(
  entities: GeneratedEntity[],
  primaryEntity: GeneratedEntity,
  categoryField: string,
  categories: string[]
): string {
  const barData = mockCategoryData(primaryEntity, categories);
  const pieData = mockCategoryData(primaryEntity, categories);
  const trendData = mockTrendData(primaryEntity, 14);
  const hasRevenue = hasRevenueField([primaryEntity]);

  const barDataJson = JSON.stringify(barData, null, 2)
    .replace(/"([^"]+)":/g, "$1:");
  const pieDataJson = JSON.stringify(pieData, null, 2)
    .replace(/"([^"]+)":/g, "$1:");
  const trendDataJson = JSON.stringify(trendData, null, 2)
    .replace(/"([^"]+)":/g, "$1:");

  const pieColorsJson = JSON.stringify(pieData.map((d) => d.fill), null, 2);

  return `// ── Mock Data ──────────────────────────────────────────────────────────────

const barData = ${barDataJson};

const pieData = ${pieDataJson};

const trendData = ${trendDataJson};

const PIE_COLORS = ${pieColorsJson};`;
}

// ── Main Generator ──────────────────────────────────────────────────────────

export function generateDashboard(
  entities: GeneratedEntity[],
  _endpoints: GeneratedEndpoint[],
  _relationships: Relationship[]
): DashboardProject {
  // Ensure we have at least some entities
  const safeEntities = entities.length > 0
    ? entities
    : [{
        name: "Record",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "name", type: "string", required: true },
          { name: "status", type: "enum", required: true, description: "active, inactive, pending, completed" },
          { name: "createdAt", type: "datetime", required: true },
        ],
      }];

  const primaryEntity = safeEntities[0];
  const categoryField = findCategoryField(primaryEntity) || "status";
  const categories = inferCategoryValues(primaryEntity, categoryField);

  const imports = generateImports();
  const kpiResult = generateKPICards(safeEntities);
  const barChart = generateBarChart(safeEntities, categoryField, categories);
  const lineChart = generateLineChart(primaryEntity);
  const pieChart = generatePieChart(safeEntities, categoryField, categories);
  const recentActivity = generateRecentActivity(primaryEntity);
  const quickActions = generateQuickActions(safeEntities);
  const mockDataBlock = generateMockDataBlock(safeEntities, primaryEntity, categoryField, categories);

  const domainName = safeEntities.length > 0 ? safeEntities[0].name : "Application";
  const domainLower = domainName.toLowerCase();

  const dashboardTsx = `${imports}

${mockDataBlock}

// ── Dashboard Component ─────────────────────────────────────────────────────

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">${domainName} Dashboard</h1>
          <p className="text-sm text-surface-400 mt-1">
            Overview of your ${domainLower} metrics and performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-surface-500 bg-surface-800 rounded-lg px-3 py-1.5">
            Last updated: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
${kpiResult.jsx}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
${barChart}

${lineChart}

${pieChart}
      </div>

      {/* Bottom Section: Recent Activity + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
${recentActivity}

${quickActions}
      </div>
    </div>
  );
}`;

  return {
    dashboardTsx,
    summary: {
      kpiCount: kpiResult.count,
      chartCount: 3, // bar + line + pie/donut
    },
  };
}
