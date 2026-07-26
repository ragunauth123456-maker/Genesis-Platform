/**
 * Frontend Project Generator
 * Takes entities, components, and endpoints from the generation engine and
 * produces real React + TypeScript + Tailwind component files.
 *
 * Component type → style mapping:
 *   - "layout"       → sidebar/dashboard shell with children slots
 *   - "data-display" → table or card grid with mock data
 *   - "form"         → controlled form with inputs and validation stubs
 *   - "detail"       → detail view card
 *   - "list"         → filterable list with search and pagination stubs
 *   - Other types    → inferred from description or default to data-display
 */

import type { GeneratedEntity, GeneratedEndpoint, GeneratedComponent } from "./generate";

// ── Types ──────────────────────────────────────────────────────────────────

export interface FrontendFile {
  /** Relative path from project root, e.g. "src/components/RoomGrid.tsx" */
  filename: string;
  content: string;
}

export interface FrontendProject {
  files: FrontendFile[];
  appTsx: string;
  indexTsx: string;
  indexHtml: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pascalCase(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

function camelCase(text: string): string {
  const p = pascalCase(text);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

function kebabCase(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .toLowerCase();
}

function pluralize(word: string): string {
  if (word.endsWith("s") || word.endsWith("x") || word.endsWith("z") || word.endsWith("ch") || word.endsWith("sh"))
    return word + "es";
  if (word.endsWith("y") && !/[aeiou]y$/i.test(word)) return word.slice(0, -1) + "ies";
  return word + "s";
}

function indent(code: string, level: number): string {
  const pad = "  ".repeat(level);
  return code
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}

// ── Mock data generators ───────────────────────────────────────────────────

interface MockFieldValue {
  [key: string]: string | number | boolean | string[] | null;
}

function valueForField(entity: GeneratedEntity, fieldName: string, type: string, index: number): string | number | boolean | string[] | null {
  const lowerName = fieldName.toLowerCase();
  const lowerType = type.toLowerCase();

  // id fields
  if (fieldName === "id" || lowerType === "uuid") {
    return `"${(10000000 + index * 1000).toString(16)}-${entity.name.toLowerCase().slice(0, 4)}-4${index}00-a${index}00-${String(index).padStart(12, "0")}"`;
  }

  // Common field names
  if (lowerName.includes("email")) return `"user${index + 1}@example.com"`;
  if (lowerName.includes("phone")) return `"+1-555-${String(100 + index).padStart(3, "0")}-${String(1000 + index).padStart(4, "0")}"`;
  if (lowerName === "firstname") return FIRST_NAMES[index % FIRST_NAMES.length];
  if (lowerName === "lastname") return LAST_NAMES[index % LAST_NAMES.length];
  if (lowerName.includes("name")) return `"${entity.name} ${index + 1}"`;
  if (lowerName.includes("description") || lowerName.includes("notes")) return `"Sample ${fieldName.replace(/([A-Z])/g, " $1").toLowerCase()} for ${entity.name.toLowerCase()} ${index + 1}"`;
  if (lowerName.includes("image") || lowerName.includes("avatar") || lowerName.includes("photo")) return `"https://picsum.photos/seed/${entity.name.toLowerCase()}${index}/400/300"`;
  if (lowerName === "createdat" || lowerName === "updatedat") return `"2026-0${(index % 9) + 1}-${String(10 + index).padStart(2, "0")}T${String(8 + index).padStart(2, "0")}:00:00Z"`;

  // Type-based values
  if (lowerType === "string" || lowerType === "text") {
    const domainWords = ["Premium", "Standard", "Deluxe", "Basic", "Enterprise", "Professional", "Starter", "Custom"];
    return `"${domainWords[index % domainWords.length]}"`;
  }
  if (lowerType === "integer" || lowerType === "number") return (index + 1) * 100;
  if (lowerType === "decimal" || lowerType === "float") return ((index + 1) * 99.99).toFixed(2);
  if (lowerType === "boolean") return index % 2 === 0 ? "true" : "false";
  if (lowerType === "date") return `"2026-0${(index % 9) + 1}-${String(10 + index).padStart(2, "0")}"`;
  if (lowerType === "datetime") return `"2026-0${(index % 9) + 1}-${String(10 + index).padStart(2, "0")}T10:00:00Z"`;
  if (lowerType.startsWith("string[]")) return `["Item ${index}A", "Item ${index}B", "Item ${index}C"]`;
  if (lowerType === "json") return `{ "key": "value-${index}", "score": ${index * 10} }`;

  // Enum types — pick a reasonable default
  if (lowerType === "enum") return `"option-${(index % 3) + 1}"`;

  return "null";
}

const FIRST_NAMES = [`"Alice"`, `"Bob"`, `"Carol"`, `"David"`, `"Eve"`, `"Frank"`, `"Grace"`, `"Hank"`];
const LAST_NAMES = [`"Johnson"`, `"Williams"`, `"Brown"`, `"Jones"`, `"Garcia"`, `"Miller"`, `"Davis"`, `"Rodriguez"`];

function generateMockData(entity: GeneratedEntity, count: number): string {
  const rows: string[] = [];
  for (let i = 0; i < count; i++) {
    const fields = entity.fields
      .map((f) => `    ${f.name}: ${valueForField(entity, f.name, f.type, i)}`)
      .join(",\n");
    rows.push(`  {\n${fields}\n  }`);
  }
  return `[\n${rows.join(",\n")}\n]`;
}

// ── Component type resolution ──────────────────────────────────────────────

type ComponentStyle = "layout" | "data-display" | "form" | "detail" | "list";

function resolveStyle(comp: GeneratedComponent): ComponentStyle {
  const t = comp.type;
  if (t === "layout") return "layout";
  if (t === "form") return "form";
  if (t === "detail") return "detail";
  if (t === "list") return "list";
  if (t === "data-display") return "data-display";

  // Infer from name/description for legacy types
  const lower = (comp.name + " " + comp.description).toLowerCase();
  if (lower.includes("form") || lower.includes("create") || lower.includes("edit")) return "form";
  if (lower.includes("detail") || lower.includes("view") || lower.includes("card")) return "detail";
  if (lower.includes("list") || lower.includes("table") || lower.includes("search")) return "list";
  if (lower.includes("layout") || lower.includes("dashboard") || lower.includes("shell")) return "layout";
  return "data-display";
}

// ── Component file generators ──────────────────────────────────────────────

function generateLayoutComponent(comp: GeneratedComponent, allComponents: GeneratedComponent[]): string {
  const childSlots = comp.children || [];
  const childNames = childSlots.map((c) => c.name);

  // Find sidebar and topbar children
  const sidebarChild = childSlots.find((c) => c.name.toLowerCase().includes("sidebar") || c.name.toLowerCase().includes("nav"));
  const topbarChild = childSlots.find((c) => c.name.toLowerCase().includes("topbar") || c.name.toLowerCase().includes("header") || c.name.toLowerCase().includes("bar"));

  // Import children used
  const imports = childNames
    .map((n) => `import { ${n} } from "./${n}";`)
    .join("\n");

  // Build children JSX
  const childrenJsx = childNames
    .filter((n) => n !== sidebarChild?.name && n !== topbarChild?.name)
    .map((n) => `          <${n} />`)
    .join("\n");

  return `import { useState } from "react";
${imports}

interface ${comp.name}Props {
  children?: React.ReactNode;
}

export function ${comp.name}({ children }: ${comp.name}Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-surface-950 text-surface-100">
      {/* Sidebar */}
      <aside
        className={\`\${
          sidebarOpen ? "w-64" : "w-16"
        } flex-shrink-0 border-r border-white/5 bg-surface-900/80 backdrop-blur transition-all duration-200\`}
      >
        ${sidebarChild ? `<${sidebarChild.name} collapsed={!sidebarOpen} />` : `{/* Navigation */}`}
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-white/5 bg-surface-900/50 px-6">
          ${topbarChild
            ? `<${topbarChild.name} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />`
            : `<button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-800 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>`
          }
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-surface-300">${comp.description.split(",")[0] || comp.name}</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
${childrenJsx || `          {children}`}
        </main>
      </div>
    </div>
  );
}`;
}

function generateDataDisplayComponent(comp: GeneratedComponent, entities: GeneratedEntity[], endpoints: GeneratedEndpoint[]): string {
  // Try to match component name to an entity
  const entityForComponent = findMatchingEntity(comp.name, entities);

  let body: string;
  if (entityForComponent) {
    const mockVar = camelCase(entityForComponent.name) + "sMock";
    const mockData = generateMockData(entityForComponent, 6);
    body = generateCardGrid(comp.name, entityForComponent, mockVar, mockData);
  } else {
    body = generateGenericCard(comp);
  }

  const imports = entityForComponent
    ? `import type { ${entityForComponent.name} } from "../types";\n`
    : "";

  return `${imports}
interface ${comp.name}Props {
  className?: string;
}

export function ${comp.name}({ className }: ${comp.name}Props) {
${indent(body, 1)}
}`;
}

function generateFormComponent(comp: GeneratedComponent, entities: GeneratedEntity[]): string {
  const entityForComponent = findMatchingEntity(comp.name, entities);
  const fields = entityForComponent?.fields.filter((f) => f.name !== "id") || [];
  const entityName = entityForComponent?.name || "Record";

  const formFields = fields
    .map((f) => {
      const fieldName = camelCase(f.name);
      const label = f.name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
      const isRequired = f.required;
      const lowerType = f.type.toLowerCase();

      if (lowerType === "boolean") {
        return `          {/* ${label} */}
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formData.${fieldName}}
              onChange={(e) => setFormData({ ...formData, ${fieldName}: e.target.checked })}
              className="h-4 w-4 rounded border-white/10 bg-surface-800 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-surface-300">
              ${label}${isRequired ? ' <span className="text-red-400">*</span>' : ""}
            </span>
          </label>`;
      }

      if (lowerType === "text" || lowerType.includes("description") || lowerType.includes("notes")) {
        return `          {/* ${label} */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-300">
              ${label}${isRequired ? ' <span className="text-red-400">*</span>' : ""}
            </label>
            <textarea
              value={formData.${fieldName}}
              onChange={(e) => setFormData({ ...formData, ${fieldName}: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-surface-800 px-3 py-2 text-sm text-surface-100 placeholder-surface-600 outline-none transition-all focus:border-brand-500/30 focus:ring-1 focus:ring-brand-500/20"
              placeholder="Enter ${label.toLowerCase()}..."
            />
          </div>`;
      }

      if (lowerType === "date" || lowerType === "datetime") {
        return `          {/* ${label} */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-300">
              ${label}${isRequired ? ' <span className="text-red-400">*</span>' : ""}
            </label>
            <input
              type="${lowerType === "datetime" ? "datetime-local" : "date"}"
              value={formData.${fieldName}}
              onChange={(e) => setFormData({ ...formData, ${fieldName}: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-surface-800 px-3 py-2 text-sm text-surface-100 outline-none transition-all focus:border-brand-500/30 focus:ring-1 focus:ring-brand-500/20"
            />
          </div>`;
      }

      if (lowerType === "integer" || lowerType === "decimal" || lowerType === "number" || lowerType === "float") {
        return `          {/* ${label} */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-300">
              ${label}${isRequired ? ' <span className="text-red-400">*</span>' : ""}
            </label>
            <input
              type="number"
              value={formData.${fieldName}}
              onChange={(e) => setFormData({ ...formData, ${fieldName}: ${lowerType === "integer" ? "parseInt(e.target.value) || 0" : "parseFloat(e.target.value) || 0"} })}
              className="w-full rounded-lg border border-white/10 bg-surface-800 px-3 py-2 text-sm text-surface-100 outline-none transition-all focus:border-brand-500/30 focus:ring-1 focus:ring-brand-500/20"
              placeholder="0"
            />
          </div>`;
      }

      // Default: text input
      return `          {/* ${label} */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-300">
              ${label}${isRequired ? ' <span className="text-red-400">*</span>' : ""}
            </label>
            <input
              type="text"
              value={formData.${fieldName}}
              onChange={(e) => setFormData({ ...formData, ${fieldName}: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-surface-800 px-3 py-2 text-sm text-surface-100 placeholder-surface-600 outline-none transition-all focus:border-brand-500/30 focus:ring-1 focus:ring-brand-500/20"
              placeholder="Enter ${label.toLowerCase()}..."
            />
          </div>`;
    })
    .join("\n\n");

  // Generate type interface for form data
  const typeFields = fields
    .map((f) => {
      const jsType = f.type.toLowerCase().includes("integer") || f.type.toLowerCase().includes("decimal") || f.type.toLowerCase().includes("number")
        ? "number"
        : f.type.toLowerCase() === "boolean"
          ? "boolean"
          : "string";
      return `  ${camelCase(f.name)}: ${jsType};`;
    })
    .join("\n");

  return `import { useState, type FormEvent } from "react";

interface ${entityName}FormData {
${typeFields}
}

interface ${comp.name}Props {
  initialData?: Partial<${entityName}FormData>;
  onSubmit?: (data: ${entityName}FormData) => void;
  isLoading?: boolean;
}

const defaultFormData: ${entityName}FormData = {
${fields.map((f) => {
  const jsType = f.type.toLowerCase().includes("integer") || f.type.toLowerCase().includes("decimal") || f.type.toLowerCase().includes("number")
    ? "0"
    : f.type.toLowerCase() === "boolean"
      ? "false"
      : '""';
  return `  ${camelCase(f.name)}: ${jsType},`;
}).join("\n")}
};

export function ${comp.name}({
  initialData,
  onSubmit,
  isLoading = false,
}: ${comp.name}Props) {
  const [formData, setFormData] = useState<${entityName}FormData>({
    ...defaultFormData,
    ...initialData,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ${entityName}FormData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ${entityName}FormData, string>> = {};
${fields
  .filter((f) => f.required)
  .map((f) => `    if (!formData.${camelCase(f.name)}${f.type.toLowerCase() === "boolean" ? " && formData." + camelCase(f.name) + " !== false" : " && formData." + camelCase(f.name) + " !== 0"}) newErrors.${camelCase(f.name)} = "${f.name.replace(/([A-Z])/g, " $1").trim()} is required";`)
  .join("\n")}
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validate() && onSubmit) {
      onSubmit(formData);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/5 bg-surface-900/50 p-6"
    >
      <h2 className="mb-5 text-lg font-semibold text-surface-200">
        ${comp.description || `${entityName} Form`}
      </h2>

      <div className="space-y-4">
${formFields}
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/10 px-6 py-2.5 text-sm font-medium text-surface-300 transition-all hover:border-white/20 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}`;
}

function generateDetailComponent(comp: GeneratedComponent, entities: GeneratedEntity[]): string {
  const entityForComponent = findMatchingEntity(comp.name, entities);
  const entityName = entityForComponent?.name || "Record";
  const fields = entityForComponent?.fields || [];

  const fieldRows = fields
    .map((f) => {
      const label = f.name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
      const fieldKey = camelCase(f.name);
      return `          <div className="flex items-center justify-between border-b border-white/5 py-3 last:border-0">
            <span className="text-sm text-surface-400">${label}</span>
            <span className="text-sm font-medium text-surface-200">{data.${fieldKey}}</span>
          </div>`;
    })
    .join("\n");

  return `interface ${entityName}DetailProps {
  data: Record<string, string | number | boolean | null>;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ${comp.name}({ data, onEdit, onDelete }: ${entityName}DetailProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/5 bg-surface-900/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <h2 className="text-lg font-semibold text-surface-200">
          ${comp.description || entityName + " Detail"}
        </h2>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:border-white/20 hover:text-white"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:border-red-500/40 hover:bg-red-500/10"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="divide-y divide-white/5 px-6 py-2">
${fieldRows}
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 bg-surface-950/30 px-6 py-3">
        <span className="text-xs text-surface-500">
          Last updated: {String(data.updatedAt || "N/A")}
        </span>
      </div>
    </div>
  );
}`;
}

function generateListComponent(comp: GeneratedComponent, entities: GeneratedEntity[]): string {
  const entityForComponent = findMatchingEntity(comp.name, entities);
  const entityName = entityForComponent?.name || "Record";
  const fields = entityForComponent?.fields.filter((f) => f.name !== "id") || [];
  const mockVar = camelCase(entityName) + "sMock";
  const mockData = generateMockData(entityForComponent || { name: entityName, fields: [] }, 8);

  const columns = fields.slice(0, 5).map((f) => {
    const label = f.name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    return `          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-400">${label}</th>`;
  }).join("\n");

  const cellRender = fields.slice(0, 5).map((f) => {
    const fieldKey = camelCase(f.name);
    const lowerType = f.type.toLowerCase();
    if (lowerType === "enum" || lowerType === "boolean") {
      return `                <td className="whitespace-nowrap px-4 py-2.5 text-sm">
                  <span className={\`inline-flex rounded-full px-2 py-0.5 text-xs font-medium \${
                    item.${fieldKey}
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-surface-800 text-surface-400"
                  }\`}>
                    {String(item.${fieldKey})}
                  </span>
                </td>`;
    }
    return `                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-surface-300">{String(item.${fieldKey})}</td>`;
  }).join("\n");

  return `import { useState, useMemo } from "react";

interface ${entityName}ListItem {
  id: string;
  [key: string]: string | number | boolean | string[] | null;
}

interface ${comp.name}Props {
  items?: ${entityName}ListItem[];
  onItemClick?: (item: ${entityName}ListItem) => void;
}

// ── Mock data ──
const ${mockVar}: ${entityName}ListItem[] = ${mockData};

export function ${comp.name}({
  items = ${mockVar},
  onItemClick,
}: ${comp.name}Props) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const perPage = 6;

  const filtered = useMemo(() => {
    let result = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((item) =>
        Object.values(item).some((v) => String(v).toLowerCase().includes(q))
      );
    }
    if (sortField) {
      result = [...result].sort((a, b) => {
        const aVal = String(a[sortField] ?? "");
        const bVal = String(b[sortField] ?? "");
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }
    return result;
  }, [items, search, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  return (
    <div className="rounded-xl border border-white/5 bg-surface-900/50">
      {/* Search bar */}
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-3">
        <svg className="h-4 w-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search ${pluralize(entityName.toLowerCase())}..."
          className="flex-1 bg-transparent text-sm text-surface-100 placeholder-surface-500 outline-none"
        />
        <span className="text-xs text-surface-600">
          {filtered.length} {filtered.length === 1 ? "result" : "results"}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-white/5 bg-surface-950/30">
            <tr>
${columns}
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {paged.map((item) => (
              <tr
                key={String(item.id)}
                onClick={() => onItemClick?.(item)}
                className="cursor-pointer transition-colors hover:bg-surface-800/50"
              >
${cellRender}
                <td className="px-4 py-2.5 text-right">
                  <svg className="ml-auto h-4 w-4 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={${fields.slice(0, 5).length + 1}} className="px-4 py-12 text-center text-sm text-surface-500">
                  No ${pluralize(entityName.toLowerCase())} found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
          <span className="text-xs text-surface-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-surface-400 transition-all hover:bg-surface-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-surface-400 transition-all hover:bg-surface-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}`;
}

function generateGenericComponent(comp: GeneratedComponent): string {
  const style = resolveStyle(comp);
  const description = comp.description || `${comp.name} component`;

  if (style === "data-display") {
    return generateCardGrid(comp.name, null, null, null);
  }

  return `interface ${comp.name}Props {
  className?: string;
}

export function ${comp.name}({ className }: ${comp.name}Props) {
  return (
    <div className={\`rounded-xl border border-white/5 bg-surface-900/50 p-6 \${className || ""}\`}>
      <h2 className="mb-2 text-lg font-semibold text-surface-200">${comp.name}</h2>
      <p className="text-sm text-surface-400">${description}</p>
    </div>
  );
}`;
}

function generateCardGrid(
  componentName: string,
  entity: GeneratedEntity | null,
  mockVarName: string | null,
  mockDataStr: string | null
): string {
  if (entity && mockVarName && mockDataStr) {
    const displayFields = (entity.fields || []).filter((f) => f.name !== "id").slice(0, 4);
    const entityName = entity.name;

    return `import type { ${entityName} } from "../types";

// ── Mock data ──
const ${mockVarName}: ${entityName}[] = ${mockDataStr};

interface ${componentName}Props {
  items?: ${entityName}[];
  onItemClick?: (item: ${entityName}) => void;
  className?: string;
}

export function ${componentName}({
  items = ${mockVarName},
  onItemClick,
  className,
}: ${componentName}Props) {
  return (
    <div className={\`\${className || ""}\`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-surface-200">
          ${componentName.replace(/([A-Z])/g, " $1").trim()}
        </h2>
        <span className="text-xs text-surface-500">{items.length} total</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={String(item.id)}
            onClick={() => onItemClick?.(item)}
            className="group cursor-pointer rounded-xl border border-white/5 bg-surface-800/50 p-5 transition-all hover:border-brand-500/20 hover:bg-surface-800 hover:shadow-lg"
          >
${displayFields
  .map((f) => {
    const label = f.name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    const fieldKey = camelCase(f.name);
    if (f.type.toLowerCase().includes("enum")) {
      return `            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-surface-500">${label}</span>
              <span className="inline-flex rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-400">
                {String(item.${fieldKey})}
              </span>
            </div>`;
    }
    return `            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-surface-500">${label}</span>
              <span className="text-sm font-medium text-surface-300">
                {String(item.${fieldKey})}
              </span>
            </div>`;
  })
  .join("\n")}
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-400 opacity-0 transition-opacity group-hover:opacity-100">
              View details
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}`;
  }

  // Generic card grid with placeholder cards
  return `interface ${componentName}Props {
  className?: string;
}

export function ${componentName}({ className }: ${componentName}Props) {
  const items = Array.from({ length: 6 }, (_, i) => ({
    id: \`item-\${i + 1}\`,
    title: \`Item \${i + 1}\`,
    status: i % 3 === 0 ? "Active" : i % 3 === 1 ? "Pending" : "Inactive",
    value: Math.floor(Math.random() * 1000),
  }));

  return (
    <div className={\`\${className || ""}\`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-surface-200">
          ${componentName.replace(/([A-Z])/g, " $1").trim()}
        </h2>
        <span className="text-xs text-surface-500">{items.length} items</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="group cursor-pointer rounded-xl border border-white/5 bg-surface-800/50 p-5 transition-all hover:border-brand-500/20 hover:bg-surface-800 hover:shadow-lg"
          >
            <h3 className="font-semibold text-surface-200">{item.title}</h3>
            <div className="mt-2 flex items-center justify-between">
              <span className={\`inline-flex rounded-full px-2 py-0.5 text-xs font-medium \${
                item.status === "Active"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : item.status === "Pending"
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-surface-800 text-surface-400"
              }\`}>
                {item.status}
              </span>
              <span className="text-sm text-surface-500">{item.value}</span>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-400 opacity-0 transition-opacity group-hover:opacity-100">
              View details →
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}`;
}

// ── Generic page wrapper for "page"-type components ────────────────────────

function generateGenericPageWrapper(comp: GeneratedComponent): string {
  const description = comp.description || `${comp.name}`;
  return `interface ${comp.name}Props {
  className?: string;
}

export function ${comp.name}({ className }: ${comp.name}Props) {
  return (
    <div className={\`space-y-6 \${className || ""}\`}>
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-100">
          ${comp.name.replace(/([A-Z])/g, " $1").trim()}
        </h1>
        <p className="mt-1 text-sm text-surface-400">
          ${description}
        </p>
      </div>

      {/* Placeholder content */}
      <div className="rounded-xl border border-dashed border-white/10 bg-surface-900/50 p-12 text-center">
        <p className="text-sm text-surface-500">
          This page will contain ${comp.name.replace(/([A-Z])/g, " $1").trim().toLowerCase()} content.
        </p>
      </div>
    </div>
  );
}`;
}

// ── Entity matching ────────────────────────────────────────────────────────

function findMatchingEntity(componentName: string, entities: GeneratedEntity[]): GeneratedEntity | null {
  if (!entities.length) return null;

  const lowerComp = componentName.toLowerCase();
  // Try exact name match first
  for (const e of entities) {
    if (lowerComp.includes(e.name.toLowerCase())) return e;
  }
  // Try pluralized match
  for (const e of entities) {
    if (lowerComp.includes(pluralize(e.name).toLowerCase())) return e;
  }
  // Try single-word matches
  for (const e of entities) {
    const words = e.name.replace(/([A-Z])/g, " $1").toLowerCase().split(/\s+/);
    if (words.some((w) => lowerComp.includes(w) && w.length > 2)) return e;
  }
  return null;
}

// ── App.tsx builder ────────────────────────────────────────────────────────

function buildAppTsx(components: GeneratedComponent[], allComponentFiles: FrontendFile[]): string {
  // Separate layout components from content components
  const layoutComps = components.filter((c) => resolveStyle(c) === "layout");
  const contentComps = allComponentFiles
    .map((f) => {
      const name = f.filename.replace(/^src\/components\//, "").replace(/\.tsx$/, "");
      return name;
    })
    .filter((n) => n !== "index");

  // Use the first layout as the shell
  const mainLayout = layoutComps[0];
  const layoutName = mainLayout?.name || null;

  // For non-layout components, render them inside the layout
  const contentImports = contentComps
    .filter((n) => n !== layoutName)
    .map((n) => `import { ${n} } from "./components/${n}";`)
    .join("\n");

  const contentJsx = contentComps
    .filter((n) => n !== layoutName)
    .map((n) => `        <${n} />`)
    .join("\n");

  if (layoutName) {
    return `import { ${layoutName} } from "./components/${layoutName}";
${contentImports}

export default function App() {
  return (
    <${layoutName}>
${contentJsx || `      {/* Components render here */}`}
    </${layoutName}>
  );
}`;
  }

  return `import { useState } from "react";
${contentImports}

export default function App() {
  const [activeView, setActiveView] = useState<string>("dashboard");

  return (
    <div className="flex h-screen bg-surface-950 text-surface-100">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-white/5 bg-surface-900/80 p-4">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
            G
          </span>
          <span className="text-sm font-semibold">Genesis App</span>
        </div>
        <nav className="space-y-1">
          {["dashboard", "list", "create"].map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={\`w-full rounded-lg px-3 py-2 text-left text-sm transition-all \${
                activeView === view
                  ? "bg-surface-800 text-white"
                  : "text-surface-400 hover:bg-surface-800/50 hover:text-white"
              }\`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">
${contentJsx || `        <div className="rounded-xl border border-white/5 bg-surface-900/50 p-12 text-center">
          <p className="text-surface-500">Select a view from the sidebar</p>
        </div>`}
      </main>
    </div>
  );
}`;
}

// ── index.tsx and index.html builders ───────────────────────────────────────

function buildIndexTsx(): string {
  return `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
}

function buildIndexHtml(title: string): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      body { margin: 0; font-family: "Inter", sans-serif; }
      #root { min-height: 100vh; }
    </style>
  </head>
  <body class="bg-surface-950 text-surface-100 antialiased">
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>`;
}

// ── Types file ─────────────────────────────────────────────────────────────

function generateTypesFile(entities: GeneratedEntity[]): string {
  const typeDefs = entities
    .map((e) => {
      const fieldDefs = e.fields
        .map((f) => {
          const tsType = f.type.toLowerCase().includes("integer") || f.type.toLowerCase().includes("decimal") || f.type.toLowerCase().includes("float") || f.type.toLowerCase().includes("number")
            ? "number"
            : f.type.toLowerCase() === "boolean"
              ? "boolean"
              : f.type.toLowerCase().startsWith("string[]")
                ? "string[]"
                : f.type.toLowerCase() === "json"
                  ? "Record<string, unknown>"
                  : "string";
          return `  ${camelCase(f.name)}: ${tsType};`;
        })
        .join("\n");
      return `export interface ${e.name} {\n${fieldDefs}\n}`;
    })
    .join("\n\n");

  return `// Auto-generated types — Genesis Platform
// Domain entities from blueprint generation

${typeDefs}
`;
}

// ── index.css ──────────────────────────────────────────────────────────────

function generateCss(): string {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --surface-950: #0a0a0f;
  --surface-900: #111118;
  --surface-800: #1a1a24;
  --brand-500: #6366f1;
  --brand-400: #818cf8;
}

body {
  background-color: var(--surface-950);
  color: #e2e2e9;
  font-family: "Inter", sans-serif;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}`;
}

// ── package.json ───────────────────────────────────────────────────────────

function generatePackageJson(projectName: string): string {
  return JSON.stringify(
    {
      name: kebabCase(projectName),
      private: true,
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1",
      },
      devDependencies: {
        "@types/react": "^18.3.3",
        "@types/react-dom": "^18.3.0",
        "@vitejs/plugin-react": "^4.3.1",
        autoprefixer: "^10.4.19",
        postcss: "^8.4.38",
        tailwindcss: "^3.4.4",
        typescript: "^5.5.3",
        vite: "^5.3.4",
      },
    },
    null,
    2
  );
}

function generateTsconfigJson(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noFallthroughCasesInSwitch: true,
      },
      include: ["src"],
      references: [{ path: "./tsconfig.node.json" }],
    },
    null,
    2
  );
}

function generatePostcssConfig(): string {
  return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`;
}

function generateViteConfig(): string {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});`;
}

function generateTailwindConfig(): string {
  return `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          950: "#0a0a0f",
          900: "#111118",
          800: "#1a1a24",
          700: "#242430",
          600: "#4a4a56",
          500: "#6b6b78",
          400: "#a0a0ab",
          300: "#c8c8d1",
          200: "#e2e2e9",
          100: "#f4f4f6",
        },
        brand: {
          500: "#6366f1",
          400: "#818cf8",
          300: "#a5b4fc",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};`;
}

// ── Main generator ─────────────────────────────────────────────────────────

export function generateFrontendProject(
  entities: GeneratedEntity[],
  components: GeneratedComponent[],
  _endpoints: GeneratedEndpoint[]
): FrontendProject {
  // Flatten the component tree (layout components may have nested children)
  const allComponents = flattenComponents(components);

  const fileList: FrontendFile[] = [];

  // Generate component files
  for (const comp of allComponents) {
    const style = resolveStyle(comp);
    let code: string;

    switch (style) {
      case "layout":
        code = generateLayoutComponent(comp, allComponents);
        break;
      case "form":
        code = generateFormComponent(comp, entities);
        break;
      case "detail":
        code = generateDetailComponent(comp, entities);
        break;
      case "list":
        code = generateListComponent(comp, entities);
        break;
      case "data-display":
      default:
        // "page" types get a page wrapper with data-display
        if (comp.type === "page") {
          code = generateGenericPageWrapper(comp);
        } else {
          code = generateDataDisplayComponent(comp, entities, _endpoints);
        }
        break;
    }

    fileList.push({
      filename: `src/components/${comp.name}.tsx`,
      content: code,
    });
  }

  // Generate types file
  fileList.push({
    filename: "src/types.ts",
    content: generateTypesFile(entities),
  });

  // Generate index.css
  fileList.push({
    filename: "src/index.css",
    content: generateCss(),
  });

  // Config files
  const projectName = entities.length > 0
    ? entities.map((e) => e.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).join("-").slice(0, 40) + "-app"
    : "generated-app";

  fileList.push({ filename: "package.json", content: generatePackageJson(projectName) });
  fileList.push({ filename: "tsconfig.json", content: generateTsconfigJson() });
  fileList.push({ filename: "tsconfig.node.json", content: JSON.stringify({ compilerOptions: { composite: true, skipLibCheck: true, module: "ESNext", moduleResolution: "bundler", allowSyntheticDefaultImports: true }, include: ["vite.config.ts"] }, null, 2) });
  fileList.push({ filename: "vite.config.ts", content: generateViteConfig() });
  fileList.push({ filename: "tailwind.config.js", content: generateTailwindConfig() });
  fileList.push({ filename: "postcss.config.js", content: generatePostcssConfig() });

  // App.tsx
  const appTsx = buildAppTsx(components, fileList);

  // Entry files
  const indexTsx = buildIndexTsx();
  const domainDescription =
    entities.length > 0
      ? entities.map((e) => e.name).join(" • ") + " — Generated by Genesis"
      : "Generated Application — Genesis Platform";
  const indexHtml = buildIndexHtml(domainDescription);

  return {
    files: fileList,
    appTsx,
    indexTsx,
    indexHtml,
  };
}

// ── Component tree flattener ───────────────────────────────────────────────

function flattenComponents(components: GeneratedComponent[]): GeneratedComponent[] {
  const result: GeneratedComponent[] = [];
  const seen = new Set<string>();

  function walk(list: GeneratedComponent[]) {
    for (const comp of list) {
      if (seen.has(comp.name)) continue;
      seen.add(comp.name);
      result.push(comp);
      if (comp.children && comp.children.length > 0) {
        walk(comp.children);
      }
    }
  }

  walk(components);
  return result;
}
