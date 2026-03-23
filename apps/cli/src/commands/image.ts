import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson, formatTable } from "../lib/formatter.js";

export function registerImage(program: Command): void {
  const image = program.command("image").description("Image generation commands");

  image
    .command("models")
    .description("List available image generation models")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<Array<{ id: string; name?: string; provider?: string }>>(
        "GET",
        "/image/models",
      );

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      if (data.length === 0) {
        console.log("No image models available.");
        return;
      }

      console.log(
        formatTable(
          data.map((m) => ({ id: m.id, name: m.name ?? m.id, provider: m.provider ?? "" })),
          [
            { key: "id", label: "ID" },
            { key: "name", label: "Name" },
            { key: "provider", label: "Provider" },
          ],
        ),
      );
    });

  image
    .command("generate <prompt>")
    .description("Generate an image from a text prompt")
    .option("--model <model>", "Model to use")
    .option("--reference <url>", "Reference image URL")
    .option("--json", "Output raw JSON")
    .action(async (prompt: string, opts: { model?: string; reference?: string; json?: boolean }) => {
      if (!opts.json) console.log(`Generating image: "${prompt}"...`);
      const data = await apiFetch<{ url?: string; path?: string; id?: string }>(
        "POST",
        "/image/generate",
        {
          prompt,
          model: opts.model,
          reference: opts.reference,
        },
      );

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      const location = data.url ?? data.path ?? data.id ?? "unknown";
      console.log(`✅ Image generated: ${location}`);
    });

  image
    .command("edit <prompt>")
    .description("Edit an image")
    .option("--model <model>", "Model to use")
    .option("--input <url>", "Input image URL or path")
    .option("--json", "Output raw JSON")
    .action(async (prompt: string, opts: { model?: string; input?: string; json?: boolean }) => {
      if (!opts.json) console.log(`Editing image: "${prompt}"...`);
      const data = await apiFetch<{ url?: string; path?: string; id?: string }>(
        "POST",
        "/image/edit",
        {
          prompt,
          model: opts.model,
          input: opts.input,
        },
      );

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      const location = data.url ?? data.path ?? data.id ?? "unknown";
      console.log(`✅ Image edited: ${location}`);
    });
}
