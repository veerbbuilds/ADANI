# Workspace Rules for AI Agents (Antigravity)

Welcome! As an AI coding assistant in this repository, you must follow these rules to ensure high-quality code generation, eliminate hallucinations, and perform self-reflection before completing any task.

---

## 1. The GSD (Get Shit Done) Process
For every complex change requested:
1. **Never skip planning**: Do not write code immediately. Create or update the `implementation_plan.md` in the artifacts directory.
2. **Review security standards**: Read `devlopers docs/security-brain.md` to ensure your plan follows OWASP Top 10 and CWE standards.
3. **Wait for user approval**: Do not modify files until the user reviews and clicks "Proceed".

---

## 2. CodeRabbit Senior Developer Review Check
When editing or creating routes and front-end components:
- **Cookie Security**: Verify all endpoints check cookie-based session roles via `checkPermission(...)` inside `src/lib/authHelper.ts`.
- **IP Rate Limiting**: Wrap sensitive actions with `RateLimiter` from `src/lib/rateLimiter.ts`.
- **API Read Caching**: Use `ApiCache.getLogs(...)` in read requests and trigger `ApiCache.invalidate()` on write/delete requests.
- **Fail Deny**: Always return generic client errors, and log technical traces server-side only.

---

## 3. The Reflection Loop
Before ending your turn, you must perform self-verification:
1. Run `npx tsc --noEmit` to confirm no TypeScript compile warnings or errors exist.
2. Run `npx next build --webpack` to confirm production builds bundle cleanly.
3. If errors are output, you are in a **Reflection Loop**: debug the issue, apply code corrections, and re-run compilation checks. Do not stop until all tests compile cleanly.
