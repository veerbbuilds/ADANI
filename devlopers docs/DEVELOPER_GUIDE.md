# 👷 Developer Security Guide
### Who owns what, and what to do at every stage of building the app

> Pairs with `security-brain.md` (the vulnerability/checklist reference) and `SELF_HEALING.md` (auto-remediation). If it's just you right now, you hold every role below — the point isn't org-chart theater, it's making sure each responsibility has an explicit owner instead of silently falling through the cracks as the project grows.

---

## 1. Roles & responsibilities

| Role | Owns | Minimum if you're solo |
|---|---|---|
| **Security champion** | Keeps this guide current, reviews new OWASP/CWE releases annually, triages security reports | You — block 30 min/quarter for it |
| **Code owner / reviewer** | No code merges without a second look at auth, access control, and input handling | Self-review with the checklist below before every merge |
| **Secrets & infra owner** | Where secrets live, rotation schedule, who has prod access | You — write it down even if it's just you |
| **Dependency owner** | Watches for vulnerable packages, approves upgrades | Automated (Dependabot/Renovate) + a human glance weekly |
| **Incident commander** | Runs the room during an active incident, decides containment actions | You, with the runbook in §7 printed somewhere you can find it at 2am |
| **On-call / monitoring owner** | Watches alerts, responds to pages | You, with alerting actually wired to a phone — not just a dashboard nobody looks at |

As the team grows, split these explicitly rather than assuming "someone" handles it. The #1 root cause behind real breaches is not a missing tool — it's an unowned gap.

## 2. Secure SDLC — what to do at each stage

**Design**
- Threat-model anything touching auth, payments, or PII before writing code (even 15 minutes with STRIDE: Spoofing / Tampering / Repudiation / Info disclosure / DoS / Elevation of privilege).
- Decide data classification up front: what's PII, what's a secret, what's public.

**Build**
- Follow the secure-coding checklist in `security-brain.md` §5 as you write, not after.
- Never commit `.env`, keys, or credentials — set up `.gitignore` *before* the first commit, not after the first leak.
- Use the framework's built-in protections (CSRF tokens, ORM parameterization, templating auto-escaping) instead of hand-rolling them.

**Review**
- Every PR touching authentication, authorization, payments, file uploads, or external input gets a second human reviewer, no exceptions — this is the single highest-leverage control on the list.
- Reviewer checklist: Does this validate input server-side? Does this check *object-level* authorization, not just "is logged in"? Are secrets pulled from env, not hardcoded? Are errors generic to the user but logged in detail server-side?

**Test**
- Unit/integration tests for auth and access-control logic specifically — these are the ones that quietly regress.
- Run a dependency audit (`npm audit`, `pip-audit`, etc.) as a CI step that fails the build on new criticals.
- Run a static analysis / SAST tool (Semgrep, CodeQL, Bandit, ESLint security plugins) in CI.

**Deploy**
- No debug mode, verbose stack traces, or admin endpoints reachable in production.
- Security headers and HTTPS enforced at the edge (reverse proxy / CDN), not just hoped-for in app code.
- Deploy behind a process supervisor or orchestrator with health checks (see `SELF_HEALING.md`) so a crash isn't an outage.

**Monitor & respond**
- Centralized logging for auth events, errors, and admin actions — with actual alerting, not just storage.
- Review the incident runbook in §7 before you need it, not during.

## 3. Code review checklist (printable)

- [ ] Input validated server-side
- [ ] Output encoded for context (HTML/JS/URL)
- [ ] Parameterized queries / ORM used — no string-built SQL
- [ ] Authorization checked per-object, not just per-session
- [ ] No secrets, keys, or credentials in the diff
- [ ] Errors don't leak stack traces / internal paths to the client
- [ ] New dependency checked for maintenance status and known CVEs
- [ ] Logging added for security-relevant actions (login, password change, privilege change, deletes)

## 4. Secrets & environment management

- One `.env.example` with dummy values committed; the real `.env` never committed.
- Production secrets live in a secrets manager or the platform's env-var store (Vercel/Render/AWS Secrets Manager/Doppler) — not in Slack, not in a shared doc.
- Rotate immediately if a secret ever touches a log, a screenshot, or a public repo, even briefly.
- Different secrets per environment (dev/staging/prod) — a staging leak should never compromise prod.

## 5. Dependency management

- Lockfiles committed (`package-lock.json`, `poetry.lock`, etc.).
- Automated PRs for updates (Dependabot/Renovate) reviewed weekly, not left to pile up.
- Before adding a new package: check last-publish date, download count, and open security advisories. A 2-star repo last updated in 2021 is a liability, not a shortcut.

## 6. CI/CD security gates

Minimum pipeline for a small project:
1. Lint + unit tests
2. Dependency audit (fail on new high/critical)
3. SAST scan (Semgrep/CodeQL free tiers work fine for small projects)
4. Secret scanning on the diff (gitleaks/truffleHog) — catches the "oops, committed a key" moment before it merges
5. Deploy only from a protected branch, with required review

## 7. Incident response runbook (the 2am version)

1. **Detect** — alert fires, or someone reports something odd.
2. **Contain** — rotate the affected credential/key *immediately*, even before you fully understand scope. Revoke sessions if account compromise is suspected. Isolate the affected service if it's actively being abused.
3. **Eradicate** — patch the root cause, not just the symptom.
4. **Recover** — restore from a known-good backup/deploy if data or code integrity is in question. Verify before declaring "all clear."
5. **Notify** — users/regulators as required by law (GDPR, state breach-notification laws, etc. — this is a legal question, not just a technical one; loop in counsel if real user data was exposed).
6. **Postmortem** — blameless write-up: what happened, what the gap was, what changes (process or code) close it. Feed it back into this guide.

## 8. Access lifecycle

- New contributor: least-privilege access granted, MFA required from day one.
- Departing contributor/contractor: access revoked same day — credentials, repo access, cloud console, everything. Keep a simple checklist; "access audits" fail almost entirely because of forgotten edge accounts, not exotic attacks.

## 9. Keep this living

- Re-check `security-brain.md` against the latest OWASP Top 10 and CWE Top 25 annually (CWE updates yearly, usually November; OWASP every few years).
- Subscribe to CISA's KEV catalog or your stack's security advisories for anything you depend on directly (framework, DB, reverse proxy).
