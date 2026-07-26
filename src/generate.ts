/**
 * Generation engine for the ASGP Demo.
 * Takes natural language business requirements and produces a structured
 * application blueprint: entities, API endpoints, and frontend component tree.
 *
 * Primary path: OpenAI API (gpt-4o-mini) for intelligent, domain-specific generation.
 * Fallback path: keyword-based domain matching for resilience when the API is unavailable.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface GeneratedEntity {
  name: string;
  fields: GeneratedField[];
}

export interface GeneratedField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface GeneratedEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description: string;
  returns: string;
}

export interface GeneratedComponent {
  name: string;
  type: "layout" | "page" | "feature" | "shared";
  description: string;
  children?: GeneratedComponent[];
}

export interface Relationship {
  from: string;
  to: string;
  type: "one-to-many" | "many-to-one" | "many-to-many";
  foreignKey: string;
  junctionTable?: string;
}

export interface GenerationResult {
  summary: string;
  domain: string;
  entities: GeneratedEntity[];
  endpoints: GeneratedEndpoint[];
  components: GeneratedComponent[];
  relationships: Relationship[];
  sql: string;
  erDiagram: string;
  apiRoutes: string;
}

// ── OpenAI generation (primary path) ────────────────────────────────────────

const OPENAI_SYSTEM_PROMPT = `You are an expert software architect specialized in analyzing business requirements and designing complete enterprise applications.

Given a user's natural language description of a business need, you produce a structured application blueprint in JSON format. Be specific, creative, and thorough — infer a real domain name, design realistic entities with proper field types, RESTful API endpoints that make sense for the domain, and a plausible component tree for the frontend.

Follow these rules:
- "domain": A short, descriptive name for the business domain (e.g. "Hotel & Hospitality", "Healthcare Clinic", "Fleet Management & Logistics")
- "entities": 3-6 core data entities. Each has a "name" (PascalCase singular) and "fields" array.
  - Every entity MUST have an "id" field of type "UUID".
  - Fields should have realistic names (camelCase), appropriate types ("string", "integer", "decimal", "boolean", "date", "datetime", "text", "enum", "JSON", "string[]", "UUID → RelatedEntity"), and a "required" boolean.
  - Use description for enum fields to list possible values, and for FK fields to show the relation.
  - Include proper foreign key references between related entities.
- "endpoints": 6-14 RESTful API endpoints covering full CRUD and domain-specific operations. Each has "method" (GET/POST/PUT/PATCH/DELETE), "path" (starting with /), "description", and "returns" (the response type).
  - Include domain-specific operations beyond basic CRUD (e.g. check-in, approve, assign, search, dashboard).
  - Use consistent plural resource naming.
- "components": 4-10 React components. Each has "name" (PascalCase), "type" (one of: "layout", "page", "feature", "shared"), "description", and optional "children" for layout components.
  - Include at least one layout component with children, several feature components, and page components.
  - Components should reflect what a real app for this domain would need.
- "summary": A 2-3 sentence summary of what was generated, tailored to the user's specific request.

The output MUST be valid JSON with exactly this structure:
{
  "domain": string,
  "entities": [{ "name": string, "fields": [{ "name": string, "type": string, "required": boolean, "description"?: string }] }],
  "endpoints": [{ "method": string, "path": string, "description": string, "returns": string }],
  "components": [{ "name": string, "type": string, "description": string, "children"?: [{ "name": string, "type": string, "description": string }] }],
  "summary": string
}

Return ONLY the JSON object, no markdown code fences, no additional text.`;

async function generateWithOpenAI(input: string): Promise<GenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: OPENAI_SYSTEM_PROMPT },
        { role: "user", content: input },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const rawJson = data.choices?.[0]?.message?.content;
  if (!rawJson) {
    throw new Error("OpenAI returned empty response");
  }

  const parsed = JSON.parse(rawJson) as GenerationResult;

  // Validate and sanitize the response
  return {
    summary: String(parsed.summary || `Generated application blueprint for your requirements.`),
    domain: String(parsed.domain || "Custom Application"),
    entities: Array.isArray(parsed.entities)
      ? parsed.entities.slice(0, 8).map((e) => ({
          name: String(e.name || "Entity"),
          fields: Array.isArray(e.fields)
            ? e.fields.map((f) => ({
                name: String(f.name || "field"),
                type: String(f.type || "string"),
                required: Boolean(f.required),
                description: f.description ? String(f.description) : undefined,
              }))
            : [],
        }))
      : [],
    endpoints: Array.isArray(parsed.endpoints)
      ? parsed.endpoints.slice(0, 16).map((ep) => ({
          method: validateMethod(ep.method),
          path: String(ep.path || "/"),
          description: String(ep.description || ""),
          returns: String(ep.returns || "void"),
        }))
      : [],
    components: Array.isArray(parsed.components)
      ? parsed.components.map((c) => ({
          name: String(c.name || "Component"),
          type: validateComponentType(c.type),
          description: String(c.description || ""),
          children: Array.isArray(c.children)
            ? c.children.map((ch) => ({
                name: String(ch.name || "Child"),
                type: validateComponentType(ch.type),
                description: String(ch.description || ""),
              }))
            : undefined,
        }))
      : [],
    relationships: [],
    sql: "",
    erDiagram: "",
    apiRoutes: "",
  };
}

function validateMethod(m: string): GeneratedEndpoint["method"] {
  const valid = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  const upper = String(m).toUpperCase();
  return valid.includes(upper) ? (upper as GeneratedEndpoint["method"]) : "GET";
}

function validateComponentType(t: string): GeneratedComponent["type"] {
  const valid = ["layout", "page", "feature", "shared"];
  const lower = String(t).toLowerCase();
  return valid.includes(lower) ? (lower as GeneratedComponent["type"]) : "feature";
}

// ── Fallback: keyword-based domain matching ─────────────────────────────────
// (kept intact from the original engine for resilience)

interface DomainTemplate {
  keywords: string[];
  name: string;
  entities: GeneratedEntity[];
  endpoints: GeneratedEndpoint[];
  components: GeneratedComponent[];
}

const DOMAIN_TEMPLATES: Record<string, DomainTemplate> = {
  hotel: {
    keywords: [
      "hotel", "motel", "resort", "inn", "lodging", "accommodation",
      "room booking", "guest check-in", "housekeeping", "hospitality",
      "bed and breakfast",
    ],
    name: "Hotel & Hospitality",
    entities: [
      {
        name: "Guest",
        fields: [
          { name: "id", type: "UUID", required: true, description: "Unique guest identifier" },
          { name: "firstName", type: "string", required: true },
          { name: "lastName", type: "string", required: true },
          { name: "email", type: "string", required: true },
          { name: "phone", type: "string", required: false },
          { name: "idDocument", type: "string", required: false, description: "Passport or ID number" },
          { name: "preferences", type: "JSON", required: false, description: "Room and amenity preferences" },
        ],
      },
      {
        name: "Room",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "roomNumber", type: "string", required: true },
          { name: "type", type: "enum", required: true, description: "single, double, suite, penthouse" },
          { name: "floor", type: "integer", required: true },
          { name: "pricePerNight", type: "decimal", required: true },
          { name: "status", type: "enum", required: true, description: "available, occupied, maintenance, cleaning" },
          { name: "amenities", type: "string[]", required: false, description: "e.g. WiFi, minibar, ocean view" },
        ],
      },
      {
        name: "Booking",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "guestId", type: "UUID → Guest", required: true },
          { name: "roomId", type: "UUID → Room", required: true },
          { name: "checkIn", type: "datetime", required: true },
          { name: "checkOut", type: "datetime", required: true },
          { name: "status", type: "enum", required: true, description: "confirmed, checked-in, checked-out, cancelled" },
          { name: "totalAmount", type: "decimal", required: true },
          { name: "paymentStatus", type: "enum", required: true, description: "pending, paid, refunded" },
        ],
      },
      {
        name: "HousekeepingTask",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "roomId", type: "UUID → Room", required: true },
          { name: "assignedTo", type: "UUID → Staff", required: false },
          { name: "taskType", type: "enum", required: true, description: "cleaning, turndown, deep-clean, inspection" },
          { name: "status", type: "enum", required: true, description: "pending, in-progress, completed" },
          { name: "scheduledAt", type: "datetime", required: true },
          { name: "completedAt", type: "datetime", required: false },
        ],
      },
    ],
    endpoints: [
      { method: "GET", path: "/rooms", description: "List all rooms with availability", returns: "Room[]" },
      { method: "GET", path: "/rooms/:id", description: "Get room details", returns: "Room" },
      { method: "POST", path: "/bookings", description: "Create a new booking", returns: "Booking" },
      { method: "GET", path: "/bookings", description: "List bookings with filters (date, status)", returns: "Booking[]" },
      { method: "PATCH", path: "/bookings/:id/check-in", description: "Check a guest in", returns: "Booking" },
      { method: "PATCH", path: "/bookings/:id/check-out", description: "Check a guest out", returns: "Booking" },
      { method: "GET", path: "/guests", description: "List all guests", returns: "Guest[]" },
      { method: "POST", path: "/guests", description: "Register a new guest", returns: "Guest" },
      { method: "GET", path: "/housekeeping/tasks", description: "List housekeeping tasks by status", returns: "HousekeepingTask[]" },
      { method: "POST", path: "/housekeeping/tasks", description: "Create housekeeping task", returns: "HousekeepingTask" },
      { method: "PATCH", path: "/housekeeping/tasks/:id/complete", description: "Mark task as completed", returns: "HousekeepingTask" },
      { method: "GET", path: "/dashboard/occupancy", description: "Get occupancy dashboard data", returns: "OccupancyStats" },
    ],
    components: [
      { type: "layout", name: "HotelDashboardLayout", description: "Main layout with sidebar nav, top bar with hotel name", children: [
        { type: "shared", name: "SidebarNav", description: "Navigation: Dashboard, Rooms, Bookings, Guests, Housekeeping" },
        { type: "shared", name: "TopBar", description: "Hotel name, notifications bell, user menu" },
      ]},
      { type: "page", name: "DashboardPage", description: "Occupancy rate, revenue chart, today's check-ins/outs, pending tasks" },
      { type: "feature", name: "RoomGrid", description: "Visual grid of rooms colored by status with filters" },
      { type: "feature", name: "BookingCalendar", description: "Calendar view of all bookings with drag-to-extend" },
      { type: "feature", name: "GuestTable", description: "Searchable table of guests with quick-booking action" },
      { type: "feature", name: "HousekeepingBoard", description: "Kanban board: Pending → In Progress → Completed" },
    ],
  },

  hospital: {
    keywords: [
      "hospital", "clinic", "medical", "patient", "doctor", "appointment",
      "healthcare", "health care", "emergency room", "pharmacy", "prescription",
    ],
    name: "Healthcare & Hospital",
    entities: [
      {
        name: "Patient",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "firstName", type: "string", required: true },
          { name: "lastName", type: "string", required: true },
          { name: "dateOfBirth", type: "date", required: true },
          { name: "bloodType", type: "string", required: false },
          { name: "medicalHistory", type: "JSON", required: false },
        ],
      },
      {
        name: "Doctor",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "firstName", type: "string", required: true },
          { name: "lastName", type: "string", required: true },
          { name: "specialization", type: "string", required: true },
          { name: "licenseNumber", type: "string", required: true },
        ],
      },
      {
        name: "Appointment",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "patientId", type: "UUID → Patient", required: true },
          { name: "doctorId", type: "UUID → Doctor", required: true },
          { name: "scheduledAt", type: "datetime", required: true },
          { name: "status", type: "enum", required: true, description: "scheduled, in-progress, completed, cancelled" },
          { name: "notes", type: "text", required: false },
        ],
      },
    ],
    endpoints: [
      { method: "GET", path: "/patients", description: "List patients", returns: "Patient[]" },
      { method: "POST", path: "/patients", description: "Register new patient", returns: "Patient" },
      { method: "GET", path: "/doctors", description: "List doctors by specialization", returns: "Doctor[]" },
      { method: "POST", path: "/appointments", description: "Schedule appointment", returns: "Appointment" },
      { method: "GET", path: "/appointments", description: "List appointments by date/doctor", returns: "Appointment[]" },
    ],
    components: [
      { type: "layout", name: "ClinicDashboardLayout", description: "Sidebar + content layout", children: [
        { type: "shared", name: "Sidebar", description: "Navigation: Patients, Doctors, Appointments, Pharmacy" },
      ]},
      { type: "feature", name: "PatientTable", description: "Searchable patient registry" },
      { type: "feature", name: "AppointmentCalendar", description: "Calendar with appointment slots" },
    ],
  },

  crm: {
    keywords: [
      "crm", "customer relationship", "sales pipeline", "lead management",
      "contact management", "deal tracking", "sales crm", "customer management",
    ],
    name: "CRM & Sales",
    entities: [
      {
        name: "Contact",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "firstName", type: "string", required: true },
          { name: "lastName", type: "string", required: true },
          { name: "email", type: "string", required: true },
          { name: "company", type: "string", required: false },
          { name: "title", type: "string", required: false },
          { name: "tags", type: "string[]", required: false },
        ],
      },
      {
        name: "Deal",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "contactId", type: "UUID → Contact", required: true },
          { name: "name", type: "string", required: true },
          { name: "value", type: "decimal", required: true },
          { name: "stage", type: "enum", required: true, description: "lead, qualified, proposal, negotiation, closed-won, closed-lost" },
          { name: "expectedCloseDate", type: "date", required: false },
        ],
      },
    ],
    endpoints: [
      { method: "GET", path: "/contacts", description: "List contacts with search & filters", returns: "Contact[]" },
      { method: "POST", path: "/contacts", description: "Create contact", returns: "Contact" },
      { method: "GET", path: "/deals", description: "List deals by stage", returns: "Deal[]" },
      { method: "POST", path: "/deals", description: "Create deal", returns: "Deal" },
      { method: "PATCH", path: "/deals/:id/stage", description: "Move deal to next stage", returns: "Deal" },
    ],
    components: [
      { type: "layout", name: "CRMDashboardLayout", description: "Sales-focused layout", children: [] },
      { type: "feature", name: "PipelineBoard", description: "Kanban board: Lead → Qualified → Proposal → Negotiation → Won" },
      { type: "feature", name: "ContactList", description: "Rich contact list with search" },
      { type: "feature", name: "DealCard", description: "Deal summary card with stage indicator" },
    ],
  },

  school: {
    keywords: [
      "school", "university", "college", "academy", "student", "teacher",
      "course", "classroom", "grade", "lms", "learning management",
      "enrollment", "education",
    ],
    name: "Education & School",
    entities: [
      {
        name: "Student",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "firstName", type: "string", required: true },
          { name: "lastName", type: "string", required: true },
          { name: "grade", type: "string", required: true },
          { name: "enrollmentDate", type: "date", required: true },
          { name: "guardianEmail", type: "string", required: false },
        ],
      },
      {
        name: "Course",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "name", type: "string", required: true },
          { name: "teacherId", type: "UUID → Teacher", required: true },
          { name: "schedule", type: "string", required: true },
          { name: "maxStudents", type: "integer", required: true },
        ],
      },
    ],
    endpoints: [
      { method: "GET", path: "/students", description: "List students", returns: "Student[]" },
      { method: "POST", path: "/students", description: "Enroll student", returns: "Student" },
      { method: "GET", path: "/courses", description: "List courses", returns: "Course[]" },
      { method: "POST", path: "/courses/:id/enroll", description: "Enroll student in course", returns: "Enrollment" },
    ],
    components: [
      { type: "layout", name: "SchoolDashboardLayout", description: "Academic layout", children: [] },
      { type: "feature", name: "StudentRoster", description: "Student list by grade/class" },
      { type: "feature", name: "CourseCatalog", description: "Browseable course catalog" },
      { type: "feature", name: "GradeBook", description: "Teacher grade entry interface" },
    ],
  },

  logistics: {
    keywords: [
      "logistics", "shipping", "fleet", "warehouse", "inventory",
      "supply chain", "delivery", "tracking", "dispatch", "transportation", "freight",
    ],
    name: "Logistics & Supply Chain",
    entities: [
      {
        name: "Shipment",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "trackingNumber", type: "string", required: true },
          { name: "origin", type: "string", required: true },
          { name: "destination", type: "string", required: true },
          { name: "status", type: "enum", required: true, description: "pending, in-transit, at-warehouse, out-for-delivery, delivered" },
          { name: "estimatedDelivery", type: "datetime", required: false },
        ],
      },
    ],
    endpoints: [
      { method: "GET", path: "/shipments", description: "List shipments", returns: "Shipment[]" },
      { method: "POST", path: "/shipments", description: "Create shipment", returns: "Shipment" },
      { method: "GET", path: "/shipments/:id/tracking", description: "Get real-time tracking", returns: "TrackingInfo" },
    ],
    components: [
      { type: "layout", name: "LogisticsDashboardLayout", description: "Operations layout", children: [] },
      { type: "feature", name: "ShipmentTracker", description: "Live shipment tracking map" },
      { type: "feature", name: "WarehouseGrid", description: "Inventory slots visual grid" },
    ],
  },

  ecommerce: {
    keywords: [
      "ecommerce", "e-commerce", "shop", "store", "online store", "retail",
      "product catalog", "cart", "checkout", "order management",
    ],
    name: "E-Commerce & Retail",
    entities: [
      {
        name: "Product",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "name", type: "string", required: true },
          { name: "description", type: "text", required: false },
          { name: "price", type: "decimal", required: true },
          { name: "stockQuantity", type: "integer", required: true },
          { name: "category", type: "string", required: true },
          { name: "imageUrls", type: "string[]", required: false },
        ],
      },
      {
        name: "Order",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "customerId", type: "UUID → Customer", required: true },
          { name: "items", type: "OrderItem[]", required: true },
          { name: "status", type: "enum", required: true, description: "pending, confirmed, shipped, delivered, cancelled" },
          { name: "totalAmount", type: "decimal", required: true },
          { name: "placedAt", type: "datetime", required: true },
        ],
      },
    ],
    endpoints: [
      { method: "GET", path: "/products", description: "List products with filters", returns: "Product[]" },
      { method: "POST", path: "/orders", description: "Place order", returns: "Order" },
      { method: "GET", path: "/orders", description: "List orders", returns: "Order[]" },
    ],
    components: [
      { type: "layout", name: "StoreDashboardLayout", description: "E-commerce layout", children: [] },
      { type: "feature", name: "ProductGrid", description: "Product catalog grid" },
      { type: "feature", name: "OrderPipeline", description: "Order status pipeline" },
    ],
  },

  projectManagement: {
    keywords: [
      "project management", "task management", "project", "kanban",
      "scrum", "sprint", "team collaboration", "workflow", "issue tracker", "pm tool",
    ],
    name: "Project Management",
    entities: [
      {
        name: "Project",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "name", type: "string", required: true },
          { name: "description", type: "text", required: false },
          { name: "status", type: "enum", required: true, description: "planning, active, on-hold, completed" },
          { name: "ownerId", type: "UUID → User", required: true },
        ],
      },
      {
        name: "Task",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "projectId", type: "UUID → Project", required: true },
          { name: "title", type: "string", required: true },
          { name: "assigneeId", type: "UUID → User", required: false },
          { name: "status", type: "enum", required: true, description: "todo, in-progress, review, done" },
          { name: "priority", type: "enum", required: true, description: "low, medium, high, urgent" },
        ],
      },
    ],
    endpoints: [
      { method: "GET", path: "/projects", description: "List projects", returns: "Project[]" },
      { method: "POST", path: "/projects", description: "Create project", returns: "Project" },
      { method: "GET", path: "/tasks", description: "List tasks with filters", returns: "Task[]" },
      { method: "POST", path: "/tasks", description: "Create task", returns: "Task" },
      { method: "PATCH", path: "/tasks/:id/status", description: "Update task status", returns: "Task" },
    ],
    components: [
      { type: "layout", name: "ProjectDashboardLayout", description: "Project-focused layout", children: [] },
      { type: "feature", name: "KanbanBoard", description: "Draggable kanban board" },
      { type: "feature", name: "GanttChart", description: "Project timeline gantt chart" },
    ],
  },

  hr: {
    keywords: [
      "hr", "human resources", "employee", "payroll", "recruitment",
      "hiring", "onboarding", "leave management", "attendance", "hrms",
    ],
    name: "HR & Workforce Management",
    entities: [
      {
        name: "Employee",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "firstName", type: "string", required: true },
          { name: "lastName", type: "string", required: true },
          { name: "email", type: "string", required: true },
          { name: "department", type: "string", required: true },
          { name: "position", type: "string", required: true },
          { name: "hireDate", type: "date", required: true },
        ],
      },
      {
        name: "LeaveRequest",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "employeeId", type: "UUID → Employee", required: true },
          { name: "type", type: "enum", required: true, description: "annual, sick, personal, unpaid" },
          { name: "startDate", type: "date", required: true },
          { name: "endDate", type: "date", required: true },
          { name: "status", type: "enum", required: true, description: "pending, approved, rejected" },
        ],
      },
    ],
    endpoints: [
      { method: "GET", path: "/employees", description: "List employees", returns: "Employee[]" },
      { method: "POST", path: "/employees", description: "Add employee", returns: "Employee" },
      { method: "POST", path: "/leave-requests", description: "Submit leave request", returns: "LeaveRequest" },
      { method: "PATCH", path: "/leave-requests/:id/approve", description: "Approve leave", returns: "LeaveRequest" },
    ],
    components: [
      { type: "layout", name: "HRDashboardLayout", description: "HR admin layout", children: [] },
      { type: "feature", name: "EmployeeDirectory", description: "Searchable employee directory" },
      { type: "feature", name: "LeaveCalendar", description: "Calendar showing team leave" },
    ],
  },

  restaurant: {
    keywords: [
      "restaurant", "cafe", "food", "menu", "dining", "table reservation",
      "order", "kitchen", "pos", "delivery food",
    ],
    name: "Restaurant & Food Service",
    entities: [
      {
        name: "MenuItem",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "name", type: "string", required: true },
          { name: "description", type: "text", required: false },
          { name: "price", type: "decimal", required: true },
          { name: "category", type: "enum", required: true, description: "appetizer, main, dessert, drink" },
          { name: "available", type: "boolean", required: true },
        ],
      },
      {
        name: "Order",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "tableNumber", type: "integer", required: true },
          { name: "items", type: "OrderItem[]", required: true },
          { name: "status", type: "enum", required: true, description: "placed, preparing, ready, served, paid" },
          { name: "totalAmount", type: "decimal", required: true },
        ],
      },
    ],
    endpoints: [
      { method: "GET", path: "/menu", description: "Get full menu", returns: "MenuItem[]" },
      { method: "POST", path: "/orders", description: "Place order", returns: "Order" },
      { method: "PATCH", path: "/orders/:id/status", description: "Update order status", returns: "Order" },
    ],
    components: [
      { type: "layout", name: "RestaurantDashboardLayout", description: "Restaurant operations layout", children: [] },
      { type: "feature", name: "MenuEditor", description: "Drag-and-drop menu editor" },
      { type: "feature", name: "OrderQueue", description: "Kitchen order display queue" },
    ],
  },
};

// ── Fallback helpers ────────────────────────────────────────────────────────

function extractCustomEntities(input: string): GeneratedEntity[] {
  const lower = input.toLowerCase();
  const entities: GeneratedEntity[] = [];
  const entityPatterns: { pattern: RegExp; entity: GeneratedEntity }[] = [
    {
      pattern: /\b(invoice|billing|payment)\b.*\b(track|manage|system)\b/i,
      entity: {
        name: "Invoice",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "number", type: "string", required: true, description: "Auto-incrementing invoice number" },
          { name: "customerId", type: "UUID → Customer", required: true },
          { name: "items", type: "InvoiceItem[]", required: true },
          { name: "totalAmount", type: "decimal", required: true },
          { name: "status", type: "enum", required: true, description: "draft, sent, paid, overdue, cancelled" },
          { name: "dueDate", type: "date", required: true },
          { name: "issuedAt", type: "datetime", required: true },
        ],
      },
    },
    {
      pattern: /\b(subscription|recurring|saas|plan)\b/i,
      entity: {
        name: "Subscription",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "customerId", type: "UUID → Customer", required: true },
          { name: "plan", type: "enum", required: true, description: "free, starter, pro, enterprise" },
          { name: "status", type: "enum", required: true, description: "active, past-due, cancelled, expired" },
          { name: "startDate", type: "date", required: true },
          { name: "billingCycle", type: "enum", required: true, description: "monthly, annual" },
        ],
      },
    },
    {
      pattern: /\b(review|rating|feedback)\b/i,
      entity: {
        name: "Review",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "entityId", type: "UUID", required: true },
          { name: "authorId", type: "UUID → User", required: true },
          { name: "rating", type: "integer (1-5)", required: true },
          { name: "comment", type: "text", required: false },
          { name: "createdAt", type: "datetime", required: true },
        ],
      },
    },
    {
      pattern: /\b(notification|alert|reminder)\b/i,
      entity: {
        name: "Notification",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "userId", type: "UUID → User", required: true },
          { name: "type", type: "enum", required: true, description: "info, warning, success, error" },
          { name: "title", type: "string", required: true },
          { name: "message", type: "text", required: true },
          { name: "read", type: "boolean", required: true },
          { name: "createdAt", type: "datetime", required: true },
        ],
      },
    },
    {
      pattern: /\b(report|analytics|dashboard|metrics|kpi)\b/i,
      entity: {
        name: "Report",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "name", type: "string", required: true },
          { name: "type", type: "enum", required: true, description: "sales, financial, performance, custom" },
          { name: "parameters", type: "JSON", required: false },
          { name: "generatedAt", type: "datetime", required: false },
          { name: "createdBy", type: "UUID → User", required: true },
        ],
      },
    },
    {
      pattern: /\b(document|file|attachment|upload)\b.*\b(manage|store|track)\b/i,
      entity: {
        name: "Document",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "name", type: "string", required: true },
          { name: "fileUrl", type: "string", required: true },
          { name: "size", type: "integer", required: true, description: "File size in bytes" },
          { name: "mimeType", type: "string", required: true },
          { name: "uploadedBy", type: "UUID → User", required: true },
          { name: "uploadedAt", type: "datetime", required: true },
        ],
      },
    },
    {
      pattern: /\b(chat|message|conversation|messaging)\b/i,
      entity: {
        name: "Message",
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "conversationId", type: "UUID → Conversation", required: true },
          { name: "senderId", type: "UUID → User", required: true },
          { name: "content", type: "text", required: true },
          { name: "sentAt", type: "datetime", required: true },
          { name: "readAt", type: "datetime", required: false },
        ],
      },
    },
  ];

  for (const { pattern, entity } of entityPatterns) {
    if (pattern.test(lower)) {
      entities.push(entity);
    }
  }

  return entities;
}

function matchDomain(input: string): DomainTemplate | null {
  const lower = input.toLowerCase();
  let bestMatch: { key: string; score: number } | null = null;

  for (const [key, template] of Object.entries(DOMAIN_TEMPLATES)) {
    let score = 0;
    for (const kw of template.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += kw.split(" ").length;
      }
    }
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { key, score };
    }
  }

  return bestMatch ? DOMAIN_TEMPLATES[bestMatch.key] : null;
}

function generateCustomEndpoints(
  domain: DomainTemplate | null,
  customEntities: GeneratedEntity[],
  input: string
): GeneratedEndpoint[] {
  const endpoints: GeneratedEndpoint[] = [];
  const lower = input.toLowerCase();

  if (/\b(login|register|signup|authentication|auth|user account)\b/i.test(lower)) {
    endpoints.push(
      { method: "POST", path: "/auth/login", description: "Authenticate user and return JWT", returns: "AuthToken" },
      { method: "POST", path: "/auth/register", description: "Register new user account", returns: "User" },
      { method: "GET", path: "/auth/me", description: "Get current authenticated user", returns: "User" },
    );
  }

  if (/\b(upload|file|attachment|image)\b/i.test(lower)) {
    endpoints.push(
      { method: "POST", path: "/files/upload", description: "Upload file to storage", returns: "FileInfo" },
    );
  }

  if (/\b(search|find|lookup|query)\b/i.test(lower)) {
    endpoints.push(
      { method: "GET", path: "/search", description: "Global search across entities", returns: "SearchResult[]" },
    );
  }

  if (/\b(export|download|csv|pdf|report)\b/i.test(lower)) {
    endpoints.push(
      { method: "GET", path: "/export/:entity", description: "Export entity data as CSV/PDF", returns: "File" },
    );
  }

  if (/\b(dashboard|overview|analytics|stats|metrics)\b/i.test(lower)) {
    endpoints.push(
      { method: "GET", path: "/dashboard/summary", description: "Get aggregated dashboard metrics", returns: "DashboardSummary" },
    );
  }

  if (/\b(webhook|integration|api|connect)\b/i.test(lower)) {
    endpoints.push(
      { method: "POST", path: "/webhooks", description: "Register a webhook endpoint", returns: "Webhook" },
    );
  }

  if (/\b(role|permission|admin|access control|rbac)\b/i.test(lower)) {
    endpoints.push(
      { method: "GET", path: "/roles", description: "List roles and permissions", returns: "Role[]" },
      { method: "POST", path: "/roles", description: "Create role", returns: "Role" },
      { method: "PATCH", path: "/users/:id/roles", description: "Assign roles to user", returns: "User" },
    );
  }

  return endpoints;
}

function mergeEndpoints(endpoints: GeneratedEndpoint[]): GeneratedEndpoint[] {
  const seen = new Set<string>();
  return endpoints.filter((ep) => {
    const key = `${ep.method}:${ep.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function generateGenericComponents(
  entities: GeneratedEntity[],
  input: string
): GeneratedComponent[] {
  const lower = input.toLowerCase();
  const components: GeneratedComponent[] = [
    {
      type: "layout",
      name: "AppLayout",
      description: "Application shell with responsive sidebar navigation and top header",
      children: [
        { type: "shared", name: "Sidebar", description: "Navigation links and branding" },
        { type: "shared", name: "Header", description: "Search bar, notifications, user menu" },
      ],
    },
  ];

  for (const entity of entities) {
    const name = entity.name;
    const plural = name.endsWith("s") ? name : name + "s";
    components.push({
      type: "page",
      name: `${name}ManagementPage`,
      description: `Full CRUD interface for managing ${plural.toLowerCase()}`,
    });
    components.push({
      type: "feature",
      name: `${name}Table`,
      description: `Sortable, searchable table of ${plural.toLowerCase()}`,
    });
    components.push({
      type: "feature",
      name: `${name}Form`,
      description: `Create/edit form for ${name.toLowerCase()} with validation`,
    });
  }

  if (/\b(dashboard|overview|home)\b/i.test(lower)) {
    components.push({
      type: "page",
      name: "DashboardPage",
      description: "Overview dashboard with key metrics and charts",
    });
  }

  if (/\b(login|auth|signin)\b/i.test(lower)) {
    components.push({
      type: "page",
      name: "LoginPage",
      description: "Authentication page with email/password and social login options",
    });
  }

  return components;
}

function generateSummary(
  domainName: string | null,
  entities: GeneratedEntity[],
  input: string
): string {
  const entityList = entities.map((e) => e.name).join(", ");
  const domainPrefix = domainName ? ` for ${domainName}` : "";

  return `Generated a complete${domainPrefix} application blueprint from your description. The system identified ${entities.length} core data entities (${entityList}) with their relationships, generated RESTful API endpoints for full CRUD operations and business logic, and designed a component tree with layouts, pages, and reusable UI features. This blueprint is ready to be generated into a deployable application.`;
}

// ── Fallback generation function ────────────────────────────────────────────

function generateWithFallback(input: string): GenerationResult {
  const domain = matchDomain(input);
  const customEntities = extractCustomEntities(input);

  const domainEntities = domain ? domain.entities : [];
  const entityNames = new Set(domainEntities.map((e) => e.name.toLowerCase()));
  const uniqueCustomEntities = customEntities.filter(
    (e) => !entityNames.has(e.name.toLowerCase())
  );
  const allEntities = [...domainEntities, ...uniqueCustomEntities];

  if (allEntities.length === 0) {
    const words = input
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !["need", "with", "that", "this", "from", "have", "like", "want", "would", "should", "could", "system", "manage", "track", "platform", "application"].includes(w));

    const uniqueWords = [...new Set(words)].slice(0, 3);
    for (const word of uniqueWords) {
      const entityName = word.charAt(0).toUpperCase() + word.slice(1);
      allEntities.push({
        name: entityName,
        fields: [
          { name: "id", type: "UUID", required: true },
          { name: "name", type: "string", required: true },
          { name: "status", type: "enum", required: true, description: "active, inactive, pending" },
          { name: "createdAt", type: "datetime", required: true },
          { name: "updatedAt", type: "datetime", required: true },
        ],
      });
    }
  }

  const domainEndpoints = domain ? domain.endpoints : [];
  const customEndpoints = generateCustomEndpoints(domain, uniqueCustomEntities, input);
  const allEndpoints = mergeEndpoints([...domainEndpoints, ...customEndpoints]);

  if (allEndpoints.length === 0) {
    for (const entity of allEntities) {
      const name = entity.name.toLowerCase();
      const plural = name.endsWith("s") ? name : name + "s";
      allEndpoints.push(
        { method: "GET", path: `/${plural}`, description: `List all ${plural}`, returns: `${entity.name}[]` },
        { method: "POST", path: `/${plural}`, description: `Create a new ${name}`, returns: entity.name },
        { method: "GET", path: `/${plural}/:id`, description: `Get ${name} by ID`, returns: entity.name },
        { method: "PATCH", path: `/${plural}/:id`, description: `Update ${name}`, returns: entity.name },
        { method: "DELETE", path: `/${plural}/:id`, description: `Delete ${name}`, returns: "void" },
      );
    }
  }

  const components: GeneratedComponent[] =
    domain && domain.components.length > 0
      ? domain.components
      : generateGenericComponents(allEntities, input);

  return {
    summary: generateSummary(domain?.name ?? null, allEntities, input),
    domain: domain?.name ?? "Custom Application",
    entities: allEntities.slice(0, 8),
    endpoints: allEndpoints.slice(0, 16),
    components,
    relationships: [],
    sql: "",
    erDiagram: "",
    apiRoutes: "",
  };
}

// ── Relationship Inference Engine ──────────────────────────────────────────

/**
 * Maps a field type string (as seen in GeneratedField.type) to a SQL column type.
 * Handles FK annotations like "UUID → Guest".
 */
