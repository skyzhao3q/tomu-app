import { createServer, type Server, type IncomingMessage, type ServerResponse } from "http";
import { Command } from "commander";

export type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  body: string,
) => void;

export interface MockServerRoute {
  method: string;
  path: string;
  handler: Handler;
}

export function createMockServer(
  routes: MockServerRoute[],
): Promise<{ server: Server; port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        const route = routes.find(
          (r) =>
            r.method === req.method &&
            matchPath(r.path, req.url?.split("?")[0] ?? ""),
        );
        if (route) {
          route.handler(req, res, body);
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "Not found" }));
        }
      });
    });

    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        server,
        port,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

function matchPath(pattern: string, actual: string): boolean {
  const patternParts = pattern.split("/");
  const actualParts = actual.split("/");
  if (patternParts.length !== actualParts.length) return false;
  return patternParts.every(
    (part, i) => part.startsWith(":") || part === actualParts[i],
  );
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runCommand(
  program: Command,
  args: string[],
): Promise<RunResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let exitCode = 0;

  const origLog = console.log;
  const origError = console.error;
  const origExit = process.exit;

  console.log = (...a: unknown[]) => stdout.push(a.map(String).join(" "));
  console.error = (...a: unknown[]) => stderr.push(a.map(String).join(" "));
  process.exit = ((code?: number) => {
    exitCode = code ?? 0;
    throw new ExitError(exitCode);
  }) as never;

  try {
    program.exitOverride();
    await program.parseAsync(["node", "tomu", ...args]);
  } catch (e) {
    if (e instanceof ExitError) {
      exitCode = e.code;
    } else if (
      e &&
      typeof e === "object" &&
      "exitCode" in e &&
      typeof (e as { exitCode: unknown }).exitCode === "number"
    ) {
      exitCode = (e as { exitCode: number }).exitCode;
    }
  } finally {
    console.log = origLog;
    console.error = origError;
    process.exit = origExit;
  }

  return {
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
    exitCode,
  };
}

class ExitError extends Error {
  constructor(public code: number) {
    super(`exit ${code}`);
  }
}

export function jsonResponse(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
