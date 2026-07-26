import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  useState,
  useRef,
  useEffect,
  type FormEvent,
} from "react";
import {
  generateBlueprint,
  addToWaitlist,
  type GenerationResult,
} from "~/generate";
import { generateProjectZip } from "~/zip-generator";

// ── Server Functions ───────────────────────────────────────────────────────

const submitGeneration = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null || !("input" in data))
      throw new Error("Invalid request");
    return data as { input: string };
  })
  .handler(async ({ data }) => {
    // Simulate processing delay for realism
    await new Promise((r) => setTimeout(r, 1200));
    return generateBlueprint(data.input);
  });

const submitWaitlist = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null || !("email" in data))
      throw new Error("Invalid request");
    return data as { email: string };
  })
  .handler(async ({ data }) => {
    return await addToWaitlist(data.email);
  });

const downloadZip = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null)
      throw new Error("Invalid request");
    return data as GenerationResult;
  })
  .handler(async ({ data }) => {
    return await generateProjectZip(data);
  });

// ── Route definition ──────────────────────────────────────────────────────

export const Route = createFileRoute("/")({
  component: Home,
});

// ── Types for demo state ──────────────────────────────────────────────────

type DemoState = "idle" | "loading" | "done" | "error";

// ── Industry card data ────────────────────────────────────────────────────

const INDUSTRIES = [
  {
    icon: "🏨",
    title: "Hotel & Hospitality",
    desc: "Booking systems, room management, housekeeping tracking, guest portals, and front-desk operations.",
    color: "from-amber-500/20 to-orange-500/20 border-amber-500/30",
    iconBg: "bg-amber-500/10 text-amber-400",
  },
  {
    icon: "🏥",
    title: "Healthcare & Hospital",
    desc: "Patient records, appointment scheduling, prescription management, and clinical workflows.",
    color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30",
    iconBg: "bg-emerald-500/10 text-emerald-400",
  },
  {
    icon: "📊",
    title: "CRM & Sales",
    desc: "Pipeline tracking, contact management, deal forecasting, and automated follow-ups.",
    color: "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
    iconBg: "bg-blue-500/10 text-blue-400",
  },
  {
    icon: "🎓",
    title: "Education & Schools",
    desc: "Student enrollment, grade books, course scheduling, LMS, and parent portals.",
    color: "from-purple-500/20 to-violet-500/20 border-purple-500/30",
    iconBg: "bg-purple-500/10 text-purple-400",
  },
  {
    icon: "🚚",
    title: "Logistics & Supply Chain",
    desc: "Fleet tracking, warehouse management, inventory control, and delivery dispatch.",
    color: "from-rose-500/20 to-pink-500/20 border-rose-500/30",
    iconBg: "bg-rose-500/10 text-rose-400",
  },
  {
    icon: "🛒",
    title: "E-Commerce & Retail",
    desc: "Product catalogs, shopping carts, order management, and payment processing.",
    color: "from-sky-500/20 to-indigo-500/20 border-sky-500/30",
    iconBg: "bg-sky-500/10 text-sky-400",
  },
  {
    icon: "📋",
    title: "Project Management",
    desc: "Kanban boards, Gantt charts, sprint planning, time tracking, and team collaboration.",
    color: "from-lime-500/20 to-green-500/20 border-lime-500/30",
    iconBg: "bg-lime-500/10 text-lime-400",
  },
  {
    icon: "👥",
    title: "HR & Workforce",
    desc: "Employee directories, leave management, payroll processing, and recruitment pipelines.",
    color: "from-fuchsia-500/20 to-pink-500/20 border-fuchsia-500/30",
    iconBg: "bg-fuchsia-500/10 text-fuchsia-400",
  },
];

// ── Example prompts for the demo ──────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  "I need a hotel booking system with room management, guest check-in, and housekeeping tracking",
  "Build a patient management system for a clinic with appointment scheduling and medical records",
  "Create a CRM with contact management, deal pipeline, and email integration",
  "I want a school management platform with student enrollment, courses, and grade tracking",
];

// ── Tab types for results ─────────────────────────────────────────────────

type ResultTab = "entities" | "endpoints" | "components" | "schema" | "apiroutes" | "database" | "backend" | "frontend" | "dashboard" | "deploy" | "workflows" | "reports" | "permissions";

// ── Animated typing placeholder ───────────────────────────────────────────

