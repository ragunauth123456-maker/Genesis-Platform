/**
 * Workflow Generator
 *
 * Takes entities, endpoints, and relationships from a GenerationResult and produces:
 *   - State machines for entities with a "status" field
 *   - Approval workflows for financial/important operations
 *   - Business process flows combining multiple entities
 *   - A reusable TypeScript workflow engine
 *
 * Output is rendered both as Mermaid diagrams and TypeScript code.
 */

import type { GeneratedEntity, GeneratedEndpoint, Relationship } from "./generate";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StateMachineDef {
  entity: string;
  states: string[];
  transitions: Array<{ from: string; to: string; condition?: string }>;
  mermaid: string;
  tsCode: string;
}

export interface ApprovalFlowDef {
  name: string;
  steps: string[];
  mermaid: string;
  tsCode: string;
}

export interface ProcessFlowDef {
  name: string;
  description: string;
  mermaid: string;
  tsCode: string;
}

export interface WorkflowProject {
  stateMachines: StateMachineDef[];
  approvalFlows: ApprovalFlowDef[];
  processFlows: ProcessFlowDef[];
  workflowEngine: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Detect which entities have a field that can serve as a status/lifecycle.
 * Returns the entity name → array of status values inferred.
 */
function detectStatusEntities(
  entities: GeneratedEntity[]
): Array<{ entity: string; statusField: string; statusValues: string[] }> {
  const results: Array<{ entity: string; statusField: string; statusValues: string[] }> = [];

  for (const entity of entities) {
    for (const field of entity.fields) {
      const fname = field.name.toLowerCase();
      const ftype = field.type.toLowerCase();

      // Look for fields named "status", "state", "stage" or enum/string status-like
      if (
        (fname === "status" || fname === "state" || fname === "stage") &&
        (ftype === "enum" || ftype.startsWith("enum") || ftype === "string")
      ) {
        let statusValues: string[] = [];

        // Extract enum values from the description
        if (field.description) {
          const descParts = field.description.split(/[,;]/);
          const candidates = descParts
            .map((p) => p.trim().toLowerCase())
            .filter((p) => p.length > 0 && !p.includes(" ") && p.length < 30);
          if (candidates.length >= 2) {
            statusValues = candidates;
          }
        }

        // If no explicit values, infer from entity name
        if (statusValues.length === 0) {
          statusValues = inferStatusValues(entity.name);
        }

        results.push({
          entity: entity.name,
          statusField: field.name,
          statusValues,
        });
        break; // Only use first status-like field per entity
      }
    }
  }

  return results;
}

/**
 * Infer a lifecycle state sequence from an entity name.
 * Uses the heuristics specified by the lead.
 */
function inferStatusValues(entityName: string): string[] {
  const lower = entityName.toLowerCase();

  if (/booking|reservation/i.test(lower)) {
    return ["pending", "confirmed", "active", "completed", "cancelled"];
  }
  if (/\border\b/i.test(lower)) {
    return ["pending", "processing", "shipped", "delivered", "cancelled"];
  }
  if (/invoice/i.test(lower)) {
    return ["draft", "sent", "paid", "overdue", "cancelled"];
  }
  if (/task|ticket/i.test(lower)) {
    return ["open", "in-progress", "review", "closed"];
  }
  if (/request|leave/i.test(lower)) {
    return ["pending", "approved", "rejected", "cancelled"];
  }
  if (/payment/i.test(lower)) {
    return ["pending", "processing", "completed", "failed", "refunded"];
  }
  if (/shipment|delivery/i.test(lower)) {
    return ["pending", "in-transit", "out-for-delivery", "delivered", "cancelled"];
  }
  if (/project/i.test(lower)) {
    return ["planning", "active", "on-hold", "completed", "cancelled"];
  }
  if (/deal|opportunity/i.test(lower)) {
    return ["lead", "qualified", "proposal", "negotiation", "closed-won", "closed-lost"];
  }
  if (/subscription/i.test(lower)) {
    return ["active", "past-due", "cancelled", "expired"];
  }

  // Default fallback
  return ["draft", "active", "archived"];
}

/**
 * Determine if an entity has "financial/important" operations that warrant approval.
 */
function isFinancialOrImportant(entity: { name: string; fields: Array<{ name: string; type: string }> }): boolean {
  const lower = entity.name.toLowerCase();

  // Entity name heuristics
  if (/invoice|payment|purchase|expense|budget|contract|order|refund|reimbursement/i.test(lower)) {
    return true;
  }

  // Has amount/price/value fields?
  const hasFinancialFields = entity.fields.some((f) =>
    /amount|price|value|total|cost|fee/i.test(f.name)
  );
  if (hasFinancialFields) return true;

  return false;
}

/**
 * Simple English pluralization.
 */
function pluralize(word: string): string {
  const lower = word.toLowerCase();
  if (/s$/.test(lower) || /x$/.test(lower) || /z$/.test(lower) || /ch$/.test(lower) || /sh$/.test(lower)) {
    return word + "es";
  }
  if (/[^aeiou]y$/i.test(word)) {
    return word.slice(0, -1) + "ies";
  }
  return word + "s";
}

/**
 * Convert a CamelCase string to spaced words.
 */
function pascalToWords(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, "$1 $2");
}

