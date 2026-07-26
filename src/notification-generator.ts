/**
 * Notification Generator
 *
 * Takes entities and endpoints from a GenerationResult and produces:
 *   - Email templates — welcome/onboarding, status change, action required, digest
 *   - Push notification system — NotificationService class with sendEmail/sendPush/sendInApp
 *   - Notification center UI — React component with bell icon, dropdown, filters
 *   - Notification types — TypeScript interfaces for Notification, NotificationTemplate, NotificationPreferences
 *   - Notification store — Zustand-like store for frontend state management
 *
 * Output is rendered as code artifacts ready for project integration.
 */

import type { GeneratedEntity, GeneratedEndpoint } from "./generate";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text: string;
}

export interface NotificationProject {
  emailTemplates: EmailTemplate[];
  notificationService: string;
  notificationCenter: string;
  notificationTypes: string;
  notificationStore: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Derive a human-readable singular name for the primary entity */
function primaryEntityName(entities: GeneratedEntity[]): string {
  if (entities.length === 0) return "Item";
  // Pick the entity with the most fields as "primary"
  const sorted = [...entities].sort((a, b) => b.fields.length - a.fields.length);
  return sorted[0].name;
}

/** Derive the service/company name from domain */
function serviceName(domain: string): string {
  const words = domain.split(/\s+/).filter(w => w.length > 1);
  if (words.length === 0) return "Genesis App";
  return words.map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/** Slugify for CSS classes */
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Email Template Generators ──────────────────────────────────────────────────

function generateWelcomeEmail(entities: GeneratedEntity[], domain: string): EmailTemplate {
  const appName = serviceName(domain);
  const entityName = primaryEntityName(entities);
  const entityLower = entityName.toLowerCase();
  const subject = `Welcome to ${appName} — Let's get started! 🚀`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0b;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#141416;border-radius:16px;border:1px solid #2a2a2e;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;line-height:1.3;">
                👋 Welcome to ${appName}
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:24px 40px 32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#a1a1aa;line-height:1.6;">
                Thanks for signing up! We're excited to have you on board. ${appName} helps you manage your <strong style="color:#e4e4e7;">${entityLower}</strong> operations seamlessly.
              </p>
              <p style="margin:0 0 24px;font-size:16px;color:#a1a1aa;line-height:1.6;">
                Here's what you can do right away:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:12px 16px;background-color:#1c1c1f;border-radius:8px;margin-bottom:8px;">
                    <p style="margin:0;font-size:14px;color:#e4e4e7;"><strong style="color:#60a5fa;">📋 Create your first ${entityLower}</strong> — Set up your initial ${entityLower} in under 2 minutes.</p>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:12px 16px;background-color:#1c1c1f;border-radius:8px;">
                    <p style="margin:0;font-size:14px;color:#e4e4e7;"><strong style="color:#60a5fa;">👥 Invite your team</strong> — Collaborate with your colleagues in real time.</p>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:12px 16px;background-color:#1c1c1f;border-radius:8px;">
                    <p style="margin:0;font-size:14px;color:#e4e4e7;"><strong style="color:#60a5fa;">⚙️ Customize your workspace</strong> — Tailor settings to match your workflow.</p>
                  </td>
                </tr>
              </table>
              <!-- CTA -->
              <div style="text-align:center;margin-top:32px;">
                <a href="{{dashboardUrl}}" style="display:inline-block;padding:14px 40px;background-color:#2563eb;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:10px;">
                  Go to Dashboard →
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #2a2a2e;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#52525b;">
                ${appName} — Generated by <a href="https://genesis-platform.com" style="color:#60a5fa;text-decoration:none;">Genesis Platform</a>
              </p>
              <p style="margin:0;font-size:11px;color:#3f3f46;">
                If you didn't create this account, please ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Welcome to ${appName}! 🚀

Thanks for signing up! We're excited to have you on board. ${appName} helps you manage your ${entityLower} operations seamlessly.

Here's what you can do right away:
• Create your first ${entityLower} — Set up your initial ${entityLower} in under 2 minutes.
• Invite your team — Collaborate with your colleagues in real time.
• Customize your workspace — Tailor settings to match your workflow.

Get started: {{dashboardUrl}}

${appName} — Generated by Genesis Platform
If you didn't create this account, please ignore this email.`;

  return { name: "Welcome Email", subject, html, text };
}

function generateStatusChangeEmail(entities: GeneratedEntity[], domain: string): EmailTemplate {
  const appName = serviceName(domain);
  const entityName = primaryEntityName(entities);
  const entityLower = entityName.toLowerCase();
  const subject = `Your ${entityLower} status has been updated — {{newStatus}}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0b;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#141416;border-radius:16px;border:1px solid #2a2a2e;overflow:hidden;">
          <!-- Status Banner -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;">
              <div style="display:inline-block;padding:8px 20px;background-color:{{statusColor}};border-radius:999px;">
                <span style="font-size:14px;font-weight:600;color:#ffffff;text-transform:uppercase;">{{newStatus}}</span>
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:0 40px 32px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;text-align:center;">
                ${entityName} Status Updated
              </h1>
              <p style="margin:0 0 12px;font-size:15px;color:#a1a1aa;line-height:1.6;text-align:center;">
                The status of <strong style="color:#e4e4e7;">{{${entityLower}Name}}</strong> has been changed.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background-color:#1c1c1f;border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#71717a;">Previous Status</td>
                        <td style="padding:6px 0;font-size:13px;color:#e4e4e7;text-align:right;">{{previousStatus}}</td>
                      </tr>
                      <tr><td colspan="2" style="border-bottom:1px solid #2a2a2e;"></td></tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#71717a;">New Status</td>
                        <td style="padding:6px 0;font-size:13px;color:#e4e4e7;text-align:right;font-weight:600;">{{newStatus}}</td>
                      </tr>
                      <tr><td colspan="2" style="border-bottom:1px solid #2a2a2e;"></td></tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#71717a;">Updated By</td>
                        <td style="padding:6px 0;font-size:13px;color:#e4e4e7;text-align:right;">{{updatedBy}}</td>
                      </tr>
                      <tr><td colspan="2" style="border-bottom:1px solid #2a2a2e;"></td></tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#71717a;">Updated At</td>
                        <td style="padding:6px 0;font-size:13px;color:#e4e4e7;text-align:right;">{{updatedAt}}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <div style="text-align:center;margin-top:28px;">
                <a href="{{detailsUrl}}" style="display:inline-block;padding:12px 32px;background-color:#2563eb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">
                  View Details →
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #2a2a2e;text-align:center;">
              <p style="margin:0;font-size:12px;color:#52525b;">
                ${appName} — Generated by <a href="https://genesis-platform.com" style="color:#60a5fa;text-decoration:none;">Genesis Platform</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${entityName} Status Updated: {{newStatus}}

The status of {{${entityLower}Name}} has been changed.

• Previous Status: {{previousStatus}}
• New Status: {{newStatus}}
• Updated By: {{updatedBy}}
• Updated At: {{updatedAt}}

View details: {{detailsUrl}}

${appName} — Generated by Genesis Platform`;

  return { name: "Status Change Notification", subject, html, text };
}

function generateActionRequiredEmail(entities: GeneratedEntity[], domain: string, endpoints: GeneratedEndpoint[]): EmailTemplate {
  const appName = serviceName(domain);

  // Find approval-related endpoints to contextualize
  const approvalEp = endpoints.find(ep => ep.path.includes("approv") || ep.description.toLowerCase().includes("approv"));
  const actionName = approvalEp ? "Approval Required" : "Action Required";

  const subject = `⚡ ${actionName} — {{actionTitle}}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0b;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#141416;border-radius:16px;border:1px solid #2a2a2e;overflow:hidden;">
          <!-- Alert Banner -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;">
              <div style="display:inline-block;padding:8px 20px;background-color:rgba(245,158,11,0.15);border-radius:999px;border:1px solid rgba(245,158,11,0.3);">
                <span style="font-size:14px;font-weight:600;color:#fbbf24;">⚠️ ${actionName}</span>
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:0 40px 32px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff;text-align:center;">
                {{actionTitle}}
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#a1a1aa;line-height:1.6;text-align:center;">
                {{actionDescription}}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1c1c1f;border-radius:12px;border-left:3px solid #f59e0b;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Requested By</p>
                    <p style="margin:0;font-size:14px;color:#e4e4e7;">{{requestedBy}}</p>
                  </td>
                </tr>
                <tr><td style="border-bottom:1px solid #2a2a2e;"></td></tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Priority</p>
                    <p style="margin:0;font-size:14px;color:#e4e4e7;">{{priority}}</p>
                  </td>
                </tr>
                <tr><td style="border-bottom:1px solid #2a2a2e;"></td></tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Due Date</p>
                    <p style="margin:0;font-size:14px;color:#e4e4e7;">{{dueDate}}</p>
                  </td>
                </tr>
              </table>
              <div style="text-align:center;margin-top:28px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="text-align:center;">
                      <a href="{{approveUrl}}" style="display:inline-block;padding:14px 36px;background-color:#16a34a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;margin:0 6px;">
                        ✓ Approve
                      </a>
                      <a href="{{rejectUrl}}" style="display:inline-block;padding:14px 36px;background-color:#dc2626;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;margin:0 6px;">
                        ✗ Reject
                      </a>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #2a2a2e;text-align:center;">
              <p style="margin:0;font-size:12px;color:#52525b;">
                ${appName} — Generated by <a href="https://genesis-platform.com" style="color:#60a5fa;text-decoration:none;">Genesis Platform</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `⚠️ ${actionName}: {{actionTitle}}

{{actionDescription}}

• Requested By: {{requestedBy}}
• Priority: {{priority}}
• Due Date: {{dueDate}}

Approve: {{approveUrl}}
Reject: {{rejectUrl}}

${appName} — Generated by Genesis Platform`;

  return { name: "Action Required Notification", subject, html, text };
}

function generateDigestEmail(entities: GeneratedEntity[], domain: string): EmailTemplate {
  const appName = serviceName(domain);
  const entityName = primaryEntityName(entities);
  const subject = `📊 Your ${appName} Weekly Digest`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0b;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#141416;border-radius:16px;border:1px solid #2a2a2e;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">📊 Weekly Digest</h1>
              <p style="margin:8px 0 0;font-size:14px;color:#71717a;">{{dateRange}}</p>
            </td>
          </tr>
          <!-- KPI Cards -->
          <tr>
            <td style="padding:24px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" style="padding:0 6px;">
                    <div style="background-color:#1c1c1f;border-radius:12px;padding:16px;text-align:center;">
                      <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;">New ${entityName}s</p>
                      <p style="margin:0;font-size:28px;font-weight:700;color:#60a5fa;">{{newCount}}</p>
                      <p style="margin:4px 0 0;font-size:11px;color:{{newTrendColor}};">{{newTrend}}</p>
                    </div>
                  </td>
                  <td width="33%" style="padding:0 6px;">
                    <div style="background-color:#1c1c1f;border-radius:12px;padding:16px;text-align:center;">
                      <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;">Completed</p>
                      <p style="margin:0;font-size:28px;font-weight:700;color:#34d399;">{{completedCount}}</p>
                      <p style="margin:4px 0 0;font-size:11px;color:{{completedTrendColor}};">{{completedTrend}}</p>
                    </div>
                  </td>
                  <td width="33%" style="padding:0 6px;">
                    <div style="background-color:#1c1c1f;border-radius:12px;padding:16px;text-align:center;">
                      <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;">Pending</p>
                      <p style="margin:0;font-size:28px;font-weight:700;color:#fbbf24;">{{pendingCount}}</p>
                      <p style="margin:4px 0 0;font-size:11px;color:{{pendingTrendColor}};">{{pendingTrend}}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Activity List -->
          <tr>
            <td style="padding:28px 40px 32px;">
              <h3 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#e4e4e7;">Recent Activity</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                {{#each recentActivity}}
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #2a2a2e;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:14px;color:#e4e4e7;">{{this.title}}</td>
                        <td style="font-size:12px;color:#52525b;text-align:right;">{{this.time}}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                {{/each}}
              </table>
              <div style="text-align:center;margin-top:24px;">
                <a href="{{dashboardUrl}}" style="display:inline-block;padding:12px 32px;background-color:#2563eb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">
                  View Full Report →
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #2a2a2e;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#52525b;">
                ${appName} — Generated by <a href="https://genesis-platform.com" style="color:#60a5fa;text-decoration:none;">Genesis Platform</a>
              </p>
              <p style="margin:0;font-size:11px;color:#3f3f46;">
                <a href="{{unsubscribeUrl}}" style="color:#52525b;">Unsubscribe</a> from digest emails.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `📊 ${appName} Weekly Digest — {{dateRange}}

Summary:
• New ${entityName}s: {{newCount}} ({{newTrend}})
• Completed: {{completedCount}} ({{completedTrend}})
• Pending: {{pendingCount}} ({{pendingTrend}})

Recent Activity:
{{#each recentActivity}}
  • {{this.title}} — {{this.time}}
{{/each}}

View full report: {{dashboardUrl}}

${appName} — Generated by Genesis Platform
Unsubscribe: {{unsubscribeUrl}}`;

  return { name: "Weekly Digest Email", subject, html, text };
}

// ── Notification Service Generator ─────────────────────────────────────────────

function generateNotificationServiceCode(_entities: GeneratedEntity[], domain: string): string {
  const appName = serviceName(domain);

  return `/**
 * NotificationService
 *
 * Central notification dispatch service supporting:
 *   - Email delivery (SMTP, SendGrid, Resend)
 *   - Push notifications (FCM, APNs, Web Push)
 *   - In-app notifications (WebSocket, SSE, Polling)
 *   - Webhook dispatch (Slack, Teams, Discord, custom)
 *   - Template rendering with variable substitution
 *   - Queue/batch support
 *
 * Generated for: ${appName}
 */

import { Notification, NotificationTemplate, NotificationPreferences } from "./notification-types";

// ── Types ──────────────────────────────────────────────────────────────

export type EmailProvider = "smtp" | "sendgrid" | "resend" | "ses";
export type PushProvider = "fcm" | "apns" | "webpush";
export type WebhookTarget = "slack" | "teams" | "discord" | "custom";

export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  template?: string;
  variables?: Record<string, string>;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
  replyTo?: string;
  tags?: string[];
  scheduledAt?: Date;
}

export interface SendPushOptions {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  icon?: string;
  badge?: number;
  image?: string;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  tag?: string;
  ttl?: number;
  priority?: "normal" | "high";
}

export interface SendInAppOptions {
  userId: string;
  type: "info" | "warning" | "success" | "error";
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

export interface WebhookPayload {
  target: WebhookTarget;
  url?: string;
  title: string;
  message: string;
  color?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  actions?: Array<{ text: string; url: string; style?: "primary" | "danger" }>;
}

export interface BatchJob {
  id: string;
  type: "email" | "push" | "inapp" | "webhook";
  payloads: unknown[];
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
  totalCount: number;
  completedCount: number;
  failedCount: number;
}

// ── Service Configuration ──────────────────────────────────────────────

interface NotificationServiceConfig {
  email: {
    provider: EmailProvider;
    smtp?: { host: string; port: number; user: string; pass: string };
    sendgridApiKey?: string;
    resendApiKey?: string;
    fromAddress: string;
    fromName: string;
    replyTo?: string;
  };
  push: {
    provider: PushProvider;
    fcmServerKey?: string;
    apnsKeyId?: string;
    apnsTeamId?: string;
    apnsKeyPath?: string;
    vapidKeys?: { publicKey: string; privateKey: string };
  };
  inapp: {
    delivery: "websocket" | "sse" | "polling";
    wsPort?: number;
  };
  webhooks: {
    slackWebhookUrl?: string;
    teamsWebhookUrl?: string;
    discordWebhookUrl?: string;
  };
  queue?: {
    enabled: boolean;
    concurrency: number;
    retryAttempts: number;
    retryDelayMs: number;
  };
}

// ── Template Engine ────────────────────────────────────────────────────

/**
 * Render a template string by replacing {{variable}} placeholders
 * with values from the variables object.
 */
function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\\{\\{([^}]+)\\}\\}/g, (match, key) => {
    const trimmed = key.trim();
    return variables[trimmed] ?? match;
  });
}

/**
 * Simple Handlebars-like {{#each}} block handler.
 * Supports: {{#each items}}...{{this.property}}...{{/each}}
 */
function renderEachBlock(template: string, variables: Record<string, unknown>): string {
  return template.replace(
    /\\{\\{#each\\s+(\\w+)\\}\\}([\\s\\S]*?)\\{\\{\\/each\\}\\}/g,
    (match, arrayKey, blockTemplate) => {
      const items = variables[arrayKey];
      if (!Array.isArray(items)) return "";
      return items
        .map((item) => {
          return blockTemplate.replace(/\\{\\{this\\.(\\w+)\\}\\}/g, (_, prop) => {
            return String(item[prop] ?? "");
          });
        })
        .join("");
    }
  );
}

function renderFull(template: string, variables: Record<string, unknown>): string {
  let result = renderEachBlock(template, variables);
  result = renderTemplate(result, variables as Record<string, string>);
  return result;
}

// ── NotificationService Class ──────────────────────────────────────────

export class NotificationService {
  private config: NotificationServiceConfig;
  private queue: BatchJob[] = [];
  private processing = false;

  constructor(config: Partial<NotificationServiceConfig> = {}) {
    this.config = {
      email: {
        provider: "resend",
        fromAddress: "noreply@${slugify(domain)}.com",
        fromName: "${appName}",
        ...config.email,
      },
      push: {
        provider: "webpush",
        ...config.push,
      },
      inapp: {
        delivery: "polling",
        ...config.inapp,
      },
      webhooks: {
        ...config.webhooks,
      },
      queue: {
        enabled: true,
        concurrency: 5,
        retryAttempts: 3,
        retryDelayMs: 1000,
        ...config.queue,
      },
    };
  }

  // ── Email ────────────────────────────────────────────────────────

  /**
   * Send an email using the configured provider.
   */
  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { to, subject, html, text, variables, template } = options;

    // Render template with variables
    let finalHtml = html;
    let finalText = text || html.replace(/<[^>]*>/g, "");
    let finalSubject = subject;

    if (variables) {
      finalHtml = renderTemplate(finalHtml, variables);
      finalText = renderTemplate(finalText, variables);
      finalSubject = renderTemplate(finalSubject, variables);
    }

    // If using a named template, substitute content
    if (template) {
      finalSubject = renderTemplate(template + " - " + subject, variables || {});
    }

    try {
      switch (this.config.email.provider) {
        case "resend": {
          if (!this.config.email.resendApiKey) throw new Error("Resend API key not configured");
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": \`Bearer \${this.config.email.resendApiKey}\`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: \`\${this.config.email.fromName} <\${this.config.email.fromAddress}>\`,
              to: Array.isArray(to) ? to : [to],
              cc: options.cc,
              bcc: options.bcc,
              subject: finalSubject,
              html: finalHtml,
              text: finalText,
              reply_to: options.replyTo || this.config.email.replyTo,
              tags: options.tags?.map(t => ({ name: t })),
              scheduled_at: options.scheduledAt?.toISOString(),
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Resend API error");
          return { success: true, messageId: data.id };
        }

        case "sendgrid": {
          if (!this.config.email.sendgridApiKey) throw new Error("SendGrid API key not configured");
          const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              "Authorization": \`Bearer \${this.config.email.sendgridApiKey}\`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [{ to: (Array.isArray(to) ? to : [to]).map(email => ({ email })) }],
              from: { email: this.config.email.fromAddress, name: this.config.email.fromName },
              subject: finalSubject,
              content: [
                { type: "text/html", value: finalHtml },
                { type: "text/plain", value: finalText },
              ],
            }),
          });
          if (!res.ok) throw new Error("SendGrid API error");
          return { success: true, messageId: res.headers.get("x-message-id") || undefined };
        }

        case "smtp": {
          // SMTP implementation using nodemailer pattern
          // Requires: import nodemailer from "nodemailer";
          if (!this.config.email.smtp) throw new Error("SMTP config not set");
          // const transporter = nodemailer.createTransport(this.config.email.smtp);
          // const info = await transporter.sendMail({ ... });
          // return { success: true, messageId: info.messageId };
          console.log("[NotificationService] SMTP (stub):", finalSubject, "→", to);
          return { success: true, messageId: \`smtp-\${Date.now()}\` };
        }

        case "ses": {
          // AWS SES integration stub
          console.log("[NotificationService] SES (stub):", finalSubject, "→", to);
          return { success: true, messageId: \`ses-\${Date.now()}\` };
        }

        default:
          throw new Error(\`Unsupported email provider: \${this.config.email.provider}\`);
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[NotificationService] sendEmail failed:", error);
      return { success: false, error };
    }
  }

  // ── Push Notifications ────────────────────────────────────────────

  /**
   * Send a push notification to a user's device.
   */
  async sendPush(options: SendPushOptions): Promise<{ success: boolean; error?: string }> {
    const { userId, title, body, data, actions, badge, icon, image, tag, ttl, priority } = options;

    try {
      switch (this.config.push.provider) {
        case "webpush": {
          if (!this.config.push.vapidKeys) throw new Error("VAPID keys not configured");
          // Web Push API implementation
          // Requires: import webpush from "web-push";
          // const subscription = await getPushSubscription(userId);
          // const payload = JSON.stringify({ title, body, data, ... });
          // await webpush.sendNotification(subscription, payload, { vapidDetails: { ... } });
          console.log("[NotificationService] Web Push (stub):", title, "→ user:", userId);
          return { success: true };
        }

        case "fcm": {
          if (!this.config.push.fcmServerKey) throw new Error("FCM server key not configured");
          const res = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              "Authorization": \`key=\${this.config.push.fcmServerKey}\`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: \`/topics/user-\${userId}\`,
              notification: { title, body, icon, image, badge, tag },
              data: { ...data, actions: JSON.stringify(actions || []) },
              priority: priority || "high",
              time_to_live: ttl || 86400,
            }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || "FCM API error");
          return { success: true };
        }

        case "apns": {
          // Apple Push Notification Service — stub
          console.log("[NotificationService] APNs (stub):", title, "→ user:", userId);
          return { success: true };
        }

        default:
          throw new Error(\`Unsupported push provider: \${this.config.push.provider}\`);
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[NotificationService] sendPush failed:", error);
      return { success: false, error };
    }
  }

  // ── In-App Notifications ──────────────────────────────────────────

  /**
   * Send an in-app notification visible in the notification center.
   * Persists to database and optionally broadcasts via WebSocket/SSE.
   */
  async sendInApp(options: SendInAppOptions): Promise<{ success: boolean; notificationId?: string; error?: string }> {
    const { userId, type, title, message, link, metadata, expiresAt } = options;

    try {
      // 1. Persist to database
      const notification: Notification = {
        id: \`notif_\${Date.now()}_\${Math.random().toString(36).slice(2, 9)}\`,
        userId,
        type,
        title,
        message,
        link,
        metadata: metadata || {},
        read: false,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt?.toISOString(),
      };

      // await db.insert(notifications).values(notification);

      // 2. Broadcast via configured delivery method
      switch (this.config.inapp.delivery) {
        case "websocket":
          // wsServer.to(userId).emit("notification", notification);
          console.log("[NotificationService] WS broadcast:", notification.id);
          break;
        case "sse":
          // sseClients.get(userId)?.send({ event: "notification", data: JSON.stringify(notification) });
          console.log("[NotificationService] SSE broadcast:", notification.id);
          break;
        case "polling":
        default:
          // Client polls GET /api/notifications
          break;
      }

      return { success: true, notificationId: notification.id };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[NotificationService] sendInApp failed:", error);
      return { success: false, error };
    }
  }

  // ── Webhook Dispatch ──────────────────────────────────────────────

  /**
   * Dispatch a notification to external services (Slack, Teams, Discord).
   */
  async dispatchWebhook(payload: WebhookPayload): Promise<{ success: boolean; error?: string }> {
    const { target, url, title, message, color, fields, actions } = payload;

    try {
      switch (target) {
        case "slack": {
          const webhookUrl = url || this.config.webhooks.slackWebhookUrl;
          if (!webhookUrl) throw new Error("Slack webhook URL not configured");
          const slackPayload = {
            attachments: [{
              color: color || "#2563eb",
              title,
              text: message,
              fields: fields?.map(f => ({ title: f.name, value: f.value, short: f.inline })),
              actions: actions?.map(a => ({
                type: "button",
                text: a.text,
                url: a.url,
                style: a.style || "primary",
              })),
              footer: "${appName} — Notification Service",
              ts: Math.floor(Date.now() / 1000),
            }],
          };
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(slackPayload),
          });
          if (!res.ok) throw new Error(\`Slack webhook returned \${res.status}\`);
          return { success: true };
        }

        case "teams": {
          const webhookUrl = url || this.config.webhooks.teamsWebhookUrl;
          if (!webhookUrl) throw new Error("Teams webhook URL not configured");
          const teamsPayload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            themeColor: (color || "#2563eb").replace("#", ""),
            title,
            text: message,
            sections: fields?.map(f => ({
              facts: [{ name: f.name, value: f.value }],
            })),
            potentialAction: actions?.map(a => ({
              "@type": "OpenUri",
              name: a.text,
              targets: [{ os: "default", uri: a.url }],
            })),
          };
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(teamsPayload),
          });
          if (!res.ok) throw new Error(\`Teams webhook returned \${res.status}\`);
          return { success: true };
        }

        case "discord": {
          const webhookUrl = url || this.config.webhooks.discordWebhookUrl;
          if (!webhookUrl) throw new Error("Discord webhook URL not configured");
          const discordPayload = {
            embeds: [{
              title,
              description: message,
              color: parseInt((color || "#2563eb").replace("#", ""), 16),
              fields: fields?.map(f => ({
                name: f.name,
                value: f.value,
                inline: f.inline || false,
              })),
              footer: { text: "${appName}" },
              timestamp: new Date().toISOString(),
            }],
          };
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(discordPayload),
          });
          if (!res.ok) throw new Error(\`Discord webhook returned \${res.status}\`);
          return { success: true };
        }

        case "custom": {
          if (!url) throw new Error("Custom webhook URL not provided");
          const customPayload = { title, message, color, fields, actions, timestamp: new Date().toISOString() };
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(customPayload),
          });
          if (!res.ok) throw new Error(\`Custom webhook returned \${res.status}\`);
          return { success: true };
        }

        default:
          throw new Error(\`Unsupported webhook target: \${target}\`);
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[NotificationService] dispatchWebhook failed:", error);
      return { success: false, error };
    }
  }

  // ── Queue / Batch ─────────────────────────────────────────────────

  /**
   * Add a notification job to the processing queue.
   */
  async enqueue<T>(
    type: BatchJob["type"],
    payloads: T[]
  ): Promise<BatchJob> {
    const job: BatchJob = {
      id: \`batch_\${Date.now()}\`,
      type,
      payloads,
      status: "queued",
      createdAt: new Date(),
      totalCount: payloads.length,
      completedCount: 0,
      failedCount: 0,
    };
    this.queue.push(job);
    this.processQueue();
    return job;
  }

  /**
   * Process queued jobs asynchronously.
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    const maxConcurrency = this.config.queue?.concurrency || 5;

    while (this.queue.length > 0) {
      const batch = this.queue.map(j => j).slice(0, maxConcurrency);
      this.queue = this.queue.filter(j => !batch.includes(j));

      await Promise.all(
        batch.map(async (job) => {
          job.status = "processing";
          try {
            for (const payload of job.payloads) {
              try {
                switch (job.type) {
                  case "email":
                    await this.sendEmail(payload as SendEmailOptions);
                    break;
                  case "push":
                    await this.sendPush(payload as SendPushOptions);
                    break;
                  case "inapp":
                    await this.sendInApp(payload as SendInAppOptions);
                    break;
                  case "webhook":
                    await this.dispatchWebhook(payload as WebhookPayload);
                    break;
                }
                job.completedCount++;
              } catch {
                job.failedCount++;
              }
            }
            job.status = job.failedCount === 0 ? "completed" : "failed";
            job.completedAt = new Date();
          } catch (err) {
            job.status = "failed";
            job.completedAt = new Date();
          }
        })
      );
    }

    this.processing = false;
  }

  /**
   * Get queue status for monitoring.
   */
  getQueueStatus(): { queued: number; processing: number; completed: BatchJob[] } {
    const queued = this.queue.length;
    const processing = this.processing ? 1 : 0;
    const completed: BatchJob[] = []; // In production, load from DB
    return { queued, processing, completed };
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllRead(userId: string): Promise<void> {
    // await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
    console.log("[NotificationService] Marked all read for user:", userId);
  }

  /**
   * Mark a single notification as read.
   */
  async markRead(notificationId: string): Promise<void> {
    // await db.update(notifications).set({ read: true }).where(eq(notifications.id, notificationId));
    console.log("[NotificationService] Marked read:", notificationId);
  }
}

// ── Singleton Export ──────────────────────────────────────────────────

export const notificationService = new NotificationService();
`;
}

// ── Notification Types Generator ───────────────────────────────────────────────

function generateNotificationTypesCode(): string {
  return `/**
 * Notification Types
 *
 * TypeScript interfaces for the notification system:
 *   Notification — in-app notification record
 *   NotificationTemplate — reusable template definition
 *   NotificationPreferences — per-user delivery preferences
 *
 * Generated by Genesis Platform
 */

// ── Notification ─────────────────────────────────────────────────────

export interface Notification {
  /** Unique identifier */
  id: string;
  /** Recipient user ID */
  userId: string;
  /** Notification type */
  type: "info" | "warning" | "success" | "error";
  /** Short title */
  title: string;
  /** Message body */
  message: string;
  /** Optional deep link within the app */
  link?: string;
  /** Arbitrary metadata */
  metadata: Record<string, unknown>;
  /** Whether the user has read this notification */
  read: boolean;
  /** When the notification was created */
  createdAt: string;
  /** When the user read it */
  readAt?: string;
  /** Optional expiry — notification is hidden after this */
  expiresAt?: string;
}

// ── Notification Template ────────────────────────────────────────────

export interface NotificationTemplate {
  /** Template identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Template category */
  category: "email" | "push" | "inapp";
  /** Email subject (for email templates) */
  subject?: string;
  /** HTML body template with {{variable}} placeholders */
  htmlTemplate?: string;
  /** Plain-text body template */
  textTemplate?: string;
  /** Default variable values */
  defaultVariables: Record<string, string>;
  /** Required variable keys */
  requiredVariables: string[];
  /** Template version */
  version: number;
  /** When the template was last updated */
  updatedAt: string;
}

// ── Notification Preferences ─────────────────────────────────────────

export type DeliveryChannel = "email" | "push" | "inapp";

export interface NotificationPreferences {
  /** User ID */
  userId: string;
  /** Enabled delivery channels */
  channels: DeliveryChannel[];
  /** Category-specific preferences */
  categories: Record<string, {
    enabled: boolean;
    channels: DeliveryChannel[];
    /** Quiet hours — no notifications during this window (UTC) */
    quietHours?: { start: string; end: string };
    /** Maximum notifications per day for this category */
    dailyLimit?: number;
  }>;
  /** Global quiet hours */
  globalQuietHours?: { start: string; end: string };
  /** Do Not Disturb mode */
  dnd: boolean;
  /** Digest mode — bundle notifications into periodic digests */
  digestMode: "immediate" | "hourly" | "daily" | "weekly" | "off";
  /** Webhook URL for custom delivery */
  webhookUrl?: string;
  /** When preferences were last updated */
  updatedAt: string;
}

// ── Default Preferences ──────────────────────────────────────────────

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  userId: "",
  channels: ["email", "inapp"],
  categories: {
    system: { enabled: true, channels: ["email", "inapp"] },
    activity: { enabled: true, channels: ["inapp"] },
    billing: { enabled: true, channels: ["email", "inapp"] },
    marketing: { enabled: true, channels: ["email"] },
    security: { enabled: true, channels: ["email", "push", "inapp"], dailyLimit: 10 },
    social: { enabled: false, channels: ["inapp"] },
  },
  dnd: false,
  digestMode: "daily",
  updatedAt: new Date().toISOString(),
};
`;
}

// ── Notification Store Generator ───────────────────────────────────────────────

function generateNotificationStoreCode(): string {
  return `/**
 * Notification Store
 *
 * Frontend state management for notifications.
 * Uses a lightweight reactive store pattern (works with Zustand, Jotai, or plain React context).
 *
 * Generated by Genesis Platform
 */

import type { Notification, NotificationPreferences, DeliveryChannel } from "./notification-types";

// ── Store Types ──────────────────────────────────────────────────────

interface NotificationState {
  /** All notifications for the current user */
  notifications: Notification[];
  /** Unread count */
  unreadCount: number;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Current filter */
  filter: "all" | "info" | "warning" | "success" | "error" | "unread";
  /** User preferences */
  preferences: NotificationPreferences | null;
}

interface NotificationActions {
  /** Fetch notifications from API */
  fetchNotifications: () => Promise<void>;
  /** Mark a single notification as read */
  markRead: (id: string) => Promise<void>;
  /** Mark all notifications as read */
  markAllRead: () => Promise<void>;
  /** Delete a notification */
  deleteNotification: (id: string) => Promise<void>;
  /** Set the active filter */
  setFilter: (filter: NotificationState["filter"]) => void;
  /** Fetch user preferences */
  fetchPreferences: () => Promise<void>;
  /** Update user preferences */
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
}

export type NotificationStore = NotificationState & NotificationActions;

// ── Store Implementation ─────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * Creates a notification store.
 *
 * Usage with Zustand:
 *   import { create } from "zustand";
 *   const useNotificationStore = create<NotificationStore>((set, get) => createNotificationSlice(set, get));
 *
 * Usage with React Context:
 *   const NotificationContext = createContext<NotificationStore>(null!);
 *   // Wrap with provider using createNotificationSlice
 */
export function createNotificationSlice(
  set: (fn: (state: NotificationState) => Partial<NotificationState>) => void,
  get: () => NotificationState
): NotificationStore {
  return {
    // ── Initial State ──────────────────────────────────────
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    filter: "all",
    preferences: null,

    // ── Fetch Notifications ────────────────────────────────
    fetchNotifications: async () => {
      set(() => ({ loading: true, error: null }));
      try {
        const res = await fetch(\`\${API_BASE}/notifications\`);
        if (!res.ok) throw new Error("Failed to fetch notifications");
        const data: Notification[] = await res.json();
        set(() => ({
          notifications: data,
          unreadCount: data.filter((n) => !n.read).length,
          loading: false,
        }));
      } catch (err) {
        set(() => ({
          error: err instanceof Error ? err.message : "Unknown error",
          loading: false,
        }));
      }
    },

    // ── Mark Single Read ───────────────────────────────────
    markRead: async (id: string) => {
      try {
        await fetch(\`\${API_BASE}/notifications/\${id}/read\`, { method: "PATCH" });
        set((state) => {
          const updated = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n
          );
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          };
        });
      } catch (err) {
        console.error("Failed to mark notification read:", err);
      }
    },

    // ── Mark All Read ──────────────────────────────────────
    markAllRead: async () => {
      try {
        await fetch(\`\${API_BASE}/notifications/read-all\`, { method: "PATCH" });
        set((state) => ({
          notifications: state.notifications.map((n) => ({
            ...n,
            read: true,
            readAt: n.read ? n.readAt : new Date().toISOString(),
          })),
          unreadCount: 0,
        }));
      } catch (err) {
        console.error("Failed to mark all read:", err);
      }
    },

    // ── Delete Notification ────────────────────────────────
    deleteNotification: async (id: string) => {
      try {
        await fetch(\`\${API_BASE}/notifications/\${id}\`, { method: "DELETE" });
        set((state) => {
          const updated = state.notifications.filter((n) => n.id !== id);
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          };
        });
      } catch (err) {
        console.error("Failed to delete notification:", err);
      }
    },

    // ── Set Filter ─────────────────────────────────────────
    setFilter: (filter: NotificationState["filter"]) => {
      set(() => ({ filter }));
    },

    // ── Fetch Preferences ──────────────────────────────────
    fetchPreferences: async () => {
      try {
        const res = await fetch(\`\${API_BASE}/notifications/preferences\`);
        if (!res.ok) throw new Error("Failed to fetch preferences");
        const prefs: NotificationPreferences = await res.json();
        set(() => ({ preferences: prefs }));
      } catch (err) {
        console.error("Failed to fetch preferences:", err);
      }
    },

    // ── Update Preferences ─────────────────────────────────
    updatePreferences: async (partial: Partial<NotificationPreferences>) => {
      try {
        const res = await fetch(\`\${API_BASE}/notifications/preferences\`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(partial),
        });
        if (!res.ok) throw new Error("Failed to update preferences");
        set((state) => ({
          preferences: state.preferences
            ? { ...state.preferences, ...partial, updatedAt: new Date().toISOString() }
            : null,
        }));
      } catch (err) {
        console.error("Failed to update preferences:", err);
      }
    },
  };
}

// ── Filtered Notifications Selector ───────────────────────────────────

/**
 * Derive filtered notifications from the store state.
 */
export function getFilteredNotifications(
  notifications: Notification[],
  filter: NotificationState["filter"]
): Notification[] {
  switch (filter) {
    case "unread":
      return notifications.filter((n) => !n.read);
    case "all":
      return notifications;
    default:
      return notifications.filter((n) => n.type === filter);
  }
}
`;
}

// ── Notification Center Component Generator ────────────────────────────────────

function generateNotificationCenterCode(domain: string): string {
  const appName = serviceName(domain);

  return `/**
 * NotificationCenter Component
 *
 * Bell icon with unread badge, dropdown notification list, and filter controls.
 * Dark-themed React component using Tailwind CSS.
 *
 * Generated for: ${appName}
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Notification, NotificationPreferences } from "./notification-types";
import { getFilteredNotifications } from "./notification-store";

// ── Mock Data (replace with real API calls) ──────────────────────────

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    userId: "user-1",
    type: "success",
    title: "Welcome aboard! 🎉",
    message: "Your account has been created successfully. Start exploring your dashboard.",
    link: "/dashboard",
    metadata: {},
    read: false,
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: "2",
    userId: "user-1",
    type: "info",
    title: "New feature available",
    message: "We've added reporting and analytics to help you track performance.",
    link: "/reports",
    metadata: { feature: "reports" },
    read: false,
    createdAt: new Date(Date.now() - 60 * 60000).toISOString(),
  },
  {
    id: "3",
    userId: "user-1",
    type: "warning",
    title: "Action required",
    message: "Your subscription trial ends in 3 days. Add a payment method to continue.",
    link: "/billing",
    metadata: { trialEnds: new Date(Date.now() + 3 * 86400000).toISOString() },
    read: true,
    createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
    readAt: new Date(Date.now() - 30 * 60000).toISOString(),
  },
  {
    id: "4",
    userId: "user-1",
    type: "error",
    title: "Payment failed",
    message: "Your last invoice payment was declined. Please update your payment method.",
    link: "/billing",
    metadata: { invoiceId: "inv_123" },
    read: true,
    createdAt: new Date(Date.now() - 240 * 60000).toISOString(),
    readAt: new Date(Date.now() - 200 * 60000).toISOString(),
  },
  {
    id: "5",
    userId: "user-1",
    type: "success",
    title: "Report generated",
    message: "Your monthly analytics report is ready for download.",
    link: "/reports/monthly",
    metadata: { reportId: "rpt_456" },
    read: false,
    createdAt: new Date(Date.now() - 360 * 60000).toISOString(),
  },
];

// ── Icons (inline SVGs) ──────────────────────────────────────────────

const BellIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

// ── Time Formatting Helper ───────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return \`\${Math.floor(seconds / 60)}m ago\`;
  if (seconds < 86400) return \`\${Math.floor(seconds / 3600)}h ago\`;
  if (seconds < 604800) return \`\${Math.floor(seconds / 86400)}d ago\`;
  return date.toLocaleDateString();
}

// ── Type Icons & Colors ──────────────────────────────────────────────

const TYPE_CONFIG: Record<Notification["type"], { icon: string; bg: string; border: string; text: string }> = {
  info: {
    icon: "ℹ️",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
  },
  warning: {
    icon: "⚠️",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
  },
  success: {
    icon: "✅",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
  },
  error: {
    icon: "❌",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-400",
  },
};

// ── Filter Tabs ──────────────────────────────────────────────────────

const FILTERS: Array<{ value: NotificationStateFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "info", label: "ℹ️" },
  { value: "warning", label: "⚠️" },
  { value: "success", label: "✅" },
  { value: "error", label: "❌" },
];

type NotificationStateFilter = "all" | "info" | "warning" | "success" | "error" | "unread";

// ── Component ────────────────────────────────────────────────────────

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [filter, setFilter] = useState<NotificationStateFilter>("all");
  const [animatingOut, setAnimatingOut] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = getFilteredNotifications(notifications, filter);

  const handleMarkRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
    );
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.read ? n : { ...n, read: true, readAt: new Date().toISOString() }
      )
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    setAnimatingOut((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setAnimatingOut((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  }, []);

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      if (!notification.read) {
        handleMarkRead(notification.id);
      }
      if (notification.link) {
        // Navigate to the link — use your router
        window.location.href = notification.link;
      }
      setIsOpen(false);
    },
    [handleMarkRead]
  );

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-surface-400 transition-all hover:bg-surface-800 hover:text-surface-200"
        aria-label={\`Notifications\${unreadCount > 0 ? \` (\${unreadCount} unread)\` : ""}\`}
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        {isOpen && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-surface-800 border-l border-t border-white/5" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-3 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-surface-900 shadow-2xl shadow-black/40 z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-surface-100">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-[10px] font-semibold text-brand-400">
                  {unreadCount} new
                </span>
              )}
            </div>
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-surface-400 transition-all hover:bg-surface-800 hover:text-surface-200"
              disabled={unreadCount === 0}
            >
              <CheckIcon className="h-3.5 w-3.5" />
              Mark all read
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 px-4 py-2 border-b border-white/5 overflow-x-auto scrollbar-none">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={\`flex-shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all \${
                  filter === f.value
                    ? "bg-surface-800 text-white"
                    : "text-surface-400 hover:text-surface-200 hover:bg-surface-800/50"
                }\`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
                <BellIcon className="h-10 w-10 text-surface-600 mb-3" />
                <p className="text-sm text-surface-500 font-medium">No notifications</p>
                <p className="text-xs text-surface-600 mt-1">
                  {filter !== "all"
                    ? "No notifications match this filter."
                    : "You're all caught up! 🎉"}
                </p>
              </div>
            ) : (
              <div className="py-1">
                {filtered.map((notification) => {
                  const config = TYPE_CONFIG[notification.type];
                  const isRemoving = animatingOut.has(notification.id);
                  return (
                    <div
                      key={notification.id}
                      className={\`group relative px-5 py-3.5 cursor-pointer transition-all border-b border-white/5 last:border-0 hover:bg-surface-800/50 \${
                        !notification.read ? "bg-surface-800/20" : ""
                      } \${isRemoving ? "opacity-0 translate-x-4 transition-all duration-300" : ""}\`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* Unread dot */}
                      {!notification.read && (
                        <span className="absolute left-2 top-4 h-2 w-2 rounded-full bg-brand-500" />
                      )}
                      <div className="flex gap-3">
                        {/* Type Icon */}
                        <span className={\`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base \${config.bg}\`}>
                          {config.icon}
                        </span>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={\`text-sm font-medium truncate \${
                              !notification.read ? "text-surface-100" : "text-surface-400"
                            }\`}>
                              {notification.title}
                            </p>
                            <span className="text-[10px] text-surface-600 whitespace-nowrap shrink-0 mt-0.5">
                              {timeAgo(notification.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                            <div className="flex gap-1.5 mt-1.5">
                              {Object.entries(notification.metadata)
                                .filter(([, v]) => typeof v === "string" && v.length < 50)
                                .slice(0, 2)
                                .map(([key, value]) => (
                                  <span
                                    key={key}
                                    className="rounded-md bg-surface-800 px-1.5 py-0.5 text-[10px] text-surface-500"
                                  >
                                    {key}: {String(value).slice(0, 30)}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notification.id);
                          }}
                          className="shrink-0 rounded p-1 text-surface-600 opacity-0 group-hover:opacity-100 transition-all hover:text-red-400 hover:bg-red-500/10"
                          aria-label="Delete notification"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 px-5 py-3">
            <a
              href="/notifications"
              className="block rounded-lg bg-surface-800 px-4 py-2 text-center text-xs font-medium text-surface-400 transition-all hover:bg-surface-700 hover:text-surface-200"
            >
              View all notifications →
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
`;
}

// ── Main Generator ─────────────────────────────────────────────────────────────

export function generateNotifications(
  entities: GeneratedEntity[],
  endpoints: GeneratedEndpoint[],
  domain: string = "Application"
): NotificationProject {
  const emailTemplates: EmailTemplate[] = [
    generateWelcomeEmail(entities, domain),
    generateStatusChangeEmail(entities, domain),
    generateActionRequiredEmail(entities, domain, endpoints),
    generateDigestEmail(entities, domain),
  ];

  const notificationService = generateNotificationServiceCode(entities, domain);
  const notificationCenter = generateNotificationCenterCode(domain);
  const notificationTypes = generateNotificationTypesCode();
  const notificationStore = generateNotificationStoreCode();

  return {
    emailTemplates,
    notificationService,
    notificationCenter,
    notificationTypes,
    notificationStore,
  };
}