function mapFieldType(type: string): string {
  const lower = type.toLowerCase().trim();

  // FK references: UUID → EntityName — the column itself is UUID
  if (/^uuid\s*→/.test(lower)) return "UUID";

  if (lower === "uuid") return "UUID";
  if (lower === "string" || lower === "email") return "VARCHAR(255)";
  if (lower === "text") return "TEXT";
  if (lower === "integer" || lower === "int" || lower === "number") return "INTEGER";
  if (lower === "decimal" || lower === "float" || lower === "double") return "DECIMAL(10,2)";
  if (lower === "boolean" || lower === "bool") return "BOOLEAN";
  if (lower === "date") return "DATE";
  if (lower === "datetime" || lower === "timestamp") return "TIMESTAMPTZ";
  if (lower === "enum" || lower.startsWith("enum")) return "VARCHAR(255)";
  if (lower === "json" || lower === "jsonb") return "JSONB";
  if (lower === "string[]") return "TEXT[]";
  if (lower.includes("[]")) return "JSONB";
  if (lower.startsWith("uuid →")) return "UUID";
  return "TEXT";
}

/**
 * Analyzes entity field names and types to infer relationships between entities.
 *
 * Detection strategies:
 * 1. Type-based: field type contains "UUID → EntityName"
 * 2. Name-based: field name ends with "Id" or "_id" (e.g., guestId → Guest)
 * 3. Junction-table: an entity with exactly 2 FK fields and ≤5 total fields
 *    is treated as a many-to-many bridge between the two referenced entities.
 */
