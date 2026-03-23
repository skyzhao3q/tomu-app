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
            { id: "dall-e-3", name: "DALL-E 3", provider: "openai" },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["image", "models"]);
    expect(result.stdout).toContain("dall-e-3");
    expect(result.stdout).toContain("DALL-E 3");
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

  test("image generate produces image", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/image/generate",
        handler: (_req, res) =>
          jsonResponse(res, { url: "https://example.com/image.png" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["image", "generate", "a sunset over the ocean"]);
    expect(result.stdout).toContain("✅ Image generated: https://example.com/image.png");
  });

  test("image generate with --model and --reference", async () => {
    let requestBody = "";
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/image/generate",
        handler: (_req, res, body) => {
          requestBody = body;
          jsonResponse(res, { url: "https://example.com/image.png" });
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
      "dall-e-3",
      "--reference",
      "https://example.com/ref.png",
    ]);
    const parsed = JSON.parse(requestBody);
    expect(parsed.model).toBe("dall-e-3");
    expect(parsed.reference).toBe("https://example.com/ref.png");
  });

  test("image generate --json outputs raw JSON", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/image/generate",
        handler: (_req, res) => jsonResponse(res, { url: "https://example.com/image.png" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["image", "generate", "a cat", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.url).toBe("https://example.com/image.png");
  });

  test("image edit edits image", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/image/edit",
        handler: (_req, res) =>
          jsonResponse(res, { url: "https://example.com/edited.png" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["image", "edit", "add a rainbow"]);
    expect(result.stdout).toContain('Editing image: "add a rainbow"');
    expect(result.stdout).toContain("✅ Image edited: https://example.com/edited.png");
  });
});
