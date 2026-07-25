# START HERE — DonationPlatform

Use this once to set up, then use the **resume prompt** for every session after.

## 1. Put the files in your repo like this
```
your-repo/
├── CLAUDE.md          ← root (Claude Code auto-reads this every session)
├── TASKS.md           ← root
├── PROGRESS.md        ← root
├── START_HERE.md      ← root (this file)
└── docs/
    ├── PRD.md
    ├── DECISIONS.md
    └── IDEAS.md
```

## 2. Open Claude Code in the repo, and paste this KICKOFF prompt (first session only)

```
Read CLAUDE.md, docs/PRD.md, TASKS.md, PROGRESS.md, and docs/DECISIONS.md to load full context.

We are starting Milestone 0 (Project setup) from TASKS.md. Confirm the stack from CLAUDE.md §6
(React Native + Expo prebuild, React web panels, Node backend on Railway, PostgreSQL, object-storage
bucket + CDN for images, WebSockets, Expo push), then:

1. Scaffold the repo structure: /mobile (Expo), /web-panel (React), /admin (React), /backend (Node),
   /docs. Set up a PostgreSQL connection on the backend.
2. Implement the role model + phone-OTP auth. In dev the OTP is static 123456 (per D-015) — leave a
   clearly-marked TODO that this MUST be replaced with a real, rate-limited provider before launch.
3. Implement the Admin + Staff RBAC per D-018 (staff can verify/accept + list users, but cannot edit
   users/settings, manage staff, or override).

Do ONE task at a time. Before you stop, check off completed items in TASKS.md and update PROGRESS.md
with what you did and what's next. Log any new decision in docs/DECISIONS.md.
Ask me before making any assumption that isn't already settled in the docs.
```

## 3. Every session after that, paste the RESUME prompt (also in CLAUDE.md §0)

```
Read CLAUDE.md, docs/PRD.md, TASKS.md, and PROGRESS.md to load full context.
Then continue from the next unchecked task in TASKS.md.
When you finish: check it off, and before we stop, update PROGRESS.md.
```

## Notes
- The **only** open decision left is **O-10** (legal: terms, privacy policy, KYC/health-data
  retention) — not code, but needed before real users.
- Per-flow specs (PRD §7–§13) and cross-cutting specs (§15–§24) are written **just before** each
  milestone, against real requirements.
- Reminder: static OTP `123456` is dev-only and must never reach production.
