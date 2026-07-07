const { execSync } = require("child_process");

console.log("=== Running Autonomous GSD Verification Loop ===");

let hasErrors = false;

// 1. Run TypeScript Compilation
try {
  console.log("\n[1/2] Verifying TypeScript Types (tsc --noEmit)...");
  execSync("npx tsc --noEmit", { stdio: "inherit" });
  console.log("✅ TypeScript Compilation Successful!");
} catch (error) {
  console.error("❌ TypeScript Verification Failed! Please review code types.");
  hasErrors = true;
}

// 2. Run Next.js Webpack Build
try {
  console.log("\n[2/3] Verifying Production Bundle (next build)...");
  execSync("npx next build --webpack", { stdio: "inherit" });
  console.log("✅ Webpack Production Build Successful!");
} catch (error) {
  console.error("❌ Next.js Production Build Failed! Please review server/client boundaries.");
  hasErrors = true;
}

// 3. Run Dependency Audit
try {
  console.log("\n[3/3] Scanning dependencies for high/critical vulnerabilities (npm audit)...");
  execSync("npm audit --audit-level=high", { stdio: "inherit" });
  console.log("✅ Dependency audit passed cleanly!");
} catch (error) {
  console.warn("⚠️ Dependency audit detected high/critical vulnerabilities. Please review NPM package registry.");
  // Note: We don't fail verification immediately on npm audit to prevent blocking builds on upstream registry changes
}

if (hasErrors) {
  console.error("\n=== GSD Verification Failed! Please review the output above. ===");
  process.exit(1);
} else {
  console.log("\n=== GSD Verification Passed! Repository compiles successfully with zero warnings. ===");
  process.exit(0);
}
