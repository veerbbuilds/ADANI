---
name: gsd-reflection-loop
description: Enforces a Get Shit Done (GSD) phase-driven workflow with an autonomous reflection retry loop and CodeRabbit-style senior developer code review checks.
---

# 🤖 GSD Spec-Driven Reflection Loop Skill

Use this skill when developing, refactoring, or debugging code in this workspace. It structures your workflow into strict phases, executes a "Senior Developer Code Review" (CodeRabbit-style), and runs a "Reflection Verification Loop" until the project builds successfully.

---

## 1. Phase 1: Planning & GSD Spec (Get Shit Done)
To minimize hallucinations:
1. **Research first**: Search and read active code files. Do not modify files during planning.
2. **Draft Plan**: Create/update `implementation_plan.md` in the artifacts directory.
3. **Include checks**: Explicitly map out the files to change and the testing commands.
4. **Acquire Consent**: Request user approval before executing changes.

## 2. Phase 2: Execution & Code Writing
- Implement code in small, logical chunks.
- Add robust error handling (CWE-209 / OWASP A10): wrap code in `try-catch` blocks, log detailed info server-side, and return generic messages to clients.
- Apply security best practices from `devlopers docs/security-brain.md` (e.g. rate-limiting expensive endpoints, verifying cookies session token).

## 3. Phase 3: CodeRabbit Senior Developer Review
Before verifying, run a self-review checklist:
- [ ] **Auth Check**: Are all endpoints protected with `checkPermission(...)` session checks?
- [ ] **Rate Limiting**: Are public/expensive routes protected with `RateLimiter`?
- [ ] **Data Caching**: Are database reads wrapped in `ApiCache` to optimize performance?
- [ ] **Error Exposure**: Are database exception stack traces hidden from the client?
- [ ] **TypeScript Safety**: Are there any loose `any` casts or missing optional property checks?

## 4. Phase 4: Reflection Loop & Compilation Verification
Verify your implementation autonomously:
1. **Run TypeScript Compiler**: Execute `npx tsc --noEmit`.
2. **Run Production Build**: Execute `npx next build --webpack`.
3. **Evaluate**: If there are compilation or type errors:
   - Treat this as a **Reflection Loop**.
   - Read the logs to identify the root cause.
   - Modify the code to resolve the errors.
   - Re-run verification. Repeat until it compiles cleanly.
4. **Complete Walkthrough**: Document findings in `walkthrough.md`.