// ── State Machine Generator ────────────────────────────────────────────────────

function generateStateMachine(
  entity: string,
  statusField: string,
  statusValues: string[]
): { mermaid: string; tsCode: string } {
  const states = statusValues;
  const transitions: Array<{ from: string; to: string; condition?: string }> = [];

  // Build a linear forward path through the states (skip terminal ones)
  const terminalStates = new Set(["cancelled", "completed", "delivered", "closed-won", "closed-lost",
    "rejected", "failed", "expired", "archived", "refunded"]);
  const nonTerminal = states.filter((s) => !terminalStates.has(s));

  for (let i = 0; i < nonTerminal.length - 1; i++) {
    transitions.push({ from: nonTerminal[i], to: nonTerminal[i + 1] });
  }

  // Add cancellation paths
  const canCancel = states.includes("cancelled");
  if (canCancel) {
    const earlyStates = states.slice(0, Math.min(3, states.length - 1));
    for (const s of earlyStates) {
      if (s !== "cancelled") {
        transitions.push({
          from: s,
          to: "cancelled",
          condition: "user requests cancellation",
        });
      }
    }
  }

  // Build Mermaid stateDiagram
  const mermaidLines: string[] = ["stateDiagram-v2"];
  for (const state of states) {
    mermaidLines.push(`    ${state.replace(/-/g, "_")}: ${pascalToWords(state.charAt(0).toUpperCase() + state.slice(1))}`);
  }
  mermaidLines.push("");
  for (const t of transitions) {
    const from = t.from.replace(/-/g, "_");
    const to = t.to.replace(/-/g, "_");
    if (t.condition) {
      mermaidLines.push(`    ${from} --> ${to}: ${t.condition}`);
    } else {
      mermaidLines.push(`    ${from} --> ${to}`);
    }
  }

  // Build TypeScript state machine definition
  const entityName = entity;
  const tsLines: string[] = [];
  tsLines.push(`// ── State Machine: ${entityName} ──────────────────────────────────────`);
  tsLines.push(`// Manages the lifecycle of ${entityName} through valid state transitions.`);
  tsLines.push(``);
  tsLines.push(`export const ${entityName}States = ${JSON.stringify(states, null, 2)} as const;`);
  tsLines.push(`export type ${entityName}State = typeof ${entityName}States[number];`);
  tsLines.push(``);
  tsLines.push(`export interface ${entityName}StateTransition {`);
  tsLines.push(`  from: ${entityName}State;`);
  tsLines.push(`  to: ${entityName}State;`);
  tsLines.push(`  condition?: (context: ${entityName}Context) => boolean;`);
  tsLines.push(`}`);
  tsLines.push(``);
  tsLines.push(`export interface ${entityName}Context {`);
  tsLines.push(`  entityId: string;`);
  tsLines.push(`  currentState: ${entityName}State;`);
  tsLines.push(`  metadata: Record<string, unknown>;`);
  tsLines.push(`}`);
  tsLines.push(``);
  tsLines.push(`export const ${entityName}Transitions: ${entityName}StateTransition[] = [`);

  for (const t of transitions) {
    const conditionStr = t.condition
      ? `\n    condition: (_ctx) => {\n      // ${t.condition}\n      return true;\n    },`
      : "";
    tsLines.push(`  { from: "${t.from}", to: "${t.to}"${conditionStr ? "," : ""}${conditionStr} },`);
  }

  tsLines.push(`];`);
  tsLines.push(``);
  tsLines.push(`export function canTransition${entityName}(`);
  tsLines.push(`  currentState: ${entityName}State,`);
  tsLines.push(`  targetState: ${entityName}State`);
  tsLines.push(`): boolean {`);
  tsLines.push(`  return ${entityName}Transitions.some(`);
  tsLines.push(`    (t) => t.from === currentState && t.to === targetState`);
  tsLines.push(`  );`);
  tsLines.push(`}`);
  tsLines.push(``);
  tsLines.push(`export function execute${entityName}Transition(`);
  tsLines.push(`  context: ${entityName}Context,`);
  tsLines.push(`  targetState: ${entityName}State`);
  tsLines.push(`): ${entityName}Context {`);
  tsLines.push(`  const transition = ${entityName}Transitions.find(`);
  tsLines.push(`    (t) => t.from === context.currentState && t.to === targetState`);
  tsLines.push(`  );`);
  tsLines.push(`  if (!transition) {`);
  tsLines.push(`    throw new Error(`);
  tsLines.push(`      \`Invalid state transition: \${context.currentState} → \${targetState} for ${entityName}\``);
  tsLines.push(`    );`);
  tsLines.push(`  }`);
  tsLines.push(`  `);
  tsLines.push(`  // Execute transition guard condition`);
  tsLines.push(`  if (transition.condition && !transition.condition(context)) {`);
  tsLines.push(`    throw new Error(\`Transition guard failed: \${context.currentState} → \${targetState}\`);`);
  tsLines.push(`  }`);
  tsLines.push(`  `);
  tsLines.push(`  console.log(\`[${entityName}] State transition: \${context.currentState} → \${targetState}\`);`);
  tsLines.push(`  return { ...context, currentState: targetState };`);
  tsLines.push(`}`);

  return {
    mermaid: mermaidLines.join("\n"),
    tsCode: tsLines.join("\n"),
  };
}

