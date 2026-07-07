# 🧠 The Security Brain
### Master vulnerability & secure-coding reference (OWASP, CWE, env, and dev checklist)

> **How to use this with me:** Upload your project files (or paste code) in this chat, and I'll go through it file-by-file against this checklist — flag real issues, explain *why* each one is dangerous, and fix them directly in your code. This document is the "brain" I'll be checking against. Treat it as living — re-paste it into future sessions or keep it in your repo as `SECURITY.md`.

---

## 1. OWASP Top 10 — 2025 (current, replaces 2021)

Released as the 8th edition, based on ~175k CVE records. Biggest shift: misconfiguration and supply-chain risk now outrank classic injection.

| # | Category | Was (2021) | What it means |
|---|---|---|---|
| A01 | **Broken Access Control** | #1 (unchanged) | Users can reach data/functions they shouldn't — including SSRF, which got folded into this category. Includes API-specific BOLA/BFLA (broken object/function-level authorization). |
| A02 | **Security Misconfiguration** | #5 → ↑#2 | Default creds, debug endpoints left on, open cloud storage buckets, missing security headers, unhardened containers. |
| A03 | **Software Supply Chain Failures** | #6 (was "Vulnerable & Outdated Components") → ↑#3 | Now covers the *whole* chain: third-party libraries, build tools, CI/CD, IDE plugins, even AI-generated code with unverified dependencies. |
| A04 | **Cryptographic Failures** | #2 → ↓#4 | Weak/missing encryption, bad key management, plaintext storage or transit of sensitive data. |
| A05 | **Injection** | #3 → ↓#5 | SQL/NoSQL/OS command/LDAP injection — untrusted input reaching an interpreter. Still huge, just relatively less dominant than before. |
| A06 | **Insecure Design** | #4 → ↓#6 | Missing threat modeling; the flaw is architectural, not a typo in the code. |
| A07 | **Authentication Failures** | #7 (renamed) | Weak/reused passwords, broken session handling, no MFA, no brute-force protection. |
| A08 | **Software or Data Integrity Failures** | #8 (unchanged) | Untrusted deserialization, unsigned updates/CI artifacts, missing integrity checks. |
| A09 | **Security Logging & Alerting Failures** | #9 (renamed) | Logs exist but nobody (and nothing) is alerted when something bad happens. |
| A10 | **Mishandling of Exceptional Conditions** | New | Improper error handling, "fail open" logic, unhandled edge cases that quietly bypass security. |

## 2. OWASP Top 10 — 2021 (previous edition — still useful, many older codebases/audits reference it)

1. Broken Access Control
2. Cryptographic Failures
3. Injection
4. Insecure Design
5. Security Misconfiguration
6. Vulnerable and Outdated Components
7. Identification and Authentication Failures
8. Software and Data Integrity Failures
9. Security Logging and Monitoring Failures
10. Server-Side Request Forgery (SSRF)

## 3. OWASP API Security Top 10 (if you have an API/backend)

Distinct list, same spirit — biggest API-specific risks: Broken Object Level Authorization (BOLA), Broken Authentication, Broken Object Property Level Authorization, Unrestricted Resource Consumption, Broken Function Level Authorization, Unrestricted Access to Sensitive Business Flows, Server Side Request Forgery, Security Misconfiguration, Improper Inventory Management, Unsafe Consumption of APIs.

## 4. CWE Top 25 Most Dangerous Software Weaknesses (MITRE, 2024 data — latest fully published edition)

The CWE list ranks *root-cause code weaknesses* by real-world CVE frequency × severity. Top of the list, in order:

1. **CWE-79** — Cross-Site Scripting (XSS)
2. **CWE-787** — Out-of-bounds Write
3. **CWE-89** — SQL Injection
4. **CWE-352** — Cross-Site Request Forgery (CSRF)
5. **CWE-22** — Path Traversal
6. **CWE-78** — OS Command Injection
7. **CWE-416** — Use After Free
8. **CWE-862** — Missing Authorization
9. **CWE-434** — Unrestricted Upload of File with Dangerous Type
10. **CWE-94** — Code Injection
11. **CWE-20** — Improper Input Validation
12. **CWE-77** — Command Injection
13. **CWE-287** — Improper Authentication
14. **CWE-269** — Improper Privilege Management
15. **CWE-502** — Deserialization of Untrusted Data

(Full ranked list of 25, with code-level examples per language, is published at cwe.mitre.org/top25 — worth bookmarking, it updates yearly, usually each November.)

---

## 5. Secure Coding Checklist — Do / Don't, by category

### Input validation & injection
- ✅ Validate and sanitize **all** input server-side (never trust client-side validation alone).
- ✅ Use parameterized queries / prepared statements or an ORM — never string-concatenate SQL.
- ✅ Escape output based on context (HTML, JS, URL, attribute) to stop XSS.
- ❌ Don't build shell commands from user input. If unavoidable, use an allow-list, never an exec() with raw strings.
- ❌ Don't trust `Content-Type` headers or file extensions as proof of file type.

