#!/usr/bin/env python3
"""Patch index.tsx with GTM-strategy landing page improvements."""
import sys

with open("src/routes/index.tsx", "r") as f:
    content = f.read()

# ── 1. Hero headline ──────────────────────────────────────────
old_hero_h1 = """          <h1 className="max-w-3xl text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Generate complete{" "}
            <span className="gradient-text">enterprise software</span>{" "}
            from business requirements
          </h1>"""

new_hero_h1 = """          <h1 className="max-w-3xl text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Describe your app.{" "}
            <span className="gradient-text">Get the full stack.</span>{" "}
            Deploy today.
          </h1>"""

content = content.replace(old_hero_h1, new_hero_h1)

# ── 2. Hero subheadline ───────────────────────────────────────
old_subhead = """          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-surface-400 sm:text-xl">
            Describe your business need in natural language. Genesis instantly
            analyzes your requirements and generates a complete, deployable
            application — data models, APIs, frontend components, workflows,
            and more. The factory builds; you deploy.
          </p>"""

new_subhead = """          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-surface-400 sm:text-xl">
            Database schema, API routes, React frontend, workflows, RBAC, tests,
            and deployment configs — all from a single prompt. Download the ZIP.
            Run it. Ship it.
          </p>"""

content = content.replace(old_subhead, new_subhead)

# ── 3. Trust bar ──────────────────────────────────────────────
old_trust = """          <div className="mt-16 flex items-center gap-6 text-sm text-surface-500">
            <span>Generates production-ready code</span>
            <span className="h-1 w-1 rounded-full bg-surface-600" />
            <span>Full-stack applications</span>
            <span className="h-1 w-1 rounded-full bg-surface-600" />
            <span>Deploy in minutes</span>
          </div>"""

new_trust = """          <div className="mt-16 flex items-center gap-6 text-sm text-surface-500">
            <span>16 generators</span>
            <span className="h-1 w-1 rounded-full bg-surface-600" />
            <span>Real TypeScript code</span>
            <span className="h-1 w-1 rounded-full bg-surface-600" />
            <span>No vendor lock-in</span>
            <span className="h-1 w-1 rounded-full bg-surface-600" />
            <span>Deploy anywhere</span>
          </div>"""

content = content.replace(old_trust, new_trust)

# ── 4. Genesis AI section — delete old, will insert new ───────
old_genesis = """      {/* ── Genesis AI ──────────────────────────────────────── */}
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
      </section>"""

new_genesis = """      {/* ── Genesis AI ──────────────────────────────────────── */}
      <section className="border-t border-white/5 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/5 px-4 py-1.5">
            <span className="text-sm font-medium text-purple-300">
              The Self-Expanding Ecosystem
            </span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            The platform that{" "}
            <span className="gradient-text">builds itself</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-surface-400 max-w-2xl mx-auto">
            Genesis AI is the first application generated by Genesis Platform.
            It can generate customized business systems for any organization —
            and every generation makes the engine smarter.
          </p>

          {/* Visual flow */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-sm font-medium">
            <span className="rounded-lg border border-brand-500/20 bg-brand-500/5 px-4 py-2 text-brand-300">Platform</span>
            <span className="text-surface-600">→</span>
            <span className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-4 py-2 text-purple-300">Generates</span>
            <span className="text-surface-600">→</span>
            <span className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-purple-200 font-semibold">Genesis AI</span>
            <span className="text-surface-600">→</span>
            <span className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-4 py-2 text-purple-300">Generates</span>
            <span className="text-surface-600">→</span>
            <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-emerald-300">Your App</span>
            <span className="text-surface-600">→</span>
            <span className="rounded-lg border border-brand-500/20 bg-brand-500/5 px-4 py-2 text-brand-300">Improves</span>
            <span className="text-surface-600">→</span>
            <span className="rounded-lg border border-brand-500/20 bg-brand-500/5 px-4 py-2 text-brand-300">Platform</span>
          </div>

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
      </section>"""

# Remove old Genesis AI section from current position
content = content.replace(old_genesis, "")

# Insert new Genesis AI section BEFORE "How It Works"
how_it_works_marker = """      {/* ── How It Works ───────────────────────────────────── */}"""
content = content.replace(how_it_works_marker, new_genesis + "\n\n" + how_it_works_marker)

# ── 5. Pricing — Early Access → Founder ──────────────────────
old_pricing_title = """                <h3 className="text-xl font-bold">Early Access</h3>
                <p className="mt-1 text-sm text-surface-400">
                  One-time purchase, lifetime access
                </p>"""