// ── Approval Workflow Generator ─────────────────────────────────────────────────

function generateApprovalWorkflows(
  entities: GeneratedEntity[],
  endpoints: GeneratedEndpoint[]
): ApprovalFlowDef[] {
  const flows: ApprovalFlowDef[] = [];
  const financialEntities = entities.filter(isFinancialOrImportant);

  for (const entity of financialEntities) {
    const entityName = entity.name;
    const hasPermissionEndpoint = endpoints.some((ep) =>
      ep.path.toLowerCase().includes(`/${pluralize(entityName).toLowerCase()}/`) &&
      (ep.description.toLowerCase().includes("approve") ||
       ep.description.toLowerCase().includes("review") ||
       ep.description.toLowerCase().includes("submit"))
    );

    // Infer approval steps from entity type
    let steps: string[];
    const lower = entityName.toLowerCase();

    if (/invoice/i.test(lower)) {
      steps = ["Submit Invoice", "Manager Review", "Finance Approval", "Payment Processing", "Completed"];
    } else if (/expense|reimbursement/i.test(lower)) {
      steps = ["Submit Expense", "Manager Review", "Finance Approval", "Reimbursement"];
    } else if (/order|purchase/i.test(lower)) {
      steps = ["Create Order", "Budget Check", "Manager Approval", "Finance Approval", "Fulfilled"];
    } else if (/contract/i.test(lower)) {
      steps = ["Draft Contract", "Legal Review", "Manager Approval", "Executive Approval", "Signed"];
    } else if (hasPermissionEndpoint) {
      steps = ["Submit", "Manager Review", "Finance Approval", "Final Approval", "Completed"];
    } else {
      steps = ["Submit", "Review", "Approval", "Completed"];
    }

    // Build Mermaid flowchart
    const mermaidLines: string[] = ["graph TD"];
    const stepIds: string[] = [];
    for (let i = 0; i < steps.length; i++) {
      const id = `A${i + 1}`;
      stepIds.push(id);
      const stepName = steps[i];
      // Add a role label
      let role = "";
      if (stepName.toLowerCase().includes("submit") || stepName.toLowerCase().includes("create")) {
        role = "👤 Requester";
      } else if (stepName.toLowerCase().includes("manager")) {
        role = "👔 Manager";
      } else if (stepName.toLowerCase().includes("finance") || stepName.toLowerCase().includes("payment")) {
        role = "💰 Finance";
      } else if (stepName.toLowerCase().includes("legal")) {
        role = "⚖️ Legal";
      } else if (stepName.toLowerCase().includes("executive") || stepName.toLowerCase().includes("final")) {
        role = "🏢 Executive";
      } else if (stepName.toLowerCase().includes("fulfill") || stepName.toLowerCase().includes("complete")) {
        role = "✅ System";
      }
      const label = role ? `${stepName}<br/><small>${role}</small>` : stepName;
      mermaidLines.push(`    ${id}["${label}"]`);
    }

    // Forward transitions
    for (let i = 0; i < stepIds.length - 1; i++) {
      mermaidLines.push(`    ${stepIds[i]} --> ${stepIds[i + 1]}`);
    }

    // Rejection path from review/approval steps
    for (let i = 0; i < stepIds.length - 1; i++) {
      const step = steps[i];
      if (step.toLowerCase().includes("review") || step.toLowerCase().includes("approval")) {
        mermaidLines.push(`    ${stepIds[i]} -->|Reject| R${i}[❌ Rejected]`);
      }
    }

    // Build TypeScript code
    const tsLines: string[] = [];
    tsLines.push(`// ── Approval Workflow: ${entityName} ─────────────────────────────────`);
    tsLines.push(`// ${steps.length}-step approval chain for ${entityName} operations.`);
    tsLines.push(`// Use executeWorkflow() from the workflow engine to run this.`);
    tsLines.push(``);
    tsLines.push(`export interface ${entityName}ApprovalContext {`);
    tsLines.push(`  ${entityName.toLowerCase()}Id: string;`);
    tsLines.push(`  amount?: number;`);
    tsLines.push(`  department?: string;`);
    tsLines.push(`  submittedBy: string;`);
    tsLines.push(`  currentStep: string;`);
    tsLines.push(`  approvals: Array<{`);
    tsLines.push(`    step: string;`);
    tsLines.push(`    approver: string;`);
    tsLines.push(`    status: "pending" | "approved" | "rejected";`);
    tsLines.push(`    timestamp?: string;`);
    tsLines.push(`    comment?: string;`);
    tsLines.push(`  }>;`);
    tsLines.push(`}`);
    tsLines.push(``);
    tsLines.push(`export const ${entityName}ApprovalSteps = [`);

    for (const step of steps) {
      tsLines.push(`  "${step}",`);
    }
    tsLines.push(`] as const;`);
    tsLines.push(``);

    // Conditional routing for financial entities
    if (/invoice|order|expense/i.test(lower)) {
      tsLines.push(`/** Conditional routing based on amount */`);
      tsLines.push(`export function route${entityName}Approval(ctx: ${entityName}ApprovalContext): string {`);
      tsLines.push(`  if (!ctx.amount || ctx.amount < 1000) {`);
      tsLines.push(`    // Skip finance review for small amounts — auto-advance`);
      tsLines.push(`    return "Completed";`);
      tsLines.push(`  }`);
      tsLines.push(`  if (ctx.amount > 50000) {`);
      tsLines.push(`    // Escalate large amounts to executive approval`);
      tsLines.push(`    return "${steps[steps.length - 2] || "Final Approval"}";`);
      tsLines.push(`  }`);
      tsLines.push(`  // Standard routing — follow the chain`);
      tsLines.push(`  const currentIdx = ${entityName}ApprovalSteps.indexOf(`);
      tsLines.push(`    ctx.currentStep as typeof ${entityName}ApprovalSteps[number]`);
      tsLines.push(`  );`);
      tsLines.push(`  if (currentIdx >= 0 && currentIdx < ${entityName}ApprovalSteps.length - 1) {`);
      tsLines.push(`    return ${entityName}ApprovalSteps[currentIdx + 1];`);
      tsLines.push(`  }`);
      tsLines.push(`  return "Completed";`);
      tsLines.push(`}`);
      tsLines.push(``);
    }

    // Escalation rules
    tsLines.push(`/** Auto-escalation on timeout */`);
    tsLines.push(`export async function escalate${entityName}Approval(`);
    tsLines.push(`  ctx: ${entityName}ApprovalContext,`);
    tsLines.push(`  timeoutHours: number = 48`);
    tsLines.push(`): Promise<${entityName}ApprovalContext> {`);
    tsLines.push(`  // In production: use a scheduler/cron to check pending approvals`);
    tsLines.push(`  const pendingApproval = ctx.approvals.find(`);
    tsLines.push(`    (a) => a.status === "pending"`);
    tsLines.push(`  );`);
    tsLines.push(`  if (!pendingApproval) return ctx;`);
    tsLines.push(`  `);
    tsLines.push(`  // Check if the approval has been pending too long`);
    tsLines.push(`  const submittedAt = new Date(ctx.approvals[0]?.timestamp ?? Date.now());`);
    tsLines.push(`  const elapsed = (Date.now() - submittedAt.getTime()) / (1000 * 60 * 60);`);
    tsLines.push(`  `);
    tsLines.push(`  if (elapsed > timeoutHours) {`);
    tsLines.push(`    console.warn(\`[${entityName}] Approval \${ctx.${entityName.toLowerCase()}Id} timed out after \${timeoutHours}h — escalating\`);`);
    tsLines.push(`    // Escalate to next level`);
    tsLines.push(`    const currentIdx = ${entityName}ApprovalSteps.indexOf(`);
    tsLines.push(`      ctx.currentStep as typeof ${entityName}ApprovalSteps[number]`);
    tsLines.push(`    );`);
    tsLines.push(`    if (currentIdx >= 0 && currentIdx < ${entityName}ApprovalSteps.length - 1) {`);
    tsLines.push(`      ctx.currentStep = ${entityName}ApprovalSteps[currentIdx + 1];`);
    tsLines.push(`      // Notify the next approver (in production: send email/notification)`);
    tsLines.push(`      console.log(\`[${entityName}] Escalated to: \${ctx.currentStep}\`);`);
    tsLines.push(`    }`);
    tsLines.push(`  }`);
    tsLines.push(`  `);
    tsLines.push(`  return ctx;`);
    tsLines.push(`}`);

    flows.push({
      name: `${entityName} Approval`,
      steps,
      mermaid: mermaidLines.join("\n"),
      tsCode: tsLines.join("\n"),
    });
  }

  return flows;
}