export function inferRelationships(entities: GeneratedEntity[]): Relationship[] {
  const entityNames = new Set(entities.map((e) => e.name));
  const entityNameLower = new Map<string, string>(); // lowercase → PascalCase
  for (const e of entities) {
    entityNameLower.set(e.name.toLowerCase(), e.name);
  }

  // First pass: collect all individual FK relationships
  interface RawFK {
    owningEntity: string;
    fieldName: string;
    targetEntity: string;
  }

  const rawFKs: RawFK[] = [];

  for (const entity of entities) {
    for (const field of entity.fields) {
      let targetEntity: string | null = null;

      // Strategy 1: type-based detection "UUID → EntityName"
      const typeMatch = field.type.match(/UUID\s*→\s*(\w[\w\s]*\w)/i);
      if (typeMatch) {
        const candidate = typeMatch[1].trim();
        if (entityNameLower.has(candidate.toLowerCase())) {
          targetEntity = entityNameLower.get(candidate.toLowerCase())!;
        }
      }

      // Strategy 2: name-based detection — field ends with "Id" or "_id"
      if (!targetEntity) {
        let base = "";
        if (/_id$/i.test(field.name)) {
          base = field.name.replace(/_id$/i, "");
        } else if (/^[a-z].*Id$/i.test(field.name)) {
          base = field.name.replace(/Id$/i, "");
        }

        if (base) {
          // Try camelCase → PascalCase
          const pascal = base.charAt(0).toUpperCase() + base.slice(1);
          if (entityNameLower.has(base.toLowerCase())) {
            targetEntity = entityNameLower.get(base.toLowerCase())!;
          } else if (entityNameLower.has(pascal.toLowerCase())) {
            targetEntity = entityNameLower.get(pascal.toLowerCase())!;
          } else {
            // Try matching against entity names ignoring case
            for (const en of entityNames) {
              if (en.toLowerCase() === base.toLowerCase()) {
                targetEntity = en;
                break;
              }
            }
          }
        }
      }

      if (targetEntity && targetEntity !== entity.name) {
        rawFKs.push({
          owningEntity: entity.name,
          fieldName: field.name,
          targetEntity,
        });
      }
    }
  }

  // Second pass: detect junction tables and build final relationship list
  const junctionEntities = new Set<string>();
  const relationships: Relationship[] = [];

  for (const entity of entities) {
    const entityFKs = rawFKs.filter((fk) => fk.owningEntity === entity.name);
    const nonPKFields = entity.fields.filter(
      (f) => f.name !== "id" && f.name !== "created_at" && f.name !== "createdAt" && f.name !== "updated_at" && f.name !== "updatedAt"
    );

    // Junction table: exactly 2 FK fields and ≤5 total non-meta fields
    if (entityFKs.length === 2 && nonPKFields.length <= 5) {
      const [fkA, fkB] = entityFKs;
      // Mark this entity as a junction
      junctionEntities.add(entity.name);

      // Add a many-to-many relationship between the two target entities
      relationships.push({
        from: fkA.targetEntity,
        to: fkB.targetEntity,
        type: "many-to-many",
        foreignKey: `${fkA.fieldName},${fkB.fieldName}`,
        junctionTable: entity.name,
      });
    }
  }

  // Add non-junction relationships
  for (const fk of rawFKs) {
    if (junctionEntities.has(fk.owningEntity)) continue;

    // owningEntity has FK to targetEntity
    // → targetEntity (one) to owningEntity (many): one-to-many
    relationships.push({
      from: fk.targetEntity,
      to: fk.owningEntity,
      type: "one-to-many",
      foreignKey: fk.fieldName,
    });
  }

  // Deduplicate
  const seen = new Set<string>();
  return relationships.filter((r) => {
    const key = `${r.from}|${r.to}|${r.type}|${r.foreignKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── SQL DDL Generator ──────────────────────────────────────────────────────

/**
 * Generates PostgreSQL-compatible DDL from entities and inferred relationships.
 */
export function generateSQL(
  entities: GeneratedEntity[],
  relationships: Relationship[]
): string {
  const lines: string[] = [];
  const tableNames = new Set(entities.map((e) => e.name.toLowerCase()));

  for (const entity of entities) {
    const tableName = entity.name.toLowerCase();
    const columns: string[] = [];
    const fkConstraints: string[] = [];

    for (const field of entity.fields) {
      // Skip if already handled as FK with a different name
      const sqlType = mapFieldType(field.type);
      const notNull = field.required ? " NOT NULL" : "";

      if (field.name === "id") {
        columns.push(`  id UUID PRIMARY KEY DEFAULT gen_random_uuid()`);
        continue;
      }

      // Check if this field is a foreign key
      const rel = relationships.find(
        (r) =>
          r.foreignKey === field.name &&
          r.to.toLowerCase() === entity.name.toLowerCase()
      );

      if (rel && rel.type === "one-to-many") {
        columns.push(`  ${field.name} UUID${notNull}`);
        fkConstraints.push(
          `  CONSTRAINT fk_${tableName}_${field.name} FOREIGN KEY (${field.name}) REFERENCES ${rel.from.toLowerCase()}(id)`
        );
      } else if (rel && rel.type === "many-to-many") {
        // For junction tables, FK is a comma-separated pair
        const fkParts = rel.foreignKey.split(",");
        for (const fkPart of fkParts) {
          const trimmed = fkPart.trim();
          if (trimmed === field.name) {
            columns.push(`  ${field.name} UUID${notNull}`);
            // Find the target table for this FK
            const otherFKs = fkParts.filter((p) => p.trim() !== field.name);
            // Determine which target entity this FK points to
            const targetA = rel.from.toLowerCase();
            const targetB = rel.to.toLowerCase();
            // The FK name should help: guest_id → Guest, booking_id → Booking
            const fkBase = trimmed.replace(/_id$/i, "").replace(/Id$/i, "");
            let refTable: string;
            if (fkBase.toLowerCase() === targetA || fkBase === rel.from) {
              refTable = targetA;
            } else if (fkBase.toLowerCase() === targetB || fkBase === rel.to) {
              refTable = targetB;
            } else {
              refTable = targetA; // fallback
            }
            fkConstraints.push(
              `  CONSTRAINT fk_${tableName}_${trimmed} FOREIGN KEY (${trimmed}) REFERENCES ${refTable}(id)`
            );
          }
        }
      } else {
        columns.push(`  ${field.name} ${sqlType}${notNull}`);
      }
    }

    // Add timestamps
    columns.push("  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");
    columns.push("  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");

    const allColumns = [...columns, ...fkConstraints];
    lines.push(`CREATE TABLE ${tableName} (`);
    lines.push(allColumns.join(",\n"));
    lines.push(");\n");
  }

  return lines.join("\n");
}

// ── ER Diagram Generator (Mermaid.js) ──────────────────────────────────────

/**
 * Produces a Mermaid.js erDiagram string for visual ER rendering.
 */
export function generateERDiagram(
  entities: GeneratedEntity[],
  relationships: Relationship[]
): string {
  const lines: string[] = ["erDiagram"];

  // Emit entities with their fields
  for (const entity of entities) {
    const entityName = entity.name;
    lines.push(`  ${entityName} {`);
    for (const field of entity.fields) {
      const sqlType = mapFieldType(field.type);
      const pkSuffix = field.name === "id" ? " PK" : "";
      const fkSuffix = relationships.some(
        (r) =>
          r.foreignKey.includes(field.name) &&
          r.type !== "many-to-many" &&
          r.to === entityName
      )
        ? " FK"
        : "";
      lines.push(`    ${sqlType} ${field.name}${pkSuffix}${fkSuffix}`);
    }
    lines.push("  }\n");
  }

  // Emit relationships
  for (const rel of relationships) {
    if (rel.type === "one-to-many") {
      // from (one) ||--o{ to (many)
      lines.push(`  ${rel.from} ||--o{ ${rel.to} : "has"`);
    } else if (rel.type === "many-to-one") {
      lines.push(`  ${rel.from} }o--|| ${rel.to} : "belongs to"`);
    } else if (rel.type === "many-to-many") {
      // Many-to-many: both sides have many
      lines.push(`  ${rel.from} }o--o{ ${rel.to} : "many-to-many"`);
    }
  }

  return lines.join("\n");
}

// ── API Routes Generator (Bun/Hono + Zod) ──────────────────────────────────

/**
 * Simple English pluralization for entity → route segment.
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
 * Maps a GeneratedField type string to a Zod validator expression.
 */
function typeToZod(field: GeneratedField): string {
  const t = field.type.toLowerCase().trim();

  // FK references resolve to UUID
  if (/^uuid\s*→/.test(t)) return "z.string().uuid()";

  if (t === "uuid") return "z.string().uuid()";
  if (t === "string") return "z.string()";
  if (t === "email") return "z.string().email()";
  if (t === "text") return "z.string()";
  if (t === "integer" || t === "int") return "z.number().int()";
  if (t === "number") return "z.number()";
  if (t === "decimal" || t === "float" || t === "double") return "z.number()";
  if (t === "boolean" || t === "bool") return "z.boolean()";
  if (t === "date") return "z.string()";
  if (t === "datetime" || t === "timestamp") return "z.string()";
  if (t === "enum" || t.startsWith("enum")) return "z.string()";
  if (t === "json") return "z.record(z.any())";
  if (t === "string[]") return "z.array(z.string())";
  if (t.includes("[]")) return "z.array(z.any())";
  return "z.string()";
}

/**
 * Maps a GeneratedField type to a TypeScript type string for interfaces.
 */
function typeToTS(field: GeneratedField): string {
  const t = field.type.toLowerCase().trim();
  if (/^uuid\s*→/.test(t)) return "string";
  if (t === "uuid") return "string";
  if (t === "string" || t === "email") return "string";
  if (t === "text") return "string";
  if (t === "integer" || t === "int" || t === "number") return "number";
  if (t === "decimal" || t === "float" || t === "double") return "number";
  if (t === "boolean" || t === "bool") return "boolean";
  if (t === "date" || t === "datetime" || t === "timestamp") return "string";
  if (t === "enum" || t.startsWith("enum")) return "string";
  if (t === "json") return "Record<string, unknown>";
  if (t === "string[]") return "string[]";
  if (t.includes("[]")) return "unknown[]";
  return "string";
}

/**
 * Determines which entity an endpoint belongs to by matching path segments.
 * Returns the entity name and the action type.
 */
function classifyEndpoint(
  ep: GeneratedEndpoint,
  entities: GeneratedEntity[]
): { entityName: string | null; isCrud: boolean; crudAction: string | null; isDomainSpecific: boolean } {
  const path = ep.path.toLowerCase();
  const parts = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  const resource = parts[0] || "";

  // Find matching entity by pluralized name
  let matchedEntity: string | null = null;
  for (const entity of entities) {
    const plural = pluralize(entity.name).toLowerCase();
    if (resource === plural) {
      matchedEntity = entity.name;
      break;
    }
    // Also check singular
    if (resource === entity.name.toLowerCase()) {
      matchedEntity = entity.name;
      break;
    }
  }

  if (!matchedEntity) return { entityName: null, isCrud: false, crudAction: null, isDomainSpecific: false };

  // Determine if CRUD or domain-specific
  const isList = parts.length === 1 && ep.method === "GET";
  const isGetById = parts.length === 2 && parts[1] === ":id" && ep.method === "GET";
  const isCreate = parts.length === 1 && ep.method === "POST";
  const isUpdate = parts.length === 2 && parts[1] === ":id" && (ep.method === "PATCH" || ep.method === "PUT");
  const isDelete = parts.length === 2 && parts[1] === ":id" && ep.method === "DELETE";

  if (isList) return { entityName: matchedEntity, isCrud: true, crudAction: "list", isDomainSpecific: false };
  if (isGetById) return { entityName: matchedEntity, isCrud: true, crudAction: "get", isDomainSpecific: false };
  if (isCreate) return { entityName: matchedEntity, isCrud: true, crudAction: "create", isDomainSpecific: false };
  if (isUpdate) return { entityName: matchedEntity, isCrud: true, crudAction: "update", isDomainSpecific: false };
  if (isDelete) return { entityName: matchedEntity, isCrud: true, crudAction: "delete", isDomainSpecific: false };

  // Domain-specific: has an extra segment (action) after :id
  if (parts.length >= 3 && parts[1] === ":id") {
    return { entityName: matchedEntity, isCrud: false, crudAction: null, isDomainSpecific: true };
  }

  return { entityName: matchedEntity, isCrud: false, crudAction: null, isDomainSpecific: true };
}

/**
 * Generates a complete Bun/Hono API routes file with TypeScript interfaces,
 * Zod validation schemas, repository pattern, and full CRUD + domain routes.
 */
export function generateAPIRoutes(
  entities: GeneratedEntity[],
  endpoints: GeneratedEndpoint[],
  _relationships: Relationship[]
): string {
  const lines: string[] = [];

  // ── Header ──
  lines.push(`/**`);
  lines.push(` * Generated API Routes — ${entities.length > 0 ? entities.map(e => e.name).join(", ") : "Custom"} Domain`);
  lines.push(` * `);
  lines.push(` * Framework: Bun + Hono`);
  lines.push(` * Validation: Zod`);
  lines.push(` * Pattern: Repository + Router`);
  lines.push(` * `);
  lines.push(` * Generated by Genesis Platform ASGP Engine`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`import { Hono } from "hono";`);
  lines.push(`import { z } from "zod";`);
  lines.push(`import { zValidator } from "@hono/zod-validator";`);
  lines.push(``);
  lines.push(`// ── Database client stub ─────────────────────────────────────────────────`);
  lines.push(`// Replace with your actual database client (Drizzle, Prisma, Kysely, etc.)`);
  lines.push(`const db = {`);
  lines.push(`  query: async (sql: string, params?: unknown[]) => {`);
  lines.push(`    // In production: pool.query(sql, params)`);
  lines.push(`    console.debug("[db] query:", sql, params);`);
  lines.push(`    return { rows: [] as Record<string, unknown>[] };`);
  lines.push(`  },`);
  lines.push(`  queryOne: async (sql: string, params?: unknown[]) => {`);
  lines.push(`    const result = await db.query(sql, params);`);
  lines.push(`    return result.rows[0] ?? null;`);
  lines.push(`  },`);
  lines.push(`  execute: async (sql: string, params?: unknown[]) => {`);
  lines.push(`    await db.query(sql, params);`);
  lines.push(`  },`);
  lines.push(`};`);
  lines.push(``);

  // ── TypeScript Interfaces ──
  lines.push(`// ── TypeScript Interfaces ─────────────────────────────────────────────────`);
  for (const entity of entities) {
    lines.push(`interface ${entity.name} {`);
    for (const field of entity.fields) {
      const optional = field.required ? "" : "?";
      lines.push(`  ${field.name}${optional}: ${typeToTS(field)};`);
    }
    lines.push(`  createdAt: string;`);
    lines.push(`  updatedAt: string;`);
    lines.push(`}`);
    lines.push(``);
  }

  // ── Zod Schemas ──
  lines.push(`// ── Zod Validation Schemas ────────────────────────────────────────────────`);
  for (const entity of entities) {
    const nonPkFields = entity.fields.filter((f) => f.name !== "id" && f.name !== "createdAt" && f.name !== "created_at" && f.name !== "updatedAt" && f.name !== "updated_at");

    // Create schema: all required non-PK fields
    const createFields: string[] = [];
    for (const field of nonPkFields) {
      const zod = typeToZod(field);
      const expr = field.required ? zod : `${zod}.optional()`;
      createFields.push(`  ${field.name}: ${expr},`);
    }
    if (createFields.length > 0) {
      lines.push(`const create${entity.name}Schema = z.object({`);
      lines.push(...createFields);
      lines.push(`});`);
      lines.push(``);
    }

    // Update schema: all non-PK fields optional
    const updateFields: string[] = [];
    for (const field of nonPkFields) {
      updateFields.push(`  ${field.name}: ${typeToZod(field)}.optional(),`);
    }
    if (updateFields.length > 0) {
      lines.push(`const update${entity.name}Schema = z.object({`);
      lines.push(...updateFields);
      lines.push(`});`);
      lines.push(``);
    }
  }

  // ── Repository Layer ──
  lines.push(`// ── Repository Layer ──────────────────────────────────────────────────────`);
  lines.push(`// Each repository encapsulates data access for one entity using`);
  lines.push(`// parameterized SQL queries referencing the generated tables.`);
  lines.push(``);

  for (const entity of entities) {
    const tableName = entity.name.toLowerCase();
    const idField = entity.fields.find(f => f.name === "id") ? "id" : "id";
    const columnNames = entity.fields.map(f => f.name);
    const insertColumns = columnNames.filter(n => n !== "id" && n !== "createdAt" && n !== "created_at" && n !== "updatedAt" && n !== "updated_at");

    lines.push(`const ${entity.name.toLowerCase()}Repository = {`);
    lines.push(`  findAll: async (params?: { limit?: number; offset?: number }) => {`);
    lines.push(`    const limit = params?.limit ?? 50;`);
    lines.push(`    const offset = params?.offset ?? 0;`);
    lines.push(`    const result = await db.query(`);
    lines.push(`      \`SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT $\{limit} OFFSET $\{offset}\`,`);
    lines.push(`      [limit, offset]`);
    lines.push(`    );`);
    lines.push(`    return result.rows as ${entity.name}[];`);
    lines.push(`  },`);
    lines.push(``);
    lines.push(`  findById: async (id: string) => {`);
    lines.push(`    const result = await db.queryOne(`);
    lines.push(`      \`SELECT * FROM ${tableName} WHERE ${idField} = $1\`,`);
    lines.push(`      [id]`);
    lines.push(`    );`);
    lines.push(`    return result as ${entity.name} | null;`);
    lines.push(`  },`);
    lines.push(``);

    if (insertColumns.length > 0) {
      lines.push(`  create: async (data: Omit<${entity.name}, "id" | "createdAt" | "updatedAt">) => {`);
      lines.push(`    const columns = [${insertColumns.map(c => `"${c}"`).join(", ")}];`);
      lines.push(`    const values = [${insertColumns.map(c => `data.${c}`).join(", ")}];`);
      lines.push(`    const ph = values.map((_, i) => \`$\${i + 1}\`).join(", ");`);
      lines.push(`    const result = await db.queryOne(`);
      lines.push(`      \`INSERT INTO ${tableName} ($\{columns.join(", ")}) VALUES ($\{ph}) RETURNING *\`,`);
      lines.push(`      values`);
      lines.push(`    );`);
      lines.push(`    return result as ${entity.name};`);
      lines.push(`  },`);
      lines.push(``);
    }

    if (insertColumns.length > 0) {
      lines.push(`  update: async (id: string, data: Partial<Omit<${entity.name}, "id" | "createdAt" | "updatedAt">>) => {`);
      lines.push(`    const keys = Object.keys(data) as (keyof typeof data)[];`);
      lines.push(`    if (keys.length === 0) return null;`);
      lines.push(`    const sets = keys.map((k, i) => \`"$\{String(k)}" = $\${i + 2}\`).join(", ");`);
      lines.push(`    const values = [id, ...keys.map(k => data[k])];`);
      lines.push(`    const result = await db.queryOne(`);
      lines.push(`      \`UPDATE ${tableName} SET $\{sets}, updated_at = NOW() WHERE ${idField} = $1 RETURNING *\`,`);
      lines.push(`      values`);
      lines.push(`    );`);
      lines.push(`    return result as ${entity.name} | null;`);
      lines.push(`  },`);
      lines.push(``);
    }

    lines.push(`  delete: async (id: string) => {`);
    lines.push(`    const result = await db.queryOne(`);
    lines.push(`      \`DELETE FROM ${tableName} WHERE ${idField} = $1 RETURNING ${idField}\`,`);
    lines.push(`      [id]`);
    lines.push(`    );`);
    lines.push(`    return result !== null;`);
    lines.push(`  },`);
    lines.push(`};`);
    lines.push(``);
  }

  // ── Router ──
  lines.push(`// ── Router ────────────────────────────────────────────────────────────────`);
  lines.push(`const router = new Hono();`);
  lines.push(``);

  // Group endpoints by entity
  for (const entity of entities) {
    const entityName = entity.name;
    const plural = pluralize(entityName);
    const repoVar = `${entityName.toLowerCase()}Repository`;
    const hasCreateSchema = entity.fields.some(f => f.name !== "id" && f.name !== "createdAt" && f.name !== "created_at" && f.name !== "updatedAt" && f.name !== "updated_at");
    const hasUpdateSchema = hasCreateSchema;

    lines.push(`// ── ${entityName} routes ──`);

    // Find endpoints for this entity
    const entityEndpoints = endpoints.filter(ep => {
      const classification = classifyEndpoint(ep, entities);
      return classification.entityName === entityName;
    });

    // Generate CRUD routes if endpoints exist
    const hasListEp = entityEndpoints.some(ep => classifyEndpoint(ep, entities).crudAction === "list");
    const hasGetEp = entityEndpoints.some(ep => classifyEndpoint(ep, entities).crudAction === "get");
    const hasCreateEp = entityEndpoints.some(ep => classifyEndpoint(ep, entities).crudAction === "create");
    const hasUpdateEp = entityEndpoints.some(ep => classifyEndpoint(ep, entities).crudAction === "update");
    const hasDeleteEp = entityEndpoints.some(ep => classifyEndpoint(ep, entities).crudAction === "delete");

    // LIST
    if (hasListEp) {
      lines.push(`// GET /api/${plural.toLowerCase()} — List all ${plural.toLowerCase()}`);
      lines.push(`router.get("/api/${plural.toLowerCase()}", async (c) => {`);
      lines.push(`  try {`);
      lines.push(`    const limit = parseInt(c.req.query("limit") ?? "50", 10);`);
      lines.push(`    const offset = parseInt(c.req.query("offset") ?? "0", 10);`);
      lines.push(`    const items = await ${repoVar}.findAll({ limit, offset });`);
      lines.push(`    return c.json({ data: items, count: items.length, limit, offset });`);
      lines.push(`  } catch (error) {`);
      lines.push(`    console.error("[${plural}] List error:", error);`);
      lines.push(`    return c.json({ error: "Failed to fetch ${plural.toLowerCase()}" }, 500);`);
      lines.push(`  }`);
      lines.push(`});`);
      lines.push(``);
    }

    // GET BY ID
    if (hasGetEp) {
      lines.push(`// GET /api/${plural.toLowerCase()}/:id — Get ${entityName.toLowerCase()} by ID`);
      lines.push(`router.get("/api/${plural.toLowerCase()}/:id", async (c) => {`);
      lines.push(`  try {`);
      lines.push(`    const id = c.req.param("id");`);
      lines.push(`    if (!id || typeof id !== "string") {`);
      lines.push(`      return c.json({ error: "Invalid ID parameter" }, 400);`);
      lines.push(`    }`);
      lines.push(`    const item = await ${repoVar}.findById(id);`);
      lines.push(`    if (!item) {`);
      lines.push(`      return c.json({ error: "${entityName} not found" }, 404);`);
      lines.push(`    }`);
      lines.push(`    return c.json({ data: item });`);
      lines.push(`  } catch (error) {`);
      lines.push(`    console.error("[${plural}] Get error:", error);`);
      lines.push(`    return c.json({ error: "Failed to fetch ${entityName.toLowerCase()}" }, 500);`);
      lines.push(`  }`);
      lines.push(`});`);
      lines.push(``);
    }

    // CREATE
    if (hasCreateEp && hasCreateSchema) {
      lines.push(`// POST /api/${plural.toLowerCase()} — Create a new ${entityName.toLowerCase()}`);
      lines.push(`router.post("/api/${plural.toLowerCase()}", zValidator("json", create${entityName}Schema), async (c) => {`);
      lines.push(`  try {`);
      lines.push(`    const data = c.req.valid("json");`);
      lines.push(`    const item = await ${repoVar}.create(data as Omit<${entityName}, "id" | "createdAt" | "updatedAt">);`);
      lines.push(`    return c.json({ data: item }, 201);`);
      lines.push(`  } catch (error) {`);
      lines.push(`    console.error("[${plural}] Create error:", error);`);
      lines.push(`    return c.json({ error: "Failed to create ${entityName.toLowerCase()}" }, 500);`);
      lines.push(`  }`);
      lines.push(`});`);
      lines.push(``);
    } else if (hasCreateEp) {
      lines.push(`// POST /api/${plural.toLowerCase()} — Create a new ${entityName.toLowerCase()}`);
      lines.push(`router.post("/api/${plural.toLowerCase()}", async (c) => {`);
      lines.push(`  try {`);
      lines.push(`    const data = await c.req.json();`);
      lines.push(`    const item = await ${repoVar}.create(data as Omit<${entityName}, "id" | "createdAt" | "updatedAt">);`);
      lines.push(`    return c.json({ data: item }, 201);`);
      lines.push(`  } catch (error) {`);
      lines.push(`    console.error("[${plural}] Create error:", error);`);
      lines.push(`    return c.json({ error: "Failed to create ${entityName.toLowerCase()}" }, 500);`);
      lines.push(`  }`);
      lines.push(`});`);
      lines.push(``);
    }

    // UPDATE
    if (hasUpdateEp && hasUpdateSchema) {
      lines.push(`// PATCH /api/${plural.toLowerCase()}/:id — Update ${entityName.toLowerCase()}`);
      lines.push(`router.patch("/api/${plural.toLowerCase()}/:id", zValidator("json", update${entityName}Schema), async (c) => {`);
      lines.push(`  try {`);
      lines.push(`    const id = c.req.param("id");`);
      lines.push(`    const data = c.req.valid("json");`);
      lines.push(`    if (!id || typeof id !== "string") {`);
      lines.push(`      return c.json({ error: "Invalid ID parameter" }, 400);`);
      lines.push(`    }`);
      lines.push(`    // Verify the record exists`);
      lines.push(`    const existing = await ${repoVar}.findById(id);`);
      lines.push(`    if (!existing) {`);
      lines.push(`      return c.json({ error: "${entityName} not found" }, 404);`);
      lines.push(`    }`);
      lines.push(`    const item = await ${repoVar}.update(id, data);`);
      lines.push(`    return c.json({ data: item });`);
      lines.push(`  } catch (error) {`);
      lines.push(`    console.error("[${plural}] Update error:", error);`);
      lines.push(`    return c.json({ error: "Failed to update ${entityName.toLowerCase()}" }, 500);`);
      lines.push(`  }`);
      lines.push(`});`);
      lines.push(``);
    } else if (hasUpdateEp) {
      lines.push(`// PATCH /api/${plural.toLowerCase()}/:id — Update ${entityName.toLowerCase()}`);
      lines.push(`router.patch("/api/${plural.toLowerCase()}/:id", async (c) => {`);
      lines.push(`  try {`);
      lines.push(`    const id = c.req.param("id");`);
      lines.push(`    const data = await c.req.json();`);
      lines.push(`    if (!id || typeof id !== "string") {`);
      lines.push(`      return c.json({ error: "Invalid ID parameter" }, 400);`);
      lines.push(`    }`);
      lines.push(`    const existing = await ${repoVar}.findById(id);`);
      lines.push(`    if (!existing) {`);
      lines.push(`      return c.json({ error: "${entityName} not found" }, 404);`);
      lines.push(`    }`);
      lines.push(`    const item = await ${repoVar}.update(id, data);`);
      lines.push(`    return c.json({ data: item });`);
      lines.push(`  } catch (error) {`);
      lines.push(`    console.error("[${plural}] Update error:", error);`);
      lines.push(`    return c.json({ error: "Failed to update ${entityName.toLowerCase()}" }, 500);`);
      lines.push(`  }`);
      lines.push(`});`);
      lines.push(``);
    }

    // DELETE
    if (hasDeleteEp) {
      lines.push(`// DELETE /api/${plural.toLowerCase()}/:id — Delete ${entityName.toLowerCase()}`);
      lines.push(`router.delete("/api/${plural.toLowerCase()}/:id", async (c) => {`);
      lines.push(`  try {`);
      lines.push(`    const id = c.req.param("id");`);
      lines.push(`    if (!id || typeof id !== "string") {`);
      lines.push(`      return c.json({ error: "Invalid ID parameter" }, 400);`);
      lines.push(`    }`);
      lines.push(`    const existing = await ${repoVar}.findById(id);`);
      lines.push(`    if (!existing) {`);
      lines.push(`      return c.json({ error: "${entityName} not found" }, 404);`);
      lines.push(`    }`);
      lines.push(`    await ${repoVar}.delete(id);`);
      lines.push(`    return c.json({ success: true }, 200);`);
      lines.push(`  } catch (error) {`);
      lines.push(`    console.error("[${plural}] Delete error:", error);`);
      lines.push(`    return c.json({ error: "Failed to delete ${entityName.toLowerCase()}" }, 500);`);
      lines.push(`  }`);
      lines.push(`});`);
      lines.push(``);
    }

    // Domain-specific endpoints
    for (const ep of entityEndpoints) {
      const classification = classifyEndpoint(ep, entities);
      if (!classification.isDomainSpecific) continue;

      const pathParts = ep.path.replace(/^\/api\//, "").split("/").filter(Boolean);
      const action = pathParts.length >= 3 ? pathParts[pathParts.length - 1] : ep.description.replace(/\s+/g, "-").toLowerCase();
      const pascalAction = action
        .split(/[-_]/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join("");

      lines.push(`// ${ep.method} ${ep.path} — ${ep.description}`);
      lines.push(`router.${ep.method.toLowerCase()}("${ep.path}", async (c) => {`);
      lines.push(`  try {`);
      lines.push(`    const id = c.req.param("id");`);
      lines.push(`    if (!id || typeof id !== "string") {`);
      lines.push(`      return c.json({ error: "Invalid ID parameter" }, 400);`);
      lines.push(`    }`);
      lines.push(`    `);
      lines.push(`    const item = await ${repoVar}.findById(id);`);
      lines.push(`    if (!item) {`);
      lines.push(`      return c.json({ error: "${entityName} not found" }, 404);`);
      lines.push(`    }`);
      lines.push(`    `);
      lines.push(`    // Domain-specific logic for: ${ep.description}`);
      if (ep.method === "POST" || ep.method === "PATCH" || ep.method === "PUT") {
        lines.push(`    const body = await c.req.json().catch(() => ({}));`);
        lines.push(`    await db.execute(`);
        lines.push(`      \`UPDATE ${entityName.toLowerCase()} SET status = $1, updated_at = NOW() WHERE id = $2\`,`);
        lines.push(`      ["${action}", id]`);
        lines.push(`    );`);
      } else {
        lines.push(`    // Execute the domain operation`);
        lines.push(`    await db.execute(`);
        lines.push(`      \`SELECT handle_${action}($1)\`,`);
        lines.push(`      [id]`);
        lines.push(`    );`);
      }
      lines.push(`    `);
      lines.push(`    const updated = await ${repoVar}.findById(id);`);
      lines.push(`    return c.json({ data: updated });`);
      lines.push(`  } catch (error) {`);
      lines.push(`    console.error("[${plural}] ${pascalAction} error:", error);`);
      lines.push(`    return c.json({ error: "Failed to process ${action} for ${entityName.toLowerCase()}" }, 500);`);
      lines.push(`  }`);
      lines.push(`});`);
      lines.push(``);
    }
  }

  // Non-entity endpoints (dashboard, auth, etc.)
  const orphanEndpoints = endpoints.filter(ep => {
    const classification = classifyEndpoint(ep, entities);
    return classification.entityName === null;
  });

  if (orphanEndpoints.length > 0) {
    lines.push(`// ── Additional Domain Routes ──`);
    for (const ep of orphanEndpoints) {
      const cleanPath = ep.path.replace(/^\/api\//, "");
      const routePath = ep.path.startsWith("/api/") ? ep.path : `/api/${cleanPath.replace(/^\//, "")}`;
      const handlerName = cleanPath.replace(/[^a-zA-Z0-9]/g, "_");

      lines.push(`// ${ep.method} ${routePath} — ${ep.description}`);
      lines.push(`router.${ep.method.toLowerCase()}("${routePath}", async (c) => {`);
      lines.push(`  try {`);
      if (ep.method === "GET") {
        lines.push(`    // ${ep.description}`);
        lines.push(`    const result = await db.query(\`SELECT * FROM ${handlerName}\`);`);
        lines.push(`    return c.json({ data: result.rows });`);
      } else if (ep.method === "POST") {
        lines.push(`    const body = await c.req.json();`);
        lines.push(`    // ${ep.description}`);
        lines.push(`    return c.json({ data: body, message: "${ep.description}" }, 201);`);
      } else {
        lines.push(`    // ${ep.description}`);
        lines.push(`    return c.json({ success: true });`);
      }
      lines.push(`  } catch (error) {`);
      lines.push(`    console.error("[${handlerName}] Error:", error);`);
      lines.push(`    return c.json({ error: "Operation failed" }, 500);`);
      lines.push(`  }`);
      lines.push(`});`);
      lines.push(``);
    }
  }

  // ── Health check ──
  lines.push(`// ── Health Check ──────────────────────────────────────────────────────────`);
  lines.push(`router.get("/api/health", (c) => {`);
  lines.push(`  return c.json({ status: "ok", timestamp: new Date().toISOString() });`);
  lines.push(`});`);
  lines.push(``);

  // ── Export ──
  lines.push(`export default router;`);
  lines.push(``);

  return lines.join("\n");
}

function attachSchemaArtifacts(result: GenerationResult): GenerationResult {
  const relationships = inferRelationships(result.entities);
  const sql = generateSQL(result.entities, relationships);
  const erDiagram = generateERDiagram(result.entities, relationships);
  const apiRoutes = generateAPIRoutes(
    result.entities,
    result.endpoints,
    relationships
  );
  return { ...result, relationships, sql, erDiagram, apiRoutes };
}

// ── Main generation function ───────────────────────────────────────────────

export async function generateBlueprint(input: string): Promise<GenerationResult> {
  // Try OpenAI first; fall back to keyword matching on any failure
  try {
    const result = await generateWithOpenAI(input);
    return attachSchemaArtifacts(result);
  } catch (err) {
    // Log the error for debugging but don't expose to the user
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[generate] OpenAI generation failed, using fallback:", message);
    return attachSchemaArtifacts(generateWithFallback(input));
  }
}

// ── Waitlist store (file-based persistence) ─────────────────────────────────

export interface WaitlistEntry {
  email: string;
  joinedAt: string;
}

const WAITLIST_PATH = "./data/waitlist.json";

async function loadWaitlist(): Promise<WaitlistEntry[]> {
  try {
    const file = Bun.file(WAITLIST_PATH);
    if (!(await file.exists())) {
      return [];
    }
    const text = await file.text();
    if (!text.trim()) {
      return [];
    }
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      console.warn("[waitlist] Corrupted waitlist file — not an array. Resetting.");
      return [];
    }
    return parsed.filter(
      (e): e is WaitlistEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof e.email === "string" &&
        typeof e.joinedAt === "string"
    );
  } catch (err) {
    console.warn("[waitlist] Failed to read waitlist file, starting fresh:", err);
    return [];
  }
}

async function saveWaitlist(entries: WaitlistEntry[]): Promise<void> {
  await Bun.write(WAITLIST_PATH, JSON.stringify(entries, null, 2) + "\n");
}

export async function addToWaitlist(
  email: string
): Promise<{ success: boolean; message: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { success: false, message: "Please enter a valid email address." };
  }

  const entries = await loadWaitlist();

  if (entries.some((e) => e.email === normalized)) {
    return { success: false, message: "This email is already on the waitlist." };
  }

  entries.push({ email: normalized, joinedAt: new Date().toISOString() });
  await saveWaitlist(entries);

  return { success: true, message: "You're on the list! We'll be in touch soon." };
}

export async function getWaitlistEntries(): Promise<WaitlistEntry[]> {
  return loadWaitlist();
}