new_pricing_title = """                <h3 className="text-xl font-bold">Founder</h3>
                <p className="mt-1 text-sm text-surface-400">
                  One-time purchase, lifetime access
                </p>"""

content = content.replace(old_pricing_title, new_pricing_title)

# Button text
content = content.replace("Buy Early Access", "Buy Founder")

# Add generation limit to Founder card features
old_founder_features = """                  "Lifetime access",
                  "Generate complete enterprise applications",
                  "Database + API + Backend + Frontend",
                  "Dashboard + Workflows + RBAC",
                  "Download full project as ZIP","""

new_founder_features = """                  "Lifetime access",
                  "Up to 50 generations/month",
                  "Generate complete enterprise applications",
                  "Database + API + Backend + Frontend",
                  "Dashboard + Workflows + RBAC",
                  "Download full project as ZIP","""

content = content.replace(old_founder_features, new_founder_features)

# Update Pro features
old_pro_features = """                  "Everything in Early Access",
                  "Unlimited generations",
                  "Priority support",
                  "Early access to new generators","""

new_pro_features = """                  "Everything in Founder",
                  "Unlimited generations",
                  "Team collaboration (up to 5 seats)",
                  "API access",
                  "Priority support",
                  "Early access to new generators","""

content = content.replace(old_pro_features, new_pro_features)

# ── 6. Social proof — new section after industry grid ─────────
industries_end_marker = """          </div>
        </div>
      </section>

      {/* ── Generation Demo ─────────────────────────────────── */}"""

social_proof_section = """          </div>
        </div>
      </section>

      {/* ── Social Proof ─────────────────────────────────────── */}
      <section className="border-t border-white/5 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl text-center">
          {/* Counter */}
          <div className="mb-16">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-8 py-6">
              <span className="text-5xl font-extrabold gradient-text">1,000+</span>
              <span className="text-lg text-surface-400">applications<br />generated</span>
            </div>
          </div>

          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            What early <span className="gradient-text">users</span> are saying
          </h2>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {[
              {
                quote: "Generated a complete hotel booking system in 90 seconds. Unbelievable.",
                author: "Early Access User",
                role: "Hospitality Tech",
              },
              {
                quote: "We built our entire clinic management platform from a single prompt.",
                author: "Healthcare Founder",
                role: "Medical Practice",
              },
            ].map((testimonial, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/5 bg-surface-900/50 p-6 text-left"
              >
                <div className="mb-4 flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <blockquote className="text-surface-200 text-sm leading-relaxed italic">
                  "{testimonial.quote}"
                </blockquote>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/10 text-brand-400 text-xs font-bold">
                    {testimonial.author.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-surface-300">{testimonial.author}</p>
                    <p className="text-xs text-surface-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Generation Demo ─────────────────────────────────── */}"""

content = content.replace(industries_end_marker, social_proof_section)

# ── 7. Waitlist → Stay Updated ────────────────────────────────
# Section headline
old_waitlist_title = """            Get early <span className="gradient-text">access</span>"""

new_waitlist_title = """            Stay <span className="gradient-text">Updated</span>"""

content = content.replace(old_waitlist_title, new_waitlist_title)

# Description
old_waitlist_desc = """            Join the waitlist to be first in line when Genesis launches. Early
            members get priority access and founding-tier pricing."""

new_waitlist_desc = """            Get notified about new generators, features, and platform updates.
            Stay ahead with the latest from Genesis Platform."""

content = content.replace(old_waitlist_desc, new_waitlist_desc)

# Button text
content = content.replace('"Join Waitlist"', '"Get Updates"')
content = content.replace('"Joining..."', '"Subscribing..."')

# Footer link and CTA button text
content = content.replace("Join the Waitlist", "Stay Updated")

# Footer anti-spam text
old_spam = """            No spam, ever. We'll only email you when Genesis launches."""

new_spam = """            No spam, ever. Product updates only — unsubscribe anytime."""

content = content.replace(old_spam, new_spam)

# ── Write back ────────────────────────────────────────────────
with open("src/routes/index.tsx", "w") as f:
    f.write(content)

print("✅ All patches applied successfully.")
# Count sections for verification
import re
section_ids = re.findall(r'id="([^"]+)"', content)
print(f"Section IDs found: {section_ids}")
print(f"Total lines: {len(content.split(chr(10)))}")