// ── Process Flow Generator ─────────────────────────────────────────────────────

function generateProcessFlows(
  entities: GeneratedEntity[],
  endpoints: GeneratedEndpoint[]
): ProcessFlowDef[] {
  const flows: ProcessFlowDef[] = [];
  const entityNamesLower = new Set(entities.map((e) => e.name.toLowerCase()));

  // Look for domain-specific endpoints that imply multi-entity processes
  const domainActions = endpoints.filter((ep) => {
    const path = ep.path.toLowerCase();
    // Actions embedded in paths like /bookings/:id/check-in, /orders/:id/fulfill
    const parts = path.split("/").filter(Boolean);
    return parts.length >= 4; // e.g., /api/bookings/:id/check-in
  });

  if (domainActions.length >= 2) {
    // Discover the main business process from domain-specific endpoints
    const entityActions = new Map<string, string[]>();
    for (const ep of domainActions) {
      const parts = ep.path.toLowerCase().split("/").filter(Boolean);
      // parts[1] is the resource, parts[3] is the action
      const resource = parts[1] || "";
      const action = parts[3] || "";
      if (resource && action) {
        const existing = entityActions.get(resource) || [];
        existing.push(action);
        entityActions.set(resource, existing);
      }
    }

    // Try to chain these into a meaningful process
    if (entityActions.size >= 1) {
      const processSteps: string[] = [];
      const swimlaneEntities: string[] = [];

      for (const [resource, actions] of entityActions) {
        const entityName = resource.charAt(0).toUpperCase() + resource.slice(1);
        swimlaneEntities.push(entityName);
        for (const action of actions) {
          const stepName = action
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
          processSteps.push(`${stepName} ${entityName}`);
        }
      }

      if (processSteps.length >= 3) {
        const processName = `${entities[0]?.name || "Entity"} Lifecycle`;

        // Build Mermaid flowchart with swimlanes
        const mermaidLines: string[] = ["graph TB"];
        const stepIds: string[] = [];
        for (let i = 0; i < processSteps.length; i++) {
          const id = `S${i + 1}`;
          stepIds.push(id);
          mermaidLines.push(`    ${id}["${processSteps[i]}"]`);
          if (i > 0) {
            mermaidLines.push(`    ${stepIds[i - 1]} --> ${id}`);
          }
        }

        // Build TypeScript
        const tsLines: string[] = [];
        tsLines.push(`// ── Process Flow: ${processName} ────────────────────────────────────`);
        tsLines.push(`// End-to-end business process spanning multiple entities.`);
        tsLines.push(`// Orchestrated by the workflow engine.`);
        tsLines.push(``);
        tsLines.push(`export interface ${processName.replace(/\s+/g, "")}Context {`);
        for (const entity of entities) {
          tsLines.push(`  ${entity.name.toLowerCase()}Id?: string;`);
        }
        tsLines.push(`  status: string;`);
        tsLines.push(`  metadata: Record<string, unknown>;`);
        tsLines.push(`}`);
        tsLines.push(``);
        tsLines.push(`export async function ${processName.replace(/\s+/g, "")}Process(`);
        tsLines.push(`  ctx: ${processName.replace(/\s+/g, "")}Context`);
        tsLines.push(`): Promise<${processName.replace(/\s+/g, "")}Context> {`);
        tsLines.push(`  console.log(\`[Process] Starting: ${processName}\`);`);
        for (let i = 0; i < processSteps.length; i++) {
          const stepVar = processSteps[i].replace(/\s+/g, "");
          tsLines.push(`  `);
          tsLines.push(`  // Step ${i + 1}: ${processSteps[i]}`);
          tsLines.push(`  console.log(\`  Step ${i + 1}: ${processSteps[i]}\`);`);
          tsLines.push(`  await executeStep_${stepVar}(ctx);`);
        }
        tsLines.push(`  `);
        tsLines.push(`  console.log(\`[Process] Completed: ${processName}\`);`);
        tsLines.push(`  ctx.status = "completed";`);
        tsLines.push(`  return ctx;`);
        tsLines.push(`}`);
        tsLines.push(``);

        // Generate the individual step functions
        for (const step of processSteps) {
          const stepVar = step.replace(/\s+/g, "");
          tsLines.push(`async function executeStep_${stepVar}(ctx: ${processName.replace(/\s+/g, "")}Context) {`);
          tsLines.push(`  // ${step}`);
          tsLines.push(`  // In production: call API endpoint, validate state, handle errors`);
          tsLines.push(`  await new Promise((r) => setTimeout(r, 100)); // Simulated delay`);
          tsLines.push(`}`);
          tsLines.push(``);
        }

        flows.push({
          name: processName,
          description: `End-to-end process: ${processSteps.join(" → ")}`,
          mermaid: mermaidLines.join("\n"),
          tsCode: tsLines.join("\n"),
        });
      }
    }
  }

  // Always generate at least one generic process flow
  if (flows.length === 0 && entities.length >= 2) {
    const [primary, secondary] = entities;
    const processSteps = [
      `Validate ${primary.name}`,
      `Lookup ${secondary.name}`,
      `Process ${primary.name}`,
      `Notify ${secondary.name}`,
      `Complete ${primary.name}`,
    ];

    const processName = `${primary.name} Management`;
    const mermaidLines: string[] = ["graph TB"];
    const stepIds: string[] = [];
    for (let i = 0; i < processSteps.length; i++) {
      const id = `G${i + 1}`;
      stepIds.push(id);
      mermaidLines.push(`    ${id}["${processSteps[i]}"]`);
      if (i > 0) {
        mermaidLines.push(`    ${stepIds[i - 1]} --> ${id}`);
      }
    }

    const tsLines: string[] = [];
    tsLines.push(`// ── Process Flow: ${processName} ────────────────────────────────────`);
    tsLines.push(``);
    tsLines.push(`export async function ${processName.replace(/\s+/g, "")}Process(`);
    tsLines.push(`  ${primary.name.toLowerCase()}Id: string`);
    tsLines.push(`): Promise<void> {`);
    tsLines.push(`  console.log(\`[Process] Starting: ${processName}\`);`);
    tsLines.push(``);
    for (let i = 0; i < processSteps.length; i++) {
      tsLines.push(`  // Step ${i + 1}: ${processSteps[i]}`);
      tsLines.push(`  await executeStep${i + 1}(${primary.name.toLowerCase()}Id);`);
      tsLines.push(``);
    }
    tsLines.push(`  console.log(\`[Process] Completed: ${processName}\`);`);
    tsLines.push(`}`);
    tsLines.push(``);
    for (let i = 0; i < processSteps.length; i++) {
      tsLines.push(`async function executeStep${i + 1}(id: string) {`);
      tsLines.push(`  // ${processSteps[i]}`);
      tsLines.push(`  await new Promise((r) => setTimeout(r, 100));`);
      tsLines.push(`}`);
      tsLines.push(``);
    }

    flows.push({
      name: processName,
      description: `Core business process: ${processSteps.join(" → ")}`,
      mermaid: mermaidLines.join("\n"),
      tsCode: tsLines.join("\n"),
    });
  }

  return flows;
}

