import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu image", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("image models lists available image models", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/image/models",
        handler: (_req, res) =>
          jsonResponse(res, [
            { id: "gemini-2.0-flash-exp-image-generation", name: "Gemini Flash Image", provider: "gemini", best: true },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["image", "models"]);
    expect(result.stdout).toContain("gemini-2.0-flash-exp-image-generation");
  });

  test("image models empty shows message", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/image/models",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["image", "models"]);
    expect(result.stdout).toContain("No image models available.");
  });

  // generate: path goes to stdout (machine-readable), human message goes to stderr
  test("image generate outputs path to stdout", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/image/generate",
        handler: (_req, res) =>
          jsonResponse(res, { path: "/tmp/tomu-gen-123.jpg" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["image", "generate", "a sunset over the ocean"]);
    expect(result.stdout).toContain("/tmp/tomu-gen-123.jpg");
    expect(result.stderr).toContain("✅ Image generated:");
  });

  test("image generate with --model and --reference", async () => {
    let requestBody = "";
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/image/generate",
        handler: (_req, res, body) => {
          requestBody = body;
          jsonResponse(res, { path: "/tmp/tomu-gen-123.jpg" });
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    await runCommand(createProgram(), [
      "image",
      "generate",
      "a cat",
      "--model",
      "gemini-2.0-flash-exp-image-generation",
      "--reference",
      "/tmp/ref.jpg",
    ]);
    const parsed = JSON.parse(requestBody);
    expect(parsed.model).toBe("gemini-2.0-flash-exp-image-generation");
    expect(parsed.reference).toBe("/tmp/ref.jpg");
  });

  test("image generate --json outputs raw JSON", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/image/generate",
        handler: (_req, res) => jsonResponse(res, { path: "/tmp/tomu-gen-123.jpg" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["image", "generate", "a cat", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.path).toBe("/tmp/tomu-gen-123.jpg");
  });

  test("image generate API error is reported", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/image/generate",
        handler: (_req, res) => jsonResponse(res, { error: "Gemini API unavailable" }, 503),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["image", "generate", "a cat"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("❌");
  });

  test("image edit outputs edited image path", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/image/edit",
        handler: (_req, res) =>
          jsonResponse(res, { path: "/tmp/tomu-edit-456.jpg" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["image", "edit", "add a rainbow"]);
    expect(result.stdout).toContain('Editing image: "add a rainbow"');
    expect(result.stdout).toContain("✅ Image edited: /tmp/tomu-edit-456.jpg");
  });
});