function TypingPlaceholder() {
  const [text, setText] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const prompt = EXAMPLE_PROMPTS[promptIndex];
    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (charIndex < prompt.length) {
            setText(prompt.slice(0, charIndex + 1));
            setCharIndex(charIndex + 1);
          } else {
            setTimeout(() => setIsDeleting(true), 2000);
          }
        } else {
          if (charIndex > 0) {
            setText(prompt.slice(0, charIndex - 1));
            setCharIndex(charIndex - 1);
          } else {
            setIsDeleting(false);
            setPromptIndex((promptIndex + 1) % EXAMPLE_PROMPTS.length);
          }
        }
      },
      isDeleting ? 25 : 40
    );
    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, promptIndex]);

  return (
    <span className="pointer-events-none text-surface-500">
      {text}
      <span className="animate-pulse text-brand-400">|</span>
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

function Home() {
  const [demoInput, setDemoInput] = useState("");
  const [demoState, setDemoState] = useState<DemoState>("idle");
  const [demoResult, setDemoResult] = useState<GenerationResult | null>(null);
  const [demoError, setDemoError] = useState("");
  const [activeTab, setActiveTab] = useState<ResultTab>("entities");
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [waitlistMessage, setWaitlistMessage] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [apiRoutesCopied, setApiRoutesCopied] = useState(false);
  const [dbExpandedSection, setDbExpandedSection] = useState<string>("docker");
  const [dbCopied, setDbCopied] = useState<string | null>(null);
  const [backendExpandedSection, setBackendExpandedSection] = useState<string>("structure");
  const [frontendExpandedSection, setFrontendExpandedSection] = useState<string>("structure");
  const [backendCopied, setBackendCopied] = useState<string | null>(null);
  const [frontendCopied, setFrontendCopied] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [dashboardCopied, setDashboardCopied] = useState(false);
  const [deployExpandedSection, setDeployExpandedSection] = useState<string>("dockerfile");
  const [deployCopied, setDeployCopied] = useState<string | null>(null);
  const [workflowsExpandedSection, setWorkflowsExpandedSection] = useState<string>("stateMachines");
  const [workflowsCopied, setWorkflowsCopied] = useState<string | null>(null);
  const [reportsExpandedSection, setReportsExpandedSection] = useState<string>("summary");
  const [reportsCopied, setReportsCopied] = useState<string | null>(null);
  const [permissionsExpandedSection, setPermissionsExpandedSection] = useState<string>("roles");
  const [permissionsCopied, setPermissionsCopied] = useState<string | null>(null);

  const demoRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Render Mermaid ER diagram when the schema tab becomes active
  useEffect(() => {
    if (activeTab === "schema" && demoResult?.erDiagram) {
      const container = document.getElementById("er-diagram-container");
      if (!container) return;

      const renderDiagram = async () => {
        try {
          const mermaid = (window as any).mermaid;
          if (!mermaid) {
            // Mermaid CDN hasn't loaded yet — retry
            setTimeout(renderDiagram, 200);
            return;
          }
          mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            themeVariables: {
              primaryColor: "#6366f1",
              primaryTextColor: "#e2e8f0",
              primaryBorderColor: "#4f46e5",
              lineColor: "#818cf8",
              secondaryColor: "#1e293b",
              tertiaryColor: "#0f172a",
            },
          });
          // Use a unique ID each time to avoid cached render
          const id = "er-diagram-" + Date.now();
          const { svg } = await mermaid.render(id, demoResult.erDiagram);
          container.innerHTML = svg;
        } catch (err) {
          console.warn("Mermaid render failed:", err);
          container.innerHTML =
            '<p class="text-surface-500 text-sm p-4">Could not render ER diagram. The SQL DDL is available below.</p>';
        }
      };

      // Small delay to ensure the DOM is ready
      const timer = setTimeout(renderDiagram, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab, demoResult]);

  const scrollToDemo = () => {
    demoRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!demoInput.trim()) return;

    setDemoState("loading");
    setDemoError("");
    setDemoResult(null);

    try {
      const result = await submitGeneration({ data: { input: demoInput } });
      setDemoResult(result);
      setDemoState("done");
      setActiveTab("entities");
      setExpandedEntity(null);
      // Scroll to results after render
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } catch (err) {
      setDemoError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
      setDemoState("error");
    }
  };

  const handleWaitlist = async (e: FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail.trim()) return;

    setWaitlistStatus("submitting");
    try {
      const result = await submitWaitlist({ data: { email: waitlistEmail } });
      setWaitlistStatus(result.success ? "success" : "error");
      setWaitlistMessage(result.message);
      if (result.success) setWaitlistEmail("");
    } catch {
      setWaitlistStatus("error");
      setWaitlistMessage("Something went wrong. Please try again.");
    }
  };

  const handleDownload = async () => {
    if (!demoResult || isDownloading) return;
    setIsDownloading(true);
    try {
      const base64 = await downloadZip({ data: demoResult });
      // Convert base64 to blob and trigger download
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const domainSlug = demoResult.domain
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${domainSlug}-project.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const useExample = (prompt: string) => {
    setDemoInput(prompt);
    demoRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-dvh bg-surface-950 text-surface-100">
      {/* ── Navigation ──────────────────────────────────────── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "border-b border-white/5 bg-surface-950/80 backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#" className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
              G
            </span>
            <span className="hidden sm:inline">Genesis</span>
          </a>
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={scrollToDemo}
              className="hidden sm:block text-surface-400 transition-colors hover:text-white"
            >
              Demo
            </button>
            <a
              href="#waitlist"
              className="hidden sm:block text-surface-400 transition-colors hover:text-white"
            >
              Waitlist
            </a>
            <button
              onClick={scrollToDemo}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-brand-400 hover:glow"
            >
              Try the Demo
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative flex min-h-dvh flex-col items-center justify-center px-6 pt-24 pb-16">
        {/* Background gradient */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-brand-500/10 blur-[120px]" />
          <div className="absolute top-1/3 right-0 h-[400px] w-[500px] rounded-full bg-purple-500/8 blur-[100px]" />
          <div className="absolute bottom-0 left-0 h-[400px] w-[500px] rounded-full bg-blue-500/6 blur-[100px]" />
        </div>

        <div className="relative z-10 flex max-w-4xl flex-col items-center text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/5 px-4 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            <span className="text-sm font-medium text-brand-300">
              Autonomous Software Generation
            </span>
          </div>

          <h1 className="max-w-3xl text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Generate complete{" "}
            <span className="gradient-text">enterprise software</span>{" "}
            from business requirements
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-surface-400 sm:text-xl">
            Describe your business need in natural language. Genesis instantly
            analyzes your requirements and generates a complete, deployable
            application — data models, APIs, frontend components, workflows,
            and more. The factory builds; you deploy.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <button
              onClick={scrollToDemo}
              className="group relative rounded-xl bg-brand-500 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-brand-400 hover:glow-strong"
            >
              Try the Demo
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">
                →
              </span>
            </button>
            <a
              href="#how-it-works"
              className="rounded-xl border border-white/10 px-8 py-4 text-base font-medium text-surface-300 transition-all hover:border-white/20 hover:text-white"
            >
              How it works
            </a>
          </div>

          {/* Trust indicator */}
          <div className="mt-16 flex items-center gap-6 text-sm text-surface-500">
            <span>Generates production-ready code</span>
            <span className="h-1 w-1 rounded-full bg-surface-600" />
            <span>Full-stack applications</span>
            <span className="h-1 w-1 rounded-full bg-surface-600" />
            <span>Deploy in minutes</span>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg
            className="h-5 w-5 text-surface-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────── */}
      <section
        id="how-it-works"
        className="relative border-t border-white/5 px-6 py-24 sm:py-32"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How it{" "}
              <span className="gradient-text">works</span>
            </h2>
            <p className="mt-4 text-surface-400">
              Four steps from idea to deployed application
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                ),
                title: "Describe",
                desc: "Write your business requirements in plain English. No code, no diagrams — just describe what you need.",
              },
              {
                step: "02",
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                ),
                title: "Generate",
                desc: "Genesis analyzes your requirements and generates a full application blueprint — entities, APIs, and UI components.",
              },
              {
                step: "03",
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                ),
                title: "Customize",
                desc: "Refine the generated blueprint, add custom business logic, and fine-tune the design to match your brand.",
              },
              {
                step: "04",
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                ),
                title: "Deploy",
                desc: "One-click deploy to production. Your generated application is live, secured, and ready for real users.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-2xl border border-white/5 bg-surface-900/50 p-6 transition-all hover:border-white/10 hover:bg-surface-900"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 transition-colors group-hover:bg-brand-500/20">
                    {item.icon}
                  </div>
                  <span className="text-sm font-medium text-surface-600">
                    {item.step}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-surface-400">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Generated Industries ────────────────────────────── */}
      <section className="border-t border-white/5 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Generate <span className="gradient-text">any</span> enterprise system
            </h2>
            <p className="mt-4 text-surface-400">
              The platform understands industry-specific requirements out of the box
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRIES.map((industry, i) => (
              <div
                key={i}
                className={`group relative overflow-hidden rounded-2xl border bg-surface-900/50 bg-gradient-to-br ${industry.color} p-5 transition-all hover:-translate-y-1 hover:border-white/10 hover:bg-surface-900 hover:shadow-lg`}
              >
                <div
                  className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${industry.iconBg} text-lg`}
                >
                  {industry.icon}
                </div>
                <h3 className="mb-1.5 text-sm font-semibold">{industry.title}</h3>
                <p className="text-xs leading-relaxed text-surface-400">
                  {industry.desc}
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-400 opacity-0 transition-opacity group-hover:opacity-100">
                  Generate →
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Generation Demo ─────────────────────────────────── */}
      <section
        ref={demoRef}
        id="demo"
        className="relative border-t border-white/5 px-6 py-24 sm:py-32"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/5 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              See it in{" "}
              <span className="gradient-text">action</span>
            </h2>
            <p className="mt-4 text-surface-400">
              Describe a business need below and watch Genesis generate a complete application blueprint
            </p>
          </div>

          {/* Demo Input */}
          <form onSubmit={handleGenerate} className="relative mb-4">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-surface-900/70 backdrop-blur transition-all focus-within:border-brand-500/30 focus-within:glow">
              <div className="relative">
                <textarea
                  value={demoInput}
                  onChange={(e) => setDemoInput(e.target.value)}
                  placeholder=" "
                  rows={4}
                  className="w-full resize-none bg-transparent px-6 pt-6 pb-2 text-base text-surface-100 placeholder-transparent outline-none"
                  disabled={demoState === "loading"}
                />
                <label className="pointer-events-none absolute left-6 top-5 text-sm text-surface-500 transition-all">
                  Describe your business requirements in natural language...
                </label>
                {!demoInput && (
                  <div className="pointer-events-none absolute left-6 top-5 text-sm">
                    <TypingPlaceholder />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_PROMPTS.slice(0, 3).map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => useExample(prompt)}
                      className="rounded-full border border-white/5 px-2.5 py-1 text-xs text-surface-500 transition-colors hover:border-white/15 hover:text-surface-300"
                      title={prompt}
                    >
                      {prompt.length > 45
                        ? prompt.slice(0, 45) + "..."
                        : prompt}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={demoState === "loading" || !demoInput.trim()}
                  className="flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {demoState === "loading" ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      Generate Blueprint
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Loading State */}
          {demoState === "loading" && (
            <div className="rounded-2xl border border-white/5 bg-surface-900/50 p-12 text-center">
              <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10">
                  <svg
                    className="h-8 w-8 animate-spin text-brand-400"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold">Analyzing your requirements...</h3>
                  <p className="mt-1 text-sm text-surface-400">
                    Genesis is identifying entities, relationships, and business logic
                  </p>
                </div>
                <div className="flex w-full max-w-xs flex-col gap-2">
                  {["Parsing business domain...", "Extracting data entities...", "Designing API endpoints...", "Structuring UI components..."].map(
                    (step, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-surface-500 animate-pulse"
                        style={{ animationDelay: `${i * 200}ms` }}
                      >
                        <svg className="h-3 w-3 shrink-0 text-brand-400" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {step}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {demoState === "error" && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
              <p className="text-red-400">{demoError}</p>
              <button
                onClick={() => {
                  setDemoState("idle");
                  setDemoError("");
                }}
                className="mt-3 text-sm text-surface-400 underline hover:text-white"
              >
                Try again
              </button>
            </div>
          )}

          {/* Results */}
          {demoState === "done" && demoResult && (
            <div ref={resultsRef} className="space-y-6">
              {/* Summary */}
              <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-sm text-brand-400">
                    ✦
                  </span>
                  <div>
                    <h3 className="font-semibold text-brand-300">
                      {demoResult.domain} — Blueprint Generated
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-surface-400">
                      {demoResult.summary}
                    </p>
                  </div>
                </div>
              </div>

              {/* Download Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-400 hover:glow disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDownloading ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Generating ZIP...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download Full Project
                    </>
                  )}
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 rounded-xl border border-white/5 bg-surface-900/50 p-1 overflow-x-auto">
                {(
                  [
                    ["entities", `Entities (${demoResult.entities.length})`],
                    ["endpoints", `API Endpoints (${demoResult.endpoints.length})`],
                    ["components", `Components (${demoResult.components.length})`],
                    ["schema", "Database Schema"],
                    ...(demoResult.apiRoutes ? [["apiroutes", "API Routes"]] as [ResultTab, string][] : []),
                    ...(demoResult.databaseProject ? [["database", "Database"]] as [ResultTab, string][] : []),
                    ...(demoResult.backendProject ? [["backend", "Backend"]] as [ResultTab, string][] : []),
                    ...(demoResult.frontendProject ? [["frontend", "Frontend"]] as [ResultTab, string][] : []),
                    ...(demoResult.dashboardProject ? [["dashboard", "Dashboard"]] as [ResultTab, string][] : []),
                    ...(demoResult.deploymentProject ? [["deploy", "Deploy 🚀"]] as [ResultTab, string][] : []),
                    ...(demoResult.workflowProject ? [["workflows", "Workflows 🔄"]] as [ResultTab, string][] : []),
                    ...(demoResult.reportProject ? [["reports", "Reports 📊"]] as [ResultTab, string][] : []),
                    ...(demoResult.permissionProject ? [["permissions", "Permissions 🔐"]] as [ResultTab, string][] : []),
                  ] as [ResultTab, string][]
                ).map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                      activeTab === tab
                        ? "bg-surface-800 text-white shadow-sm"
                        : "text-surface-400 hover:text-surface-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab Content: Entities */}
              {activeTab === "entities" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {demoResult.entities.map((entity, i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-xl border border-white/5 bg-surface-900/50 transition-all hover:border-white/10"
                    >
                      <button
                        onClick={() =>
                          setExpandedEntity(
                            expandedEntity === entity.name ? null : entity.name
                          )
                        }
                        className="flex w-full items-center justify-between px-5 py-4 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10">
                            <span className="text-sm font-bold text-brand-400">
                              {entity.name.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-semibold">{entity.name}</h4>
                            <p className="text-xs text-surface-500">
                              {entity.fields.length} fields
                            </p>
                          </div>
                        </div>
                        <svg
                          className={`h-4 w-4 text-surface-500 transition-transform ${
                            expandedEntity === entity.name ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {expandedEntity === entity.name && (
                        <div className="border-t border-white/5 px-5 pb-4 pt-2">
                          <div className="space-y-1.5">
                            {entity.fields.map((field, j) => (
                              <div
                                key={j}
                                className="flex items-center justify-between rounded-lg bg-surface-950/50 px-3 py-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-medium text-surface-200 truncate">
                                    {field.name}
                                  </span>
                                  {field.required && (
                                    <span className="shrink-0 rounded bg-red-500/10 px-1 py-0.5 text-[10px] font-medium text-red-400">
                                      REQUIRED
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs text-brand-400">
                                    {field.type}
                                  </code>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Tab Content: Endpoints */}
              {activeTab === "endpoints" && (
                <div className="overflow-hidden rounded-xl border border-white/5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/5 bg-surface-900/70">
                          <th className="px-5 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                            Method
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                            Endpoint
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider hidden sm:table-cell">
                            Description
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider hidden md:table-cell">
                            Returns
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {demoResult.endpoints.map((ep, i) => (
                          <tr
                            key={i}
                            className="border-b border-white/[0.02] transition-colors hover:bg-white/[0.02]"
                          >
                            <td className="px-5 py-3">
                              <span
                                className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
                                  ep.method === "GET"
                                    ? "bg-green-500/10 text-green-400"
                                    : ep.method === "POST"
                                      ? "bg-blue-500/10 text-blue-400"
                                      : ep.method === "PATCH" || ep.method === "PUT"
                                        ? "bg-amber-500/10 text-amber-400"
                                        : "bg-red-500/10 text-red-400"
                                }`}
                              >
                                {ep.method}
                              </span>
                            </td>
                            <td className="px-5 py-3 font-mono text-xs text-surface-200">
                              {ep.path}
                            </td>
                            <td className="px-5 py-3 text-surface-400 hidden sm:table-cell">
                              {ep.description}
                            </td>
                            <td className="px-5 py-3 font-mono text-xs text-brand-400 hidden md:table-cell">
                              {ep.returns}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab Content: Components */}
              {activeTab === "components" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {demoResult.components.map((comp, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-white/5 bg-surface-900/50 p-5 transition-all hover:border-white/10"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            comp.type === "layout"
                              ? "bg-purple-500/10 text-purple-400"
                              : comp.type === "page"
                                ? "bg-blue-500/10 text-blue-400"
                                : comp.type === "feature"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-surface-700 text-surface-300"
                          }`}
                        >
                          {comp.type}
                        </span>
                      </div>
                      <h4 className="font-semibold font-mono text-sm">
                        &lt;{comp.name} /&gt;
                      </h4>
                      <p className="mt-1 text-xs text-surface-400">
                        {comp.description}
                      </p>
                      {comp.children && comp.children.length > 0 && (
                        <div className="mt-3 border-t border-white/5 pt-3">
                          <p className="text-[10px] font-medium text-surface-600 uppercase tracking-wider mb-2">
                            Children
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {comp.children.map((child, j) => (
                              <span
                                key={j}
                                className="inline-flex items-center rounded-md bg-surface-800 px-2 py-1 text-xs font-mono text-surface-300"
                              >
                                {child.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Tab Content: Database Schema */}
              {activeTab === "schema" && (
                <div className="space-y-6">
                  {/* ER Diagram */}
                  <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                      <h3 className="text-sm font-semibold text-surface-200">
                        Entity Relationship Diagram
                      </h3>
                      <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                        {demoResult.relationships.length} relationships
                      </span>
                    </div>
                    <div
                      id="er-diagram-container"
                      className="p-4 flex justify-center overflow-x-auto"
                    >
                      <div className="flex items-center justify-center h-40 text-surface-500 text-sm">
                        Loading diagram...
                      </div>
                    </div>
                  </div>

                  {/* SQL DDL */}
                  <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                      <h3 className="text-sm font-semibold text-surface-200">
                        SQL DDL (PostgreSQL)
                      </h3>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(demoResult.sql).then(() => {
                            setSqlCopied(true);
                            setTimeout(() => setSqlCopied(false), 2000);
                          }).catch(() => {});
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                      >
                        {sqlCopied ? (
                          <>
                            <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy SQL
                          </>
                        )}
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <pre className="p-5 text-sm font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                        <code>{demoResult.sql}</code>
                      </pre>
                    </div>
                  </div>

                  {/* Relationships list */}
                  {demoResult.relationships.length > 0 && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="px-5 py-3 border-b border-white/5">
                        <h3 className="text-sm font-semibold text-surface-200">
                          Inferred Relationships
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/5 bg-surface-900/70">
                              <th className="px-5 py-2.5 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">From</th>
                              <th className="px-5 py-2.5 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Type</th>
                              <th className="px-5 py-2.5 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">To</th>
                              <th className="px-5 py-2.5 text-left text-xs font-medium text-surface-500 uppercase tracking-wider hidden sm:table-cell">Foreign Key</th>
                            </tr>
                          </thead>
                          <tbody>
                            {demoResult.relationships.map((rel, i) => (
                              <tr key={i} className="border-b border-white/[0.02] transition-colors hover:bg-white/[0.02]">
                                <td className="px-5 py-2.5 font-medium text-surface-200">{rel.from}</td>
                                <td className="px-5 py-2.5">
                                  <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
                                    rel.type === "one-to-many"
                                      ? "bg-blue-500/10 text-blue-400"
                                      : rel.type === "many-to-one"
                                        ? "bg-amber-500/10 text-amber-400"
                                        : "bg-purple-500/10 text-purple-400"
                                  }`}>
                                    {rel.type}
                                  </span>
                                </td>
                                <td className="px-5 py-2.5 font-medium text-surface-200">{rel.to}</td>
                                <td className="px-5 py-2.5 font-mono text-xs text-surface-400 hidden sm:table-cell">
                                  {rel.foreignKey}
                                  {rel.junctionTable && (
                                    <span className="text-surface-600 ml-1">via {rel.junctionTable}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: API Routes */}
              {activeTab === "apiroutes" && demoResult.apiRoutes && (
                <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-surface-200">
                        Generated API Routes
                      </h3>
                      <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                        Bun + Hono + Zod
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(demoResult.apiRoutes).then(() => {
                          setApiRoutesCopied(true);
                          setTimeout(() => setApiRoutesCopied(false), 2000);
                        }).catch(() => {});
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                    >
                      {apiRoutesCopied ? (
                        <>
                          <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Code
                        </>
                      )}
                    </button>
                  </div>
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <pre className="p-5 text-sm font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                      <code>{demoResult.apiRoutes}</code>
                    </pre>
                  </div>
                </div>
              )}

              {/* Tab Content: Database */}
              {activeTab === "database" && demoResult.databaseProject && (
                <div className="space-y-4">
                  {/* Sub-section selector */}
                  <div className="flex gap-1 rounded-xl border border-white/5 bg-surface-900/70 p-1 overflow-x-auto">
                    {[
                      ["docker", "🐳 Docker"],
                      ["migrations", "📄 Migrations"],
                      ["connection", "🔌 Connection"],
                      ["seed", "🌱 Seed Data"],
                      ["migrate", "🔄 Migrate"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setDbExpandedSection(key)}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                          dbExpandedSection === key
                            ? "bg-surface-800 text-white shadow-sm"
                            : "text-surface-400 hover:text-surface-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Docker Compose */}
                  {dbExpandedSection === "docker" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🐳</span>
                          <h3 className="text-sm font-semibold text-surface-200">
                            docker-compose.yml
                          </h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                            PostgreSQL 16
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.databaseProject!.dockerCompose).then(() => {
                              setDbCopied("docker");
                              setTimeout(() => setDbCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {dbCopied === "docker" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.databaseProject.dockerCompose}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Migrations */}
                  {dbExpandedSection === "migrations" && (
                    <div className="space-y-4">
                      {demoResult.databaseProject.migrations.map((mig, i) => (
                        <div key={i} className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">📄</span>
                              <h3 className="text-sm font-semibold text-surface-200 font-mono">
                                {mig.filename}
                              </h3>
                              <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                                Migration {i + 1}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(mig.content).then(() => {
                                  setDbCopied(`mig-${i}`);
                                  setTimeout(() => setDbCopied(null), 2000);
                                }).catch(() => {});
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                            >
                              {dbCopied === `mig-${i}` ? (
                                <>
                                  <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                          <div className="overflow-x-auto">
                            <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                              <code>{mig.content}</code>
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Connection */}
                  {dbExpandedSection === "connection" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🔌</span>
                          <h3 className="text-sm font-semibold text-surface-200 font-mono">
                            src/db/connection.ts
                          </h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                            postgres pool
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.databaseProject!.connectionCode).then(() => {
                              setDbCopied("connection");
                              setTimeout(() => setDbCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {dbCopied === "connection" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.databaseProject.connectionCode}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Seed Data */}
                  {dbExpandedSection === "seed" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🌱</span>
                          <h3 className="text-sm font-semibold text-surface-200 font-mono">
                            src/db/seed.ts
                          </h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                            FK-aware
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.databaseProject!.seedCode).then(() => {
                              setDbCopied("seed");
                              setTimeout(() => setDbCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {dbCopied === "seed" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.databaseProject.seedCode}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Migrate */}
                  {dbExpandedSection === "migrate" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🔄</span>
                          <h3 className="text-sm font-semibold text-surface-200 font-mono">
                            src/db/migrate.ts
                          </h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                            runner
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.databaseProject!.migrateCode).then(() => {
                              setDbCopied("migrate");
                              setTimeout(() => setDbCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {dbCopied === "migrate" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.databaseProject.migrateCode}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* .env.example summary */}
                  <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">⚙️</span>
                        <h3 className="text-sm font-semibold text-surface-200 font-mono">
                          .env.example
                        </h3>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(demoResult.databaseProject!.envExample).then(() => {
                            setDbCopied("env");
                            setTimeout(() => setDbCopied(null), 2000);
                          }).catch(() => {});
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                      >
                        {dbCopied === "env" ? (
                          <>
                            <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                        <code>{demoResult.databaseProject.envExample}</code>
                      </pre>
                    </div>
                  </div>

                  {/* Summary badge */}
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-lg">
                      🗄️
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-300">
                        Complete Database Project
                      </h4>
                      <p className="text-xs text-surface-400 mt-0.5">
                        {demoResult.databaseProject.migrations.length} migration(s) • Docker Compose • Connection pool •
                        Seed data • Migration runner • Ready to run with <code className="text-brand-400">docker compose up</code>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: Backend */}
              {activeTab === "backend" && demoResult.backendProject && (
                <div className="space-y-4">
                  {/* Sub-section selector */}
                  <div className="flex gap-1 rounded-xl border border-white/5 bg-surface-900/70 p-1 overflow-x-auto">
                    {[
                      ["structure", "📁 Structure"],
                      ["packageJson", "📦 package.json"],
                      ["indexTs", "🚀 Server Entry"],
                      ["config", "⚙️ Config"],
                      ["middleware", "🔧 Middleware"],
                      ["readme", "📖 README"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setBackendExpandedSection(key)}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                          backendExpandedSection === key
                            ? "bg-surface-800 text-white shadow-sm"
                            : "text-surface-400 hover:text-surface-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Project Structure */}
                  {backendExpandedSection === "structure" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5">
                        <span className="text-lg">📁</span>
                        <h3 className="text-sm font-semibold text-surface-200">
                          Project Structure
                        </h3>
                        <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                          Hono + Bun
                        </span>
                      </div>
                      <div className="p-5">
                        <pre className="text-xs font-mono leading-relaxed text-surface-300 bg-surface-950/70 rounded-lg p-4 overflow-x-auto">
                          <code>{`├── src/
│   ├── index.ts              # Server entry point
│   ├── config.ts             # Environment configuration
│   ├── routes.ts             # Generated API routes
│   ├── middleware/
│   │   ├── error-handler.ts  # Global error handling
│   │   ├── request-logger.ts # HTTP request logging
│   │   └── auth.ts           # Authentication middleware
│   └── db/
│       ├── connection.ts     # Database connection pool
│       ├── migrate.ts        # Migration runner
│       └── seed.ts           # Seed data script
├── migrations/
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
└── README.md`}</code>
                        </pre>
                      </div>
                      <div className="flex items-center gap-3 rounded-b-xl border-t border-white/5 bg-brand-500/5 p-4">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-sm">
                          📦
                        </span>
                        <div>
                          <h4 className="text-xs font-semibold text-brand-300">
                            Ready-to-run backend project
                          </h4>
                          <p className="text-[11px] text-surface-400 mt-0.5">
                            <code className="text-brand-400">bun install && bun run dev</code> — starts on port 3001 with hot reload
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* package.json */}
                  {backendExpandedSection === "packageJson" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">📦</span>
                          <h3 className="text-sm font-semibold text-surface-200 font-mono">
                            package.json
                          </h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                            deps • scripts
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.backendProject!.packageJson).then(() => {
                              setBackendCopied("packageJson");
                              setTimeout(() => setBackendCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {backendCopied === "packageJson" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.backendProject.packageJson}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* tsconfig.json */}
                  {backendExpandedSection === "packageJson" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🔷</span>
                          <h3 className="text-sm font-semibold text-surface-200 font-mono">
                            tsconfig.json
                          </h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                            strict • Bun
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.backendProject!.tsconfigJson).then(() => {
                              setBackendCopied("tsconfig");
                              setTimeout(() => setBackendCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {backendCopied === "tsconfig" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.backendProject.tsconfigJson}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Server Entry — index.ts */}
                  {backendExpandedSection === "indexTs" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🚀</span>
                          <h3 className="text-sm font-semibold text-surface-200 font-mono">
                            src/index.ts
                          </h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                            Hono • CORS • SIGTERM
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.backendProject!.indexTs).then(() => {
                              setBackendCopied("indexTs");
                              setTimeout(() => setBackendCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {backendCopied === "indexTs" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.backendProject.indexTs}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Config */}
                  {backendExpandedSection === "config" && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">⚙️</span>
                            <h3 className="text-sm font-semibold text-surface-200 font-mono">
                              src/config.ts
                            </h3>
                            <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                              dotenv • typed
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(demoResult.backendProject!.configTs).then(() => {
                                setBackendCopied("config");
                                setTimeout(() => setBackendCopied(null), 2000);
                              }).catch(() => {});
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                          >
                            {backendCopied === "config" ? (
                              <>
                                <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                              </>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                          <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                            <code>{demoResult.backendProject.configTs}</code>
                          </pre>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">📝</span>
                            <h3 className="text-sm font-semibold text-surface-200 font-mono">
                              .env.example
                            </h3>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(demoResult.backendProject!.envExample).then(() => {
                                setBackendCopied("env");
                                setTimeout(() => setBackendCopied(null), 2000);
                              }).catch(() => {});
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                          >
                            {backendCopied === "env" ? (
                              <>
                                <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                              </>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                        <div className="overflow-x-auto">
                          <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                            <code>{demoResult.backendProject.envExample}</code>
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Middleware */}
                  {backendExpandedSection === "middleware" && (
                    <div className="space-y-4">
                      {demoResult.backendProject.middleware.map((mw, i) => (
                        <div key={i} className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">🔧</span>
                              <h3 className="text-sm font-semibold text-surface-200 font-mono">
                                src/middleware/{mw.filename}
                              </h3>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(mw.content).then(() => {
                                  setBackendCopied(`mw-${i}`);
                                  setTimeout(() => setBackendCopied(null), 2000);
                                }).catch(() => {});
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                            >
                              {backendCopied === `mw-${i}` ? (
                                <>
                                  <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                            <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                              <code>{mw.content}</code>
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* README */}
                  {backendExpandedSection === "readme" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">📖</span>
                          <h3 className="text-sm font-semibold text-surface-200 font-mono">
                            README.md
                          </h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                            setup guide
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.backendProject!.readme).then(() => {
                              setBackendCopied("readme");
                              setTimeout(() => setBackendCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {backendCopied === "readme" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.backendProject.readme}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Summary badge */}
                  <div className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-lg">
                      🚀
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-violet-300">
                        Complete Backend Project
                      </h4>
                      <p className="text-xs text-surface-400 mt-0.5">
                        Hono • Bun • TypeScript • {demoResult.backendProject.middleware.length} middleware(s) •{" "}
                        Ready to run with <code className="text-brand-400">bun run dev</code>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: Frontend */}
              {activeTab === "frontend" && demoResult.frontendProject && (
                <div className="space-y-4">
                  {/* Sub-section selector */}
                  <div className="flex gap-1 rounded-xl border border-white/5 bg-surface-900/70 p-1 overflow-x-auto">
                    {[
                      ["structure", "📁 Structure"],
                      ["components", "🧩 Components"],
                      ["apptsx", "📄 App.tsx"],
                      ["entry", "🚀 Entry Files"],
                      ["config", "⚙️ Config"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setFrontendExpandedSection(key)}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                          frontendExpandedSection === key
                            ? "bg-surface-800 text-white shadow-sm"
                            : "text-surface-400 hover:text-surface-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Project Structure */}
                  {frontendExpandedSection === "structure" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5">
                        <span className="text-lg">📁</span>
                        <h3 className="text-sm font-semibold text-surface-200">
                          Project Structure
                        </h3>
                        <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                          React + Vite + Tailwind
                        </span>
                      </div>
                      <div className="p-5">
                        <pre className="text-xs font-mono leading-relaxed text-surface-300 bg-surface-950/70 rounded-lg p-4 overflow-x-auto">
                          <code>{`├── index.html                 # Vite HTML entry
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript config
├── tsconfig.node.json         # Node/Vite TS config
├── vite.config.ts             # Vite + React plugin
├── tailwind.config.js         # Tailwind CSS (dark theme)
├── postcss.config.js          # PostCSS (Tailwind)
└── src/
    ├── index.tsx              # React entry point
    ├── index.css              # Tailwind directives + theme
    ├── App.tsx                # Root app component
    ├── types.ts               # Generated TypeScript interfaces
    └── components/
${demoResult.components.map((c) => `        ├── ${c.name}.tsx`).join("\n")}`}</code>
                        </pre>
                      </div>
                      <div className="flex items-center gap-3 rounded-b-xl border-t border-white/5 bg-brand-500/5 p-4">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-sm">
                          📦
                        </span>
                        <div>
                          <h4 className="text-xs font-semibold text-brand-300">
                            Complete React project — {demoResult.components.length} components
                          </h4>
                          <p className="text-[11px] text-surface-400 mt-0.5">
                            <code className="text-brand-400">npm install && npm run dev</code> — starts Vite dev server on port 5173
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Component Files */}
                  {frontendExpandedSection === "components" && (
                    <div className="space-y-4">
                      {demoResult.frontendProject.files
                        .filter((f) => f.filename.startsWith("src/components/"))
                        .map((file, i) => (
                          <div key={i} className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                              <div className="flex items-center gap-3">
                                <span className="text-lg">🧩</span>
                                <h3 className="text-sm font-semibold text-surface-200 font-mono">
                                  {file.filename}
                                </h3>
                                <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                                  {file.content.split("\n").length} lines
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(file.content).then(() => {
                                    setFrontendCopied(`comp-${i}`);
                                    setTimeout(() => setFrontendCopied(null), 2000);
                                  }).catch(() => {});
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                              >
                                {frontendCopied === `comp-${i}` ? (
                                  <>
                                    <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Copy
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                              <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                                <code>{file.content}</code>
                              </pre>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* App.tsx */}
                  {frontendExpandedSection === "apptsx" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">📄</span>
                          <h3 className="text-sm font-semibold text-surface-200 font-mono">
                            src/App.tsx
                          </h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                            root component
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.frontendProject!.appTsx).then(() => {
                              setFrontendCopied("apptsx");
                              setTimeout(() => setFrontendCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {frontendCopied === "apptsx" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.frontendProject.appTsx}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Entry Files */}
                  {frontendExpandedSection === "entry" && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">🚀</span>
                            <h3 className="text-sm font-semibold text-surface-200 font-mono">
                              src/index.tsx
                            </h3>
                            <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                              ReactDOM entry
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(demoResult.frontendProject!.indexTsx).then(() => {
                                setFrontendCopied("indexTsx");
                                setTimeout(() => setFrontendCopied(null), 2000);
                              }).catch(() => {});
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                          >
                            {frontendCopied === "indexTsx" ? (
                              <>
                                <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                              </>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                          <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                            <code>{demoResult.frontendProject.indexTsx}</code>
                          </pre>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">🌐</span>
                            <h3 className="text-sm font-semibold text-surface-200 font-mono">
                              index.html
                            </h3>
                            <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                              Vite entry
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(demoResult.frontendProject!.indexHtml).then(() => {
                                setFrontendCopied("indexHtml");
                                setTimeout(() => setFrontendCopied(null), 2000);
                              }).catch(() => {});
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                          >
                            {frontendCopied === "indexHtml" ? (
                              <>
                                <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                              </>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                          <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                            <code>{demoResult.frontendProject.indexHtml}</code>
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Config Files */}
                  {frontendExpandedSection === "config" && (
                    <div className="space-y-4">
                      {demoResult.frontendProject.files
                        .filter((f) => !f.filename.startsWith("src/"))
                        .map((file, i) => (
                          <div key={i} className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                              <div className="flex items-center gap-3">
                                <span className="text-lg">⚙️</span>
                                <h3 className="text-sm font-semibold text-surface-200 font-mono">
                                  {file.filename}
                                </h3>
                                <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                                  config
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(file.content).then(() => {
                                    setFrontendCopied(`cfg-${i}`);
                                    setTimeout(() => setFrontendCopied(null), 2000);
                                  }).catch(() => {});
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                              >
                                {frontendCopied === `cfg-${i}` ? (
                                  <>
                                    <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Copy
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                              <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                                <code>{file.content}</code>
                              </pre>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Summary badge */}
                  <div className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-lg">
                      🎨
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-cyan-300">
                        Complete Frontend Project
                      </h4>
                      <p className="text-xs text-surface-400 mt-0.5">
                        React • TypeScript • Tailwind CSS • Vite • {demoResult.frontendProject.files.length + 3} files •{" "}
                        Ready to run with <code className="text-brand-400">npm run dev</code>
                      </p>
                    </div>
                  </div>
                </div>
              )}

                            {/* Tab Content: Dashboard */}
              {activeTab === "dashboard" && demoResult.dashboardProject && (
                <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📊</span>
                      <h3 className="text-sm font-semibold text-surface-200 font-mono">
                        Dashboard.tsx
                      </h3>
                      <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                        {demoResult.dashboardProject.summary.kpiCount} KPIs • {demoResult.dashboardProject.summary.chartCount} Charts
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(demoResult.dashboardProject!.dashboardTsx).then(() => {
                          setDashboardCopied(true);
                          setTimeout(() => setDashboardCopied(false), 2000);
                        }).catch(() => {});
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                    >
                      {dashboardCopied ? (
                        <>
                          <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Code
                        </>
                      )}
                    </button>
                  </div>
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                      <code>{demoResult.dashboardProject.dashboardTsx}</code>
                    </pre>
                  </div>
                </div>
              )}

              


              {/* Tab Content: Deploy */}
              {activeTab === "deploy" && demoResult.deploymentProject && (
                <div className="space-y-4">
                  <div className="flex gap-1 rounded-xl border border-white/5 bg-surface-900/70 p-1 overflow-x-auto">
                    {[
                      ["dockerfile", "🐳 Dockerfile"],
                      ["dockerfileFrontend", "🖥️ Dockerfile FE"],
                      ["dockerCompose", "🐙 Compose"],
                      ["flyToml", "🪰 Fly.io"],
                      ["githubActions", "⚡ CI/CD"],
                      ["deployScript", "📜 deploy.sh"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setDeployExpandedSection(key)}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                          deployExpandedSection === key
                            ? "bg-surface-800 text-white shadow-sm"
                            : "text-surface-400 hover:text-surface-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {deployExpandedSection === "dockerfile" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🐳</span>
                          <h3 className="text-sm font-semibold text-surface-200 font-mono">Dockerfile</h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">Multi-stage Bun</span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.deploymentProject!.dockerfile).then(() => {
                              setDeployCopied("dockerfile");
                              setTimeout(() => setDeployCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {deployCopied === "dockerfile" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.deploymentProject.dockerfile}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {deployExpandedSection === "dockerfileFrontend" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🖥️</span>
                          <h3 className="text-sm font-semibold text-surface-200 font-mono">Dockerfile.frontend</h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">Vite → nginx</span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.deploymentProject!.dockerfileFrontend).then(() => {
                              setDeployCopied("dockerfileFrontend");
                              setTimeout(() => setDeployCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {deployCopied === "dockerfileFrontend" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.deploymentProject.dockerfileFrontend}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {deployExpandedSection === "dockerCompose" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🐙</span>
                          <h3 className="text-sm font-semibold text-surface-200 font-mono">docker-compose.prod.yml</h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">Backend • Frontend • Postgres</span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.deploymentProject!.dockerCompose).then(() => {
                              setDeployCopied("dockerCompose");
                              setTimeout(() => setDeployCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {deployCopied === "dockerCompose" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.deploymentProject.dockerComposeProd}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {deployExpandedSection === "flyToml" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🪰</span>
                          <h3 className="text-sm font-semibold text-surface-200 font-mono">fly.toml</h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">Fly.io Config</span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.deploymentProject!.flyToml).then(() => {
                              setDeployCopied("flyToml");
                              setTimeout(() => setDeployCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {deployCopied === "flyToml" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.deploymentProject.flyToml}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {deployExpandedSection === "githubActions" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">⚡</span>
                          <h3 className="text-sm font-semibold text-surface-200 font-mono">.github/workflows/deploy.yml</h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">CI/CD Pipeline</span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.deploymentProject!.githubActions).then(() => {
                              setDeployCopied("githubActions");
                              setTimeout(() => setDeployCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {deployCopied === "githubActions" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.deploymentProject.githubActions}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {deployExpandedSection === "deployScript" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">📜</span>
                          <h3 className="text-sm font-semibold text-surface-200 font-mono">deploy.sh</h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">Build • Migrate • Deploy</span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.deploymentProject!.deployScript).then(() => {
                              setDeployCopied("deployScript");
                              setTimeout(() => setDeployCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {deployCopied === "deployScript" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.deploymentProject.deployScript}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-lg">🚀</span>
                    <div>
                      <h4 className="text-sm font-semibold text-blue-300">Complete Deployment Configuration</h4>
                      <p className="text-xs text-surface-400 mt-0.5">
                        Docker • Docker Compose • Fly.io • GitHub Actions CI/CD • deploy.sh —
                        Ready to deploy with <code className="text-brand-400">./deploy.sh deploy</code>
                      </p>
                    </div>
                  </div>
                </div>
              )}


              {/* Tab Content: Workflows */}
              {activeTab === "workflows" && demoResult.workflowProject && (
                <div className="space-y-4">
                  <div className="flex gap-1 rounded-xl border border-white/5 bg-surface-900/70 p-1 overflow-x-auto">
                    {[
                      ["stateMachines", "🔄 State Machines"],
                      ["approvalFlows", "✅ Approval Flows"],
                      ["processFlows", "📋 Process Flows"],
                      ["workflowEngine", "⚙️ Workflow Engine"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setWorkflowsExpandedSection(key)}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                          workflowsExpandedSection === key
                            ? "bg-surface-800 text-white shadow-sm"
                            : "text-surface-400 hover:text-surface-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* State Machines accordion */}
                  {workflowsExpandedSection === "stateMachines" && (
                    <div className="space-y-3">
                      {demoResult.workflowProject.stateMachines.map((sm, i) => (
                        <div key={i} className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">🔄</span>
                              <h3 className="text-sm font-semibold text-surface-200 font-mono">{sm.entity} State Machine</h3>
                              <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                                {sm.states.length} states &middot; {sm.transitions.length} transitions
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(sm.tsCode).then(() => {
                                  setWorkflowsCopied(`sm-${i}`);
                                  setTimeout(() => setWorkflowsCopied(null), 2000);
                                }).catch(() => {});
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                            >
                              {workflowsCopied === `sm-${i}` ? (
                                <>
                                  <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                          {/* States */}
                          <div className="px-5 py-3 border-b border-white/5">
                            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">States</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {sm.states.map((state) => (
                                <span key={state} className="inline-flex items-center rounded-md bg-surface-800 px-2.5 py-1 text-xs font-mono text-surface-300 border border-white/5">
                                  {state}
                                </span>
                              ))}
                            </div>
                          </div>
                          {/* Transitions */}
                          <div className="px-5 py-3 border-b border-white/5">
                            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Transitions</h4>
                            <div className="space-y-1.5">
                              {sm.transitions.map((t, j) => (
                                <div key={j} className="flex items-center gap-2 text-xs font-mono">
                                  <span className="text-surface-300">{t.from}</span>
                                  <svg className="h-3 w-3 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                  </svg>
                                  <span className="text-surface-300">{t.to}</span>
                                  {t.condition && (
                                    <span className="text-surface-500 italic">({t.condition})</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* TypeScript Code */}
                          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                            <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                              <code>{sm.tsCode}</code>
                            </pre>
                          </div>
                        </div>
                      ))}
                      {demoResult.workflowProject.stateMachines.length === 0 && (
                        <div className="rounded-xl border border-white/5 bg-surface-900/50 p-8 text-center">
                          <p className="text-sm text-surface-500">No state machines detected for this domain</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Approval Flows accordion */}
                  {workflowsExpandedSection === "approvalFlows" && (
                    <div className="space-y-3">
                      {demoResult.workflowProject.approvalFlows.map((af, i) => (
                        <div key={i} className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">✅</span>
                              <h3 className="text-sm font-semibold text-surface-200 font-mono">{af.name}</h3>
                              <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">
                                {af.steps.length} steps
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(af.tsCode).then(() => {
                                  setWorkflowsCopied(`af-${i}`);
                                  setTimeout(() => setWorkflowsCopied(null), 2000);
                                }).catch(() => {});
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                            >
                              {workflowsCopied === `af-${i}` ? (
                                <>
                                  <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                          {/* Steps */}
                          <div className="px-5 py-3 border-b border-white/5">
                            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Steps</h4>
                            <div className="space-y-1.5">
                              {af.steps.map((step, j) => (
                                <div key={j} className="flex items-center gap-2 text-xs">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-800 text-[10px] font-semibold text-surface-400">
                                    {j + 1}
                                  </span>
                                  <span className="text-surface-300">{step}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Code */}
                          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                            <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                              <code>{af.tsCode}</code>
                            </pre>
                          </div>
                        </div>
                      ))}
                      {demoResult.workflowProject.approvalFlows.length === 0 && (
                        <div className="rounded-xl border border-white/5 bg-surface-900/50 p-8 text-center">
                          <p className="text-sm text-surface-500">No approval flows configured for this domain</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Process Flows accordion */}
                  {workflowsExpandedSection === "processFlows" && (
                    <div className="space-y-3">
                      {demoResult.workflowProject.processFlows.map((pf, i) => (
                        <div key={i} className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">📋</span>
                              <h3 className="text-sm font-semibold text-surface-200 font-mono">{pf.name}</h3>
                              <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">Process Flow</span>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(pf.tsCode).then(() => {
                                  setWorkflowsCopied(`pf-${i}`);
                                  setTimeout(() => setWorkflowsCopied(null), 2000);
                                }).catch(() => {});
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                            >
                              {workflowsCopied === `pf-${i}` ? (
                                <>
                                  <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                          {/* Description */}
                          <div className="px-5 py-3 border-b border-white/5">
                            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Description</h4>
                            <p className="text-xs text-surface-300">{pf.description}</p>
                          </div>
                          {/* Code */}
                          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                            <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                              <code>{pf.tsCode}</code>
                            </pre>
                          </div>
                        </div>
                      ))}
                      {demoResult.workflowProject.processFlows.length === 0 && (
                        <div className="rounded-xl border border-white/5 bg-surface-900/50 p-8 text-center">
                          <p className="text-sm text-surface-500">No process flows defined for this domain</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Workflow Engine */}
                  {workflowsExpandedSection === "workflowEngine" && (
                    <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">⚙️</span>
                          <h3 className="text-sm font-semibold text-surface-200 font-mono">WorkflowEngine.ts</h3>
                          <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">TypeScript Runtime</span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(demoResult.workflowProject!.workflowEngine).then(() => {
                              setWorkflowsCopied("engine");
                              setTimeout(() => setWorkflowsCopied(null), 2000);
                            }).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                        >
                          {workflowsCopied === "engine" ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <pre className="p-5 text-xs font-mono leading-relaxed text-surface-200 bg-surface-950/70 overflow-x-auto">
                          <code>{demoResult.workflowProject.workflowEngine}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-lg">🔄</span>
                    <div>
                      <h4 className="text-sm font-semibold text-purple-300">Workflow System Complete</h4>
                      <p className="text-xs text-surface-400 mt-0.5">
                        State Machines &middot; Approval Flows &middot; Process Flows &middot; Reusable Engine &mdash;
                        Ready to wire into <code className="text-brand-400">routes</code> and <code className="text-brand-400">middleware</code>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: Reports */}
              {activeTab === "reports" && demoResult.reportProject && (
                <div className="space-y-4">
                  <div className="flex gap-1 rounded-xl border border-white/5 bg-surface-900/70 p-1 overflow-x-auto">
                    {[
                      ["summary", "📋 Summary Reports"],
                      ["detail", "📄 Detail Reports"],
                      ["dashboard", "📊 Cross-Entity Reports"],
                      ["scheduled", "📅 Scheduled Reports"],
                      ["runner", "⚡ Report Runner"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setReportsExpandedSection(key)}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                          reportsExpandedSection === key
                            ? "bg-surface-800 text-white shadow-sm"
                            : "text-surface-400 hover:text-surface-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Summary Reports */}
                  {reportsExpandedSection === "summary" && (
                    <div className="space-y-3">
                      {demoResult.reportProject.reports.filter(r => r.type === "summary").map((r, i) => (
                        <div key={i} className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">📋</span>
                              <h3 className="text-sm font-semibold text-surface-200 font-mono">{r.name}</h3>
                              <span className="text-[10px] font-medium text-green-500/70 uppercase tracking-wider bg-green-500/10 px-2 py-0.5 rounded">{r.entity}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(r.sql).then(() => {
                                    setReportsCopied(`sql-sum-${i}`);
                                    setTimeout(() => setReportsCopied(null), 2000);
                                  }).catch(() => {});
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                              >
                                {reportsCopied === `sql-sum-${i}` ? (
                                  <><svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                                ) : (
                                  <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy SQL</>
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(r.tsCode).then(() => {
                                    setReportsCopied(`ts-sum-${i}`);
                                    setTimeout(() => setReportsCopied(null), 2000);
                                  }).catch(() => {});
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                              >
                                {reportsCopied === `ts-sum-${i}` ? (
                                  <><svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                                ) : (
                                  <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy TS</>
                                )}
                              </button>
                            </div>
                          </div>
                          {/* SQL */}
                          <div className="px-5 py-3 border-b border-white/5">
                            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">SQL Query</h4>
                            <pre className="overflow-x-auto rounded-lg bg-surface-950 p-3 text-xs text-surface-300 font-mono leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto"><code>{r.sql}</code></pre>
                          </div>
                          {/* TypeScript */}
                          <div className="px-5 py-3">
                            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">TypeScript Module</h4>
                            <pre className="overflow-x-auto rounded-lg bg-surface-950 p-3 text-xs text-surface-300 font-mono leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto"><code>{r.tsCode.length > 2000 ? r.tsCode.slice(0, 2000) + '\n\n// ... (truncated, full code in download ZIP)' : r.tsCode}</code></pre>
                          </div>
                        </div>
                      ))}
                      {demoResult.reportProject.reports.filter(r => r.type === "summary").length === 0 && (
                        <div className="text-center py-6 text-surface-500 text-sm">No summary reports generated.</div>
                      )}
                    </div>
                  )}

                  {/* Detail Reports */}
                  {reportsExpandedSection === "detail" && (
                    <div className="space-y-3">
                      {demoResult.reportProject.reports.filter(r => r.type === "detail").map((r, i) => (
                        <div key={i} className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">📄</span>
                              <h3 className="text-sm font-semibold text-surface-200 font-mono">{r.name}</h3>
                              <span className="text-[10px] font-medium text-blue-500/70 uppercase tracking-wider bg-blue-500/10 px-2 py-0.5 rounded">{r.entity}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { navigator.clipboard.writeText(r.sql).then(() => { setReportsCopied(`sql-det-${i}`); setTimeout(() => setReportsCopied(null), 2000); }).catch(() => {}); }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                              >
                                {reportsCopied === `sql-det-${i}` ? <><svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</> : <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy SQL</>}
                              </button>
                              <button
                                onClick={() => { navigator.clipboard.writeText(r.tsCode).then(() => { setReportsCopied(`ts-det-${i}`); setTimeout(() => setReportsCopied(null), 2000); }).catch(() => {}); }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                              >
                                {reportsCopied === `ts-det-${i}` ? <><svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</> : <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy TS</>}
                              </button>
                            </div>
                          </div>
                          <div className="px-5 py-3 border-b border-white/5">
                            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">SQL Query</h4>
                            <pre className="overflow-x-auto rounded-lg bg-surface-950 p-3 text-xs text-surface-300 font-mono leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto"><code>{r.sql}</code></pre>
                          </div>
                          <div className="px-5 py-3">
                            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">TypeScript Module</h4>
                            <pre className="overflow-x-auto rounded-lg bg-surface-950 p-3 text-xs text-surface-300 font-mono leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto"><code>{r.tsCode.length > 2000 ? r.tsCode.slice(0, 2000) + '\n\n// ... (truncated, full code in download ZIP)' : r.tsCode}</code></pre>
                          </div>
                        </div>
                      ))}
                      {demoResult.reportProject.reports.filter(r => r.type === "detail").length === 0 && (
                        <div className="text-center py-6 text-surface-500 text-sm">No detail reports generated.</div>
                      )}
                    </div>
                  )}

                  {/* Cross-Entity Dashboard Reports */}
                  {reportsExpandedSection === "dashboard" && (
                    <div className="space-y-3">
                      {demoResult.reportProject.reports.filter(r => r.type === "dashboard").map((r, i) => (
                        <div key={i} className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">📊</span>
                              <h3 className="text-sm font-semibold text-surface-200 font-mono">{r.name}</h3>
                              <span className="text-[10px] font-medium text-amber-500/70 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded">All Entities</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { navigator.clipboard.writeText(r.sql).then(() => { setReportsCopied(`sql-dash-${i}`); setTimeout(() => setReportsCopied(null), 2000); }).catch(() => {}); }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                              >
                                {reportsCopied === `sql-dash-${i}` ? <><svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</> : <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy SQL</>}
                              </button>
                              <button
                                onClick={() => { navigator.clipboard.writeText(r.tsCode).then(() => { setReportsCopied(`ts-dash-${i}`); setTimeout(() => setReportsCopied(null), 2000); }).catch(() => {}); }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                              >
                                {reportsCopied === `ts-dash-${i}` ? <><svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</> : <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy TS</>}
                              </button>
                            </div>
                          </div>
                          <div className="px-5 py-3 border-b border-white/5">
                            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">SQL Query</h4>
                            <pre className="overflow-x-auto rounded-lg bg-surface-950 p-3 text-xs text-surface-300 font-mono leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto"><code>{r.sql}</code></pre>
                          </div>
                          <div className="px-5 py-3">
                            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">TypeScript Module</h4>
                            <pre className="overflow-x-auto rounded-lg bg-surface-950 p-3 text-xs text-surface-300 font-mono leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto"><code>{r.tsCode.length > 2000 ? r.tsCode.slice(0, 2000) + '\n\n// ... (truncated, full code in download ZIP)' : r.tsCode}</code></pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Scheduled Reports */}
                  {reportsExpandedSection === "scheduled" && demoResult.reportProject.scheduledConfig && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/5">
                          <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
                            <span>📅</span>Scheduled Reports Configuration
                          </h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-white/5 bg-surface-900/70">
                                <th className="text-left px-5 py-2.5 font-semibold text-surface-400 uppercase tracking-wider">Report Name</th>
                                <th className="text-left px-5 py-2.5 font-semibold text-surface-400 uppercase tracking-wider">Entity</th>
                                <th className="text-left px-5 py-2.5 font-semibold text-surface-400 uppercase tracking-wider">Schedule</th>
                                <th className="text-left px-5 py-2.5 font-semibold text-surface-400 uppercase tracking-wider">Format</th>
                                <th className="text-left px-5 py-2.5 font-semibold text-surface-400 uppercase tracking-wider">Recipients</th>
                              </tr>
                            </thead>
                            <tbody>
                              {demoResult.reportProject.scheduledConfig.map((sc, i) => (
                                <tr key={i} className="border-b border-white/5 last:border-0">
                                  <td className="px-5 py-2.5 text-surface-300 font-medium">{sc.name}</td>
                                  <td className="px-5 py-2.5 text-surface-400">{sc.entity}</td>
                                  <td className="px-5 py-2.5">
                                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                                      sc.schedule === "daily" ? "text-green-400 bg-green-500/10" :
                                      sc.schedule === "weekly" ? "text-blue-400 bg-blue-500/10" :
                                      "text-purple-400 bg-purple-500/10"
                                    }`}>{sc.schedule}</span>
                                  </td>
                                  <td className="px-5 py-2.5">
                                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded text-amber-400 bg-amber-500/10">{sc.format}</span>
                                  </td>
                                  <td className="px-5 py-2.5 text-surface-400 font-mono text-[11px]">{sc.recipients.join(", ")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="px-5 py-3 border-t border-white/5">
                          <button
                            onClick={() => {
                              const json = demoResult.scheduledConfigJson || JSON.stringify(demoResult.reportProject.scheduledConfig, null, 2);
                              navigator.clipboard.writeText(json).then(() => {
                                setReportsCopied("sched-config");
                                setTimeout(() => setReportsCopied(null), 2000);
                              }).catch(() => {});
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                          >
                            {reportsCopied === "sched-config" ? (
                              <><svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                            ) : (
                              <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy JSON</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Report Runner */}
                  {reportsExpandedSection === "runner" && demoResult.reportRunner && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">⚡</span>
                            <h3 className="text-sm font-semibold text-surface-200 font-mono">report-runner.ts</h3>
                            <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">Executes all generated reports</span>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(demoResult.reportRunner || "").then(() => {
                                setReportsCopied("runner-ts");
                                setTimeout(() => setReportsCopied(null), 2000);
                              }).catch(() => {});
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                          >
                            {reportsCopied === "runner-ts" ? (
                              <><svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                            ) : (
                              <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
                            )}
                          </button>
                        </div>
                        <div className="px-5 py-3">
                          <pre className="overflow-x-auto rounded-lg bg-surface-950 p-3 text-xs text-surface-300 font-mono leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto"><code>{demoResult.reportRunner.length > 3000 ? demoResult.reportRunner.slice(0, 3000) + '\n\n// ... (truncated, full code in download ZIP)' : demoResult.reportRunner}</code></pre>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-surface-900/50 p-4">
                        <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Report Runner API</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { fn: "runReport(db, name)", desc: "Execute a single report by name" },
                            { fn: "runAllReports(db)", desc: "Execute all registered reports" },
                            { fn: "runScheduled(db, schedule)", desc: "Run reports for daily/weekly/monthly" },
                            { fn: "getReportsDue(schedule)", desc: "List reports due for a schedule" },
                          ].map((api, i) => (
                            <div key={i} className="rounded-lg bg-surface-950/70 px-3 py-2">
                              <code className="text-xs font-mono text-brand-400">{api.fn}</code>
                              <p className="text-[11px] text-surface-500 mt-0.5">{api.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-lg">📊</span>
                    <div>
                      <h4 className="text-sm font-semibold text-green-300">Report System Complete</h4>
                      <p className="text-xs text-surface-400 mt-0.5">
                        {demoResult.reportProject.reports.length} reports &middot; {demoResult.reportProject.scheduledConfig.length} schedules &mdash;
                        SQL queries &middot; CSV/JSON/PDF exports &middot; Self-contained TypeScript modules
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: Permissions */}
              {activeTab === "permissions" && demoResult.permissionProject && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-lg">🔐</span>
                    <div>
                      <h4 className="text-sm font-semibold text-purple-300">RBAC Permission System</h4>
                      <p className="text-xs text-surface-400 mt-0.5">
                        {demoResult.permissionProject.roles.length} roles &middot; {demoResult.permissionProject.roles.reduce((s, r) => s + r.permissions.length, 0)} entity permissions &middot;
                        Hono middleware &middot; TypeScript types &middot; Seed script
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1 rounded-xl border border-white/5 bg-surface-900/70 p-1 overflow-x-auto">
                    {[
                      ["roles", "👥 Roles & Permissions"],
                      ["middleware", "⚡ RBAC Middleware"],
                      ["types", "📐 Permission Types"],
                      ["seed", "🌱 Seed Script"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setPermissionsExpandedSection(key)}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                          permissionsExpandedSection === key
                            ? "bg-surface-800 text-white shadow-sm"
                            : "text-surface-400 hover:text-surface-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Roles & Permissions Matrix */}
                  {permissionsExpandedSection === "roles" && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/5">
                          <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
                            <span>🔐</span>Permissions Matrix
                          </h3>
                          <p className="text-xs text-surface-500 mt-1">Role → Entity → Action mapping. <strong>C</strong>reate <strong>R</strong>ead <strong>U</strong>pdate <strong>D</strong>elete <strong>E</strong>xport <strong>A</strong>pprove</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-white/5 bg-surface-900/70">
                                <th className="text-left px-5 py-2.5 font-semibold text-surface-400 uppercase tracking-wider">Role</th>
                                {demoResult.permissionProject.roles.length > 0 && demoResult.permissionProject.roles[0].permissions.map((p, i) => (
                                  <th key={i} className="text-left px-4 py-2.5 font-semibold text-surface-400 uppercase tracking-wider">{p.entity}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {demoResult.permissionProject.roles.map((role, ri) => (
                                <tr key={ri} className="border-b border-white/5 last:border-0 hover:bg-surface-900/50">
                                  <td className="px-5 py-2.5">
                                    <div>
                                      <span className="text-surface-200 font-semibold">{role.name}</span>
                                      <p className="text-[10px] text-surface-500 mt-0.5">{role.description}</p>
                                    </div>
                                  </td>
                                  {role.permissions.map((perm, pi) => (
                                    <td key={pi} className="px-4 py-2.5">
                                      <div className="flex flex-wrap gap-1">
                                        {perm.actions.map((action) => {
                                          const colors: Record<string, string> = {
                                            create: "text-green-400 bg-green-500/10",
                                            read: "text-blue-400 bg-blue-500/10",
                                            update: "text-amber-400 bg-amber-500/10",
                                            delete: "text-red-400 bg-red-500/10",
                                            export: "text-cyan-400 bg-cyan-500/10",
                                            approve: "text-purple-400 bg-purple-500/10",
                                          };
                                          return (
                                            <span key={action} className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${colors[action] || "text-surface-400 bg-surface-800"}`}>
                                              {action[0].toUpperCase()}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="px-5 py-3 border-t border-white/5">
                          <button
                            onClick={() => {
                              const matrixMd = demoResult.permissionProject?.permissionsMatrix || "";
                              navigator.clipboard.writeText(matrixMd).then(() => {
                                setPermissionsCopied("matrix");
                                setTimeout(() => setPermissionsCopied(null), 2000);
                              }).catch(() => {});
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                          >
                            {permissionsCopied === "matrix" ? (
                              <><svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                            ) : (
                              <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy Matrix</>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Role Cards */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        {demoResult.permissionProject.roles.map((role, i) => (
                          <div key={i} className="rounded-xl border border-white/5 bg-surface-900/50 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg">
                                {role.name === "admin" ? "👑" : role.name === "manager" ? "🎯" : role.name === "editor" ? "✏️" : role.name === "viewer" ? "👁️" : "🎭"}
                              </span>
                              <div>
                                <h4 className="text-sm font-semibold text-surface-200 font-mono">{role.name}</h4>
                                <p className="text-[11px] text-surface-500">{role.description}</p>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              {role.permissions.map((perm, pi) => (
                                <div key={pi} className="flex items-center justify-between text-[11px]">
                                  <span className="text-surface-400">{perm.entity}</span>
                                  <div className="flex gap-1">
                                    {perm.actions.map((action) => {
                                      const colors: Record<string, string> = {
                                        create: "text-green-400 bg-green-500/10",
                                        read: "text-blue-400 bg-blue-500/10",
                                        update: "text-amber-400 bg-amber-500/10",
                                        delete: "text-red-400 bg-red-500/10",
                                        export: "text-cyan-400 bg-cyan-500/10",
                                        approve: "text-purple-400 bg-purple-500/10",
                                      };
                                      return (
                                        <span key={action} className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${colors[action] || "text-surface-400 bg-surface-800"}`}>
                                          {action}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* RBAC Middleware */}
                  {permissionsExpandedSection === "middleware" && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">⚡</span>
                            <h3 className="text-sm font-semibold text-surface-200 font-mono">rbac-middleware.ts</h3>
                            <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">Hono middleware</span>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(demoResult.permissionProject?.rbacMiddleware || "").then(() => {
                                setPermissionsCopied("middleware");
                                setTimeout(() => setPermissionsCopied(null), 2000);
                              }).catch(() => {});
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                          >
                            {permissionsCopied === "middleware" ? (
                              <><svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                            ) : (
                              <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
                            )}
                          </button>
                        </div>
                        <div className="px-5 py-3">
                          <pre className="overflow-x-auto rounded-lg bg-surface-950 p-3 text-xs text-surface-300 font-mono leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto"><code>{(demoResult.permissionProject?.rbacMiddleware || "").length > 3000 ? (demoResult.permissionProject?.rbacMiddleware || "").slice(0, 3000) + "\n\n// ... (truncated, full code in download ZIP)" : (demoResult.permissionProject?.rbacMiddleware || "")}</code></pre>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-surface-900/50 p-4">
                        <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Middleware API</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { fn: "rbacMiddleware", desc: "Attaches user/role to context (no denial)" },
                            { fn: "requireRole('admin')", desc: "Restrict route to specific role" },
                            { fn: "requirePermission('Booking', 'read')", desc: "Check entity + action permission" },
                            { fn: "autoEnforceRbac", desc: "Auto-infer entity + action from request" },
                          ].map((api, i) => (
                            <div key={i} className="rounded-lg bg-surface-950/70 px-3 py-2">
                              <code className="text-xs font-mono text-brand-400">{api.fn}</code>
                              <p className="text-[11px] text-surface-500 mt-0.5">{api.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Permission Types */}
                  {permissionsExpandedSection === "types" && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">📐</span>
                            <h3 className="text-sm font-semibold text-surface-200 font-mono">types.ts</h3>
                            <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">TypeScript definitions</span>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(demoResult.permissionProject?.permissionTypes || "").then(() => {
                                setPermissionsCopied("types");
                                setTimeout(() => setPermissionsCopied(null), 2000);
                              }).catch(() => {});
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                          >
                            {permissionsCopied === "types" ? (
                              <><svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                            ) : (
                              <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
                            )}
                          </button>
                        </div>
                        <div className="px-5 py-3">
                          <pre className="overflow-x-auto rounded-lg bg-surface-950 p-3 text-xs text-surface-300 font-mono leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto"><code>{(demoResult.permissionProject?.permissionTypes || "").length > 2000 ? (demoResult.permissionProject?.permissionTypes || "").slice(0, 2000) + "\n\n// ... (truncated, full code in download ZIP)" : (demoResult.permissionProject?.permissionTypes || "")}</code></pre>
                        </div>
                      </div>

                      {/* Permissions Object */}
                      <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">📋</span>
                            <h3 className="text-sm font-semibold text-surface-200 font-mono">permissions.ts</h3>
                            <span className="text-[10px] font-medium text-surface-600 uppercase tracking-wider">Permissions object</span>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(demoResult.permissionProject?.permissionsObject || "").then(() => {
                                setPermissionsCopied("permObj");
                                setTimeout(() => setPermissionsCopied(null), 2000);
                              }).catch(() => {});
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                          >
                            {permissionsCopied === "permObj" ? (
                              <><svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                            ) : (
                              <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
                            )}
                          </button>
                        </div>
                        <div className="px-5 py-3">
                          <pre className="overflow-x-auto rounded-lg bg-surface-950 p-3 text-xs text-surface-300 font-mono leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto"><code>{(demoResult.permissionProject?.permissionsObject || "").length > 2000 ? (demoResult.permissionProject?.permissionsObject || "").slice(0, 2000) + "\n\n// ... (truncated, full code in download ZIP)" : (demoResult.permissionProject?.permissionsObject || "")}</code></pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Seed Script */}
                  {permissionsExpandedSection === "seed" && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/5 bg-surface-900/50 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">🌱</span>
                            <h3 className="text-sm font-semibold text-surface-200 font-mono">seed-roles.ts</h3>
                            <span className="text-[10px] font-medium text-green-500/70 uppercase tracking-wider bg-green-500/10 px-2 py-0.5 rounded">idempotent</span>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(demoResult.permissionProject?.seedScript || "").then(() => {
                                setPermissionsCopied("seed");
                                setTimeout(() => setPermissionsCopied(null), 2000);
                              }).catch(() => {});
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-xs font-medium text-surface-300 transition-all hover:bg-surface-700 hover:text-white"
                          >
                            {permissionsCopied === "seed" ? (
                              <><svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                            ) : (
                              <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
                            )}
                          </button>
                        </div>
                        <div className="px-5 py-3">
                          <pre className="overflow-x-auto rounded-lg bg-surface-950 p-3 text-xs text-surface-300 font-mono leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto"><code>{(demoResult.permissionProject?.seedScript || "").length > 3000 ? (demoResult.permissionProject?.seedScript || "").slice(0, 3000) + "\n\n// ... (truncated, full code in download ZIP)" : (demoResult.permissionProject?.seedScript || "")}</code></pre>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-surface-900/50 p-4">
                        <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Seed Script Features</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { fn: "seedRoles(db)", desc: "Create/update default roles in database" },
                            { fn: "ON CONFLICT idempotent", desc: "Safe to run multiple times" },
                            { fn: "CREATE TABLE roles", desc: "Auto-creates roles + user_roles tables" },
                            { fn: "bun run seed-roles.ts", desc: "Standalone CLI runner" },
                          ].map((api, i) => (
                            <div key={i} className="rounded-lg bg-surface-950/70 px-3 py-2">
                              <code className="text-xs font-mono text-brand-400">{api.fn}</code>
                              <p className="text-[11px] text-surface-500 mt-0.5">{api.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

{/* "What's next?" CTA */}
              <div className="rounded-2xl border border-white/10 bg-surface-900/70 p-6 text-center">
                <h3 className="font-semibold text-lg">
                  Ready to build the real thing?
                </h3>
                <p className="mt-1 text-sm text-surface-400">
                  Join the waitlist to get early access when Genesis launches. This blueprint
                  becomes a fully deployable application.
                </p>
                <button
                  onClick={() => {
                    document
                      .getElementById("waitlist")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-surface-900 transition-all hover:bg-surface-200"
                >
                  Join the Waitlist
                  <span>→</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Genesis AI ──────────────────────────────────────── */}
      <section className="border-t border-white/5 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/5 px-4 py-1.5">
            <span className="text-sm font-medium text-purple-300">
              The Self-Expanding Ecosystem
            </span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Genesis <span className="gradient-text">AI</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-surface-400">
            The platform's first generated product is itself an autonomous business
            operating system. Genesis AI can generate customized business platforms
            for any organization — CRM, ERP, LMS, or something entirely new. Every
            generated application feeds back into the engine, making the platform
            smarter with each generation.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { title: "Self-Generating", desc: "Genesis AI generates itself — the platform builds the platform" },
              { title: "Self-Improving", desc: "Every generated app trains the engine, expanding capabilities" },
              { title: "Infinitely Scalable", desc: "From single feature to enterprise suite — no limits" },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/5 bg-surface-900/50 p-5"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 text-lg">
                  {["🔄", "🧠", "∞"][i]}
                </div>
                <h3 className="font-semibold text-sm">{item.title}</h3>
                <p className="mt-1 text-xs text-surface-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Waitlist ────────────────────────────────────────── */}
      <section
        id="waitlist"
        className="border-t border-white/5 px-6 py-24 sm:py-32"
      >
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Get early <span className="gradient-text">access</span>
          </h2>
          <p className="mt-4 text-surface-400">
            Join the waitlist to be first in line when Genesis launches. Early
            members get priority access and founding-tier pricing.
          </p>

          <form
            onSubmit={handleWaitlist}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="email"
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              placeholder="you@company.com"
              className="flex-1 rounded-xl border border-white/10 bg-surface-900/70 px-5 py-3 text-sm text-white placeholder-surface-500 outline-none transition-all focus:border-brand-500/30 focus:glow"
              disabled={waitlistStatus === "submitting"}
            />
            <button
              type="submit"
              disabled={waitlistStatus === "submitting" || !waitlistEmail.trim()}
              className="rounded-xl bg-brand-500 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {waitlistStatus === "submitting" ? "Joining..." : "Join Waitlist"}
            </button>
          </form>

          {waitlistMessage && (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                waitlistStatus === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}
            >
              {waitlistMessage}
            </div>
          )}

          <p className="mt-4 text-xs text-surface-600">
            No spam, ever. We'll only email you when Genesis launches.
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/5 px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-500 text-xs font-bold text-white">
              G
            </span>
            <span className="text-sm font-semibold">Genesis Platform</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-surface-500">
            <a href="#demo" className="transition-colors hover:text-white">
              Demo
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-white">
              How it Works
            </a>
            <a href="#waitlist" className="transition-colors hover:text-white">
              Waitlist
            </a>
          </div>

          <p className="text-xs text-surface-600">
            © {new Date().getFullYear()} Genesis Platform. Built with{" "}
            <a
              href="https://cto.new"
              className="underline hover:text-surface-400"
            >
              cto.new
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