// ── Workflow Engine ────────────────────────────────────────────────────────────

function generateWorkflowEngine(): string {
  return [
    `// ── Workflow Engine ───────────────────────────────────────────────────────`,
    `//`,
    `// A lightweight, type-safe workflow execution engine that supports:`,
    `//   - Sequential and conditional step execution`,
    `//   - State machine transitions`,
    `//   - Approval chains with routing & escalation`,
    `//   - Webhook integration for API-driven workflows`,
    `//`,
    `// Generated by Genesis Platform ASGP Engine`,
    `// ───────────────────────────────────────────────────────────────────────────`,
    ``,
    `// ── Core Types ─────────────────────────────────────────────────────────`,
    ``,
    `export type StepStatus = "pending" | "active" | "completed" | "failed" | "skipped";`,
    ``,
    `export interface WorkflowStep<C = Record<string, unknown>> {`,
    `  id: string;`,
    `  name: string;`,
    `  description?: string;`,
    `  execute: (context: C) => Promise<Partial<C>>;`,
    `  condition?: (context: C) => boolean;`,
    `  onError?: (error: Error, context: C) => Promise<void>;`,
    `  retries?: number;`,
    `  timeoutMs?: number;`,
    `}`,
    ``,
    `export interface WorkflowDefinition<C = Record<string, unknown>> {`,
    `  id: string;`,
    `  name: string;`,
    `  description?: string;`,
    `  steps: WorkflowStep<C>[];`,
    `  transitions: Array<{`,
    `    from: string;`,
    `    to: string;`,
    `    condition?: (context: C) => boolean;`,
    `  }>;`,
    `  onComplete?: (context: C) => Promise<void>;`,
    `  onError?: (error: Error, context: C) => Promise<void>;`,
    `}`,
    ``,
    `export interface WorkflowExecution<C = Record<string, unknown>> {`,
    `  id: string;`,
    `  workflowId: string;`,
    `  status: "running" | "completed" | "failed" | "paused";`,
    `  currentStepId: string | null;`,
    `  context: C;`,
    `  stepResults: Array<{ stepId: string; status: StepStatus; output?: Partial<C>; error?: string; startedAt: string; completedAt?: string }>;`,
    `  startedAt: string;`,
    `  completedAt?: string;`,
    `}`,
    ``,
    `// ── Engine Core ─────────────────────────────────────────────────────────`,
    ``,
    `export async function executeWorkflow<C extends Record<string, unknown>>(`,
    `  workflow: WorkflowDefinition<C>,`,
    `  initialContext: C`,
    `): Promise<WorkflowExecution<C>> {`,
    `  const execution: WorkflowExecution<C> = {`,
    `    id: generateWorkflowId(),`,
    `    workflowId: workflow.id,`,
    `    status: "running",`,
    `    currentStepId: null,`,
    `    context: { ...initialContext },`,
    `    stepResults: [],`,
    `    startedAt: new Date().toISOString(),`,
    `  };`,
    ``,
    `  console.log(\`[Workflow] Starting: \${workflow.name} (\${execution.id})\`);`,
    ``,
    `  let currentStep: WorkflowStep<C> | null = workflow.steps[0] ?? null;`,
    ``,
    `  while (currentStep) {`,
    `    execution.currentStepId = currentStep.id;`,
    ``,
    `    // Check condition`,
    `    if (currentStep.condition && !currentStep.condition(execution.context)) {`,
    `      execution.stepResults.push({`,
    `        stepId: currentStep.id,`,
    `        status: "skipped",`,
    `        startedAt: new Date().toISOString(),`,
    `        completedAt: new Date().toISOString(),`,
    `      });`,
    `      currentStep = getNextStep(workflow, currentStep, execution.context);`,
    `      continue;`,
    `    }`,
    ``,
    `    // Execute the step`,
    `    const stepStart = new Date().toISOString();`,
    `    let attempts = 0;`,
    `    const maxRetries = currentStep.retries ?? 0;`,
    ``,
    `    while (true) {`,
    `      try {`,
    `        console.log(\`[Workflow] Executing step: \${currentStep.name} (\${currentStep.id})\`);`,
    ``,
    `        const stepPromise = currentStep.execute(execution.context);`,
    `        const timeoutPromise = currentStep.timeoutMs`,
    `          ? new Promise<never>((_, reject) =>`,
    `              setTimeout(() => reject(new Error(\`Step \${currentStep.id} timed out after \${currentStep.timeoutMs}ms\`)), currentStep.timeoutMs)`,
    `            )`,
    `          : null;`,
    ``,
    `        const output = timeoutPromise`,
    `          ? await Promise.race([stepPromise, timeoutPromise])`,
    `          : await stepPromise;`,
    ``,
    `        // Merge output into context`,
    `        if (output) {`,
    `          Object.assign(execution.context, output);`,
    `        }`,
    ``,
    `        execution.stepResults.push({`,
    `          stepId: currentStep.id,`,
    `          status: "completed",`,
    `          output: output as Partial<C>,`,
    `          startedAt: stepStart,`,
    `          completedAt: new Date().toISOString(),`,
    `        });`,
    ``,
    `        break; // Success — exit retry loop`,
    `      } catch (err) {`,
    `        attempts++;`,
    `        const error = err instanceof Error ? err : new Error(String(err));`,
    ``,
    `        console.error(`,
    `          \`[Workflow] Step \${currentStep.id} failed (attempt \${attempts}/\${maxRetries + 1}): \${error.message}\``,
    `        );`,
    ``,
    `        if (attempts <= maxRetries) {`,
    `          // Exponential backoff`,
    `          await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 1000));`,
    `          continue;`,
    `        }`,
    ``,
    `        // All retries exhausted`,
    `        execution.stepResults.push({`,
    `          stepId: currentStep.id,`,
    `          status: "failed",`,
    `          error: error.message,`,
    `          startedAt: stepStart,`,
    `          completedAt: new Date().toISOString(),`,
    `        });`,
    ``,
    `        // Call error handler if defined`,
    `        if (currentStep.onError) {`,
    `          await currentStep.onError(error, execution.context);`,
    `        }`,
    ``,
    `        // Call workflow-level error handler`,
    `        if (workflow.onError) {`,
    `          await workflow.onError(error, execution.context);`,
    `        }`,
    ``,
    `        execution.status = "failed";`,
    `        execution.completedAt = new Date().toISOString();`,
    `        return execution;`,
    `      }`,
    `    }`,
    ``,
    `    // Find next step`,
    `    currentStep = getNextStep(workflow, currentStep, execution.context);`,
    `  }`,
    ``,
    `  // All steps completed`,
    `  execution.status = "completed";`,
    `  execution.completedAt = new Date().toISOString();`,
    `  execution.currentStepId = null;`,
    ``,
    `  if (workflow.onComplete) {`,
    `    await workflow.onComplete(execution.context);`,
    `  }`,
    ``,
    `  console.log(\`[Workflow] Completed: \${workflow.name} (\${execution.id})\`);`,
    `  return execution;`,
    `}`,
    ``,
    `function getNextStep<C extends Record<string, unknown>>(`,
    `  workflow: WorkflowDefinition<C>,`,
    `  currentStep: WorkflowStep<C>,`,
    `  context: C`,
    `): WorkflowStep<C> | null {`,
    `  // Find a transition matching current step`,
    `  const transition = workflow.transitions.find(`,
    `    (t) => t.from === currentStep.id`,
    `  );`,
    ``,
    `  if (!transition) {`,
    `    // Default: take the next step in order`,
    `    const currentIdx = workflow.steps.findIndex((s) => s.id === currentStep.id);`,
    `    if (currentIdx >= 0 && currentIdx < workflow.steps.length - 1) {`,
    `      return workflow.steps[currentIdx + 1];`,
    `    }`,
    `    return null; // End of workflow`,
    `  }`,
    ``,
    `  // Check transition condition`,
    `  if (transition.condition && !transition.condition(context)) {`,
    `    // Condition failed — try sequential fallback`,
    `    const currentIdx = workflow.steps.findIndex((s) => s.id === currentStep.id);`,
    `    if (currentIdx >= 0 && currentIdx < workflow.steps.length - 1) {`,
    `      return workflow.steps[currentIdx + 1];`,
    `    }`,
    `    return null;`,
    `  }`,
    ``,
    `  // Find the target step`,
    `  return workflow.steps.find((s) => s.id === transition.to) ?? null;`,
    `}`,
    ``,
    `// ── Webhook Integration ─────────────────────────────────────────────────`,
    ``,
    `export interface WorkflowWebhook {`,
    `  workflowId: string;`,
    `  endpoint: string;`,
    `  method: "POST" | "PUT";`,
    `  handler: (payload: unknown) => Promise<Record<string, unknown>>;`,
    `}`,
    ``,
    `export function createWorkflowWebhookStep<C extends Record<string, unknown>>(`,
    `  webhook: WorkflowWebhook`,
    `): WorkflowStep<C> {`,
    `  return {`,
    `    id: \`webhook-\${webhook.workflowId}\`,`,
    `    name: \`Webhook: \${webhook.method} \${webhook.endpoint}\`,`,
    `    description: \`Handles incoming webhook for workflow \${webhook.workflowId}\`,`,
    `    execute: async (context) => {`,
    `      console.log(\`[Webhook] Triggered: \${webhook.method} \${webhook.endpoint}\`);`,
    `      // In production: the webhook payload arrives from the HTTP request`,
    `      // Here we provide a stub; real integration uses the route handler below`,
    `      return { ...context };`,
    `    },`,
    `  };`,
    `}`,
    ``,
    `export function createWorkflowWebhookRoute(`,
    `  webhooks: WorkflowWebhook[]`,
    `): string {`,
    `  // Returns a Hono-compatible route handler string for integration`,
    `  return \`// Webhook route handler`,
    `// Add this to your Hono router:`,
    `//   import { workflowWebhooks } from "./workflows";`,
    `//   workflowWebhooks.forEach((wh) => {`,
    `//     router[wh.method.toLowerCase()](wh.endpoint, async (c) => {`,
    `//       const payload = await c.req.json();`,
    `//       const result = await wh.handler(payload);`,
    `//       return c.json(result);`,
    `//     });`,
    `//   });`,
    `\`;`,
    `}`,
    ``,
    `// ── Utility ──────────────────────────────────────────────────────────────`,
    ``,
    `function generateWorkflowId(): string {`,
    `  return \`wf_\${Date.now().toString(36)}_\${Math.random().toString(36).slice(2, 9)}\`;`,
    `}`,
    ``,
    `// ── State Machine Integration ───────────────────────────────────────────`,
    ``,
    `export interface StateMachineStep<C extends Record<string, unknown>> extends WorkflowStep<C> {`,
    `  stateMachine: {`,
    `    entity: string;`,
    `    from: string;`,
    `    to: string;`,
    `  };`,
    `}`,
    ``,
    `export function createStateMachineStep<C extends Record<string, unknown>>(`,
    `  entity: string,`,
    `  fromState: string,`,
    `  toState: string,`,
    `  execute: (ctx: C) => Promise<Partial<C>>`,
    `): StateMachineStep<C> {`,
    `  return {`,
    `    id: \`sm-\${entity.toLowerCase()}-\${fromState}-to-\${toState}\`,`,
    `    name: \`\${entity}: \${fromState} → \${toState}\`,`,
    `    description: \`State transition for \${entity}\`,`,
    `    stateMachine: { entity, from: fromState, to: toState },`,
    `    execute,`,
    `  };`,
    `}`,
    ``,
    `export default {`,
    `  executeWorkflow,`,
    `  createWorkflowWebhookStep,`,
    `  createWorkflowWebhookRoute,`,
    `  createStateMachineStep,`,
    `};`,
  ].join("\n");
}

