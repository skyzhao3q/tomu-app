/**
 * Launcher script for `pnpm run electron:dev`.
 * Starts Vite, Express, and Electron in parallel, then tears everything down on exit.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopRoot, "..", "..");

const children = [];

function launch(label, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

  child.stdout?.on("data", (data) => {
    for (const line of data.toString().split("\n").filter(Boolean)) {
      console.log(`[${label}] ${line}`);
    }
  });

  child.stderr?.on("data", (data) => {
    for (const line of data.toString().split("\n").filter(Boolean)) {
      console.error(`[${label}] ${line}`);
    }
  });

  child.on("exit", (code) => {
    console.log(`[${label}] exited with code ${code}`);
  });

  children.push(child);
  return child;
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function killAll() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

// Clean up all children on exit
process.on("SIGINT", () => {
  console.log("\n[dev] Shutting down...");
  killAll();
  process.exit(0);
});
process.on("SIGTERM", () => {
  killAll();
  process.exit(0);
});
process.on("exit", killAll);

// 1. Start Vite dev server
console.log("[dev] Starting Vite dev server...");
launch("vite", "pnpm", ["--filter", "@tomu/viewer", "dev"], { cwd: repoRoot });

// 2. Start Express server via tsx
console.log("[dev] Starting Express server...");
launch("express", "pnpm", ["--filter", "@tomu/desktop", "dev"], {
  cwd: repoRoot,
  env: { ...process.env, PORT: "33001" },
});

// 3. Wait for both servers, then launch Electron
try {
  console.log("[dev] Waiting for servers to be ready...");
  await Promise.all([
    waitForServer("http://localhost:55173"),
    waitForServer("http://localhost:33001/api/health"),
  ]);
  console.log("[dev] Servers ready — launching Electron");
} catch (err) {
  console.error(`[dev] ${err.message}`);
  killAll();
  process.exit(1);
}

launch("electron", "npx", ["electron", "."], { cwd: desktopRoot });
