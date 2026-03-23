import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu browser", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("browser status shows connected", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/browser/status",
        handler: (_req, res) =>
          jsonResponse(res, { connected: true, version: "120.0" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["browser", "status"]);
    expect(result.stdout).toContain("Browser: connected");
    expect(result.stdout).toContain("Version: 120.0");
  });

  test("browser status shows disconnected", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/browser/status",
        handler: (_req, res) => jsonResponse(res, { connected: false }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["browser", "status"]);
    expect(result.stdout).toContain("Browser: disconnected");
  });

  test("browser status --json outputs raw JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/browser/status",
        handler: (_req, res) => jsonResponse(res, { connected: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["browser", "status", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.connected).toBe(true);
  });

  test("browser tabs lists open tabs", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/browser/tabs",
        handler: (_req, res) =>
          jsonResponse(res, [
            { id: "tab1", title: "Google", url: "https://google.com" },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["browser", "tabs"]);
    expect(result.stdout).toContain("Google");
    expect(result.stdout).toContain("https://google.com");
  });

  test("browser tabs empty shows message", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/browser/tabs",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["browser", "tabs"]);
    expect(result.stdout).toContain("No tabs open.");
  });

  test("browser open creates tab", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/browser/tabs/open",
        handler: (_req, res) => jsonResponse(res, { id: "tab2" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["browser", "open"]);
    expect(result.stdout).toContain("✅ Opened tab tab2");
  });

  test("browser open with url creates tab", async () => {
    let requestBody = "";
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/browser/tabs/open",
        handler: (_req, res, body) => {
          requestBody = body;
          jsonResponse(res, { id: "tab3" });
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    await runCommand(createProgram(), ["browser", "open", "https://example.com"]);
    const parsed = JSON.parse(requestBody);
    expect(parsed.url).toBe("https://example.com");
  });

  test("browser goto navigates tab", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/browser/tabs/:tabId/goto",
        handler: (_req, res) => jsonResponse(res, { success: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "browser",
      "goto",
      "tab1",
      "https://example.com",
    ]);
    expect(result.stdout).toContain("✅ Navigated tab tab1 to https://example.com");
  });

  test("browser click clicks element", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/browser/tabs/:tabId/click",
        handler: (_req, res) => jsonResponse(res, { success: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "browser",
      "click",
      "tab1",
      "#submit-btn",
    ]);
    expect(result.stdout).toContain("✅ Clicked #submit-btn in tab tab1");
  });

  test("browser type types into element", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/browser/tabs/:tabId/type",
        handler: (_req, res) => jsonResponse(res, { success: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "browser",
      "type",
      "tab1",
      "#search-input",
      "hello world",
    ]);
    expect(result.stdout).toContain("✅ Typed into #search-input in tab tab1");
  });

  test("browser type with --enter flag", async () => {
    let requestBody = "";
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/browser/tabs/:tabId/type",
        handler: (_req, res, body) => {
          requestBody = body;
          jsonResponse(res, { success: true });
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    await runCommand(createProgram(), [
      "browser",
      "type",
      "tab1",
      "#search",
      "query",
      "--enter",
    ]);
    const parsed = JSON.parse(requestBody);
    expect(parsed.pressEnter).toBe(true);
  });

  test("browser screenshot prints path", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/browser/tabs/:tabId/screenshot",
        handler: (_req, res) =>
          jsonResponse(res, { path: "/tmp/screenshot-tab1.png" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["browser", "screenshot", "tab1"]);
    expect(result.stdout).toContain("/tmp/screenshot-tab1.png");
  });

  test("browser read returns page content", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/browser/tabs/:tabId/read",
        handler: (_req, res) =>
          jsonResponse(res, { content: "# Page Title\n\nSome content here" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["browser", "read", "tab1"]);
    expect(result.stdout).toContain("# Page Title");
    expect(result.stdout).toContain("Some content here");
  });

  test("browser read-dom returns DOM JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/browser/tabs/:tabId/read-dom",
        handler: (_req, res) =>
          jsonResponse(res, [{ tag: "button", id: "submit", text: "Submit" }]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["browser", "read-dom", "tab1"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed[0].tag).toBe("button");
  });

  test("browser eval executes JavaScript", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/browser/tabs/:tabId/eval",
        handler: (_req, res) =>
          jsonResponse(res, { result: "42" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "browser",
      "eval",
      "tab1",
      "document.title.length",
    ]);
    expect(result.stdout).toContain("42");
  });

  test("browser scroll scrolls page", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/browser/tabs/:tabId/scroll",
        handler: (_req, res) => jsonResponse(res, { success: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["browser", "scroll", "tab1", "down", "300"]);
    expect(result.stdout).toContain("✅ Scrolled down in tab tab1");
  });

  test("browser back goes back in history", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/browser/tabs/:tabId/back",
        handler: (_req, res) => jsonResponse(res, { success: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["browser", "back", "tab1"]);
    expect(result.stdout).toContain("✅ Went back in tab tab1");
  });

  test("browser forward goes forward in history", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/browser/tabs/:tabId/forward",
        handler: (_req, res) => jsonResponse(res, { success: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["browser", "forward", "tab1"]);
    expect(result.stdout).toContain("✅ Went forward in tab tab1");
  });
});