### Authentication & sessions
- ✅ Hash passwords with bcrypt/argon2/scrypt — never MD5/SHA1, never plaintext.
- ✅ Enforce MFA for privileged accounts; rate-limit and lock out after repeated failed logins.
- ✅ Use short-lived, signed session tokens (JWT with expiry, or server-side sessions) over HTTPS only, `HttpOnly` + `Secure` + `SameSite` cookies.
- ❌ Don't roll your own crypto or session scheme.
- ❌ Don't put sensitive data inside a JWT payload unencrypted (it's base64, not encrypted).

### Access control
- ✅ Check authorization on **every** request server-side, including for object-level access (don't just check "is logged in" — check "is allowed to access *this* record").
- ✅ Default-deny: explicit allow rules, not explicit deny rules.
- ❌ Don't rely on hiding a URL/button as your only protection ("security by obscurity").

### Secrets, env vars & cryptography
- ✅ Keep all secrets (API keys, DB creds, JWT signing keys) in environment variables or a secrets manager (Vault, AWS Secrets Manager, Doppler) — never hardcoded in source.
- ✅ Add `.env`, `*.pem`, `*.key` to `.gitignore` **before** the first commit. Use `.env.example` with dummy values for onboarding.
- ✅ Use TLS 1.2+ everywhere; rotate secrets on a schedule and immediately after any suspected leak.
- ❌ Don't commit `.env` files, cloud credentials, or private keys to git — even in a private repo (history persists, and repos get leaked or made public by accident).
- ❌ Don't log secrets, tokens, or full card/SSN numbers, even at debug level.

### Dependencies / supply chain
- ✅ Pin dependency versions; run `npm audit` / `pip-audit` / `safety` / Dependabot or similar regularly.
- ✅ Verify package names carefully before installing (typosquatting is common: `reqeusts` vs `requests`).
- ✅ Use lockfiles (`package-lock.json`, `poetry.lock`) and commit them.
- ❌ Don't install random packages from search results without checking download counts / maintenance status / repo activity.

### File uploads
- ✅ Restrict allowed file types by content inspection (magic bytes), not extension.
- ✅ Store uploads outside the web root or in object storage with no execute permission; rename files (don't trust user-supplied filenames).
- ❌ Don't allow uploads to be served back as executable scripts.

### CORS & security headers
- ✅ Set `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options` (or CSP frame-ancestors), `Strict-Transport-Security`, `Referrer-Policy`.
- ✅ Set an explicit CORS allow-list of origins.
- ❌ Don't set `Access-Control-Allow-Origin: *` on any endpoint that handles authenticated/sensitive data.

### Error handling & logging
- ✅ Log security-relevant events (logins, failed auth, privilege changes, admin actions) with enough context to investigate later, and route them to alerting (not just a file nobody reads).
- ✅ Return generic error messages to users; log full details server-side only.
- ❌ Don't show stack traces, SQL errors, or internal paths to the end user.
- ❌ Don't "fail open" — if a security check errors, the safe default is to deny.

### Rate limiting & abuse prevention
- ✅ Rate-limit login, password reset, signup, and any expensive endpoint.
- ✅ Add CAPTCHA or equivalent on public-facing forms prone to abuse.

---

## 6. Environment & infrastructure checklist

- ✅ Separate configs for dev/staging/prod; production never uses debug mode or verbose error pages.
- ✅ No default credentials anywhere (DB admin, cloud console, container images).
- ✅ Cloud storage buckets private by default; explicitly opt-in to public access only where truly needed.
- ✅ Infrastructure-as-code (Terraform, Dockerfiles, Helm charts) reviewed with the same rigor as application code — this is the #2 risk in 2025 for a reason.
- ✅ Principle of least privilege for every service account / IAM role.
- ✅ Automatic security patching for OS/runtime where possible.

## 7. Maintenance cadence (the part people skip)

| Activity | Suggested frequency |
|---|---|
| Dependency vulnerability scan | Every PR / at least weekly (automated) |
| Full dependency upgrade pass | Monthly |
| Secret rotation | Quarterly, or immediately on suspected leak |
| Security header / config review | Each deploy |
| Manual code review for new auth/access-control logic | Every PR touching it |
| External penetration test | Annually, or before major launches |
| Review this checklist against the latest OWASP/CWE release | Annually (OWASP Top 10 revises every few years; CWE Top 25 revises yearly, usually November) |

## 8. Prompt template — using this with an AI to check your own code

```
Using the OWASP Top 10:2025, CWE Top 25, and the secure-coding checklist below,
review [this file / this repo] for:
1. Any matching vulnerability class, with the specific OWASP/CWE category cited
2. Severity (Critical/High/Medium/Low) and why
3. A concrete fix — show the corrected code, not just a description

[paste the checklist above, then paste or upload your code]
```

That's exactly the workflow I'll run for you directly in this chat once you upload your code — no need for a separate tool.