// ── Main Generator ─────────────────────────────────────────────────────────────

export function generateWorkflows(
  entities: GeneratedEntity[],
  endpoints: GeneratedEndpoint[],
  _relationships: Relationship[]
): WorkflowProject {
  // 1. Generate state machines for entities with status fields
  const statusEntities = detectStatusEntities(entities);
  const stateMachines: StateMachineDef[] = [];

  for (const statusEntity of statusEntities) {
    const { mermaid, tsCode } = generateStateMachine(
      statusEntity.entity,
      statusEntity.statusField,
      statusEntity.statusValues
    );
    stateMachines.push({
      entity: statusEntity.entity,
      states: statusEntity.statusValues,
      transitions: buildTransitionList(statusEntity.statusValues),
      mermaid,
      tsCode,
    });
  }

  // If no entities have explicit status fields, add a generic one for the first entity
  if (stateMachines.length === 0 && entities.length > 0) {
    const firstEntity = entities[0];
    const statusValues = inferStatusValues(firstEntity.name);
    const { mermaid, tsCode } = generateStateMachine(firstEntity.name, "status", statusValues);
    stateMachines.push({
      entity: firstEntity.name,
      states: statusValues,
      transitions: buildTransitionList(statusValues),
      mermaid,
      tsCode,
    });
  }

  // 2. Generate approval workflows
  const approvalFlows = generateApprovalWorkflows(entities, endpoints);

  // 3. Generate process flows
  const processFlows = generateProcessFlows(entities, endpoints);

  // 4. Workflow engine
  const workflowEngine = generateWorkflowEngine();

  return { stateMachines, approvalFlows, processFlows, workflowEngine };
}

// Helper to rebuild transition list from status values (mirrors the logic in generateStateMachine)
function buildTransitionList(
  statusValues: string[]
): Array<{ from: string; to: string; condition?: string }> {
  const terminalStates = new Set(["cancelled", "completed", "delivered", "closed-won", "closed-lost",
    "rejected", "failed", "expired", "archived", "refunded"]);
  const nonTerminal = statusValues.filter((s) => !terminalStates.has(s));
  const transitions: Array<{ from: string; to: string; condition?: string }> = [];

  for (let i = 0; i < nonTerminal.length - 1; i++) {
    transitions.push({ from: nonTerminal[i], to: nonTerminal[i + 1] });
  }

  if (statusValues.includes("cancelled")) {
    const earlyStates = statusValues.slice(0, Math.min(3, statusValues.length - 1));
    for (const s of earlyStates) {
      if (s !== "cancelled") {
        transitions.push({ from: s, to: "cancelled", condition: "user requests cancellation" });
      }
    }
  }

  return transitions;
}
