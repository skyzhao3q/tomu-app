import type { Command } from "commander";
import { join } from "path";
import { apiFetch } from "../api.js";
import { formatJson, formatTable } from "../lib/formatter.js";

export function registerPeople(program: Command): void {
  const people = program.command("people").description("Manage people profiles");

  people
    .command("list")
    .description("List people")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<
        Array<{ name: string; notes: string; metadata?: Record<string, unknown> }>
      >("GET", "/people");

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      if (data.length === 0) {
        console.log("No people found.");
        return;
      }

      console.log(
        formatTable(data, [
          { key: "name", label: "Name" },
          { key: "notes", label: "Notes", width: 40 },
        ]),
      );
    });

  people
    .command("show <name>")
    .description("Show a person's profile")
    .option("--json", "Output raw JSON")
    .action(async (name: string, opts: { json?: boolean }) => {
      const data = await apiFetch<{ name: string; notes: string; metadata?: Record<string, unknown> }>(
        "GET",
        `/people/${encodeURIComponent(name)}`,
      );

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      console.log(`Name: ${data.name}`);
      if (data.notes) console.log(`Notes:\n${data.notes}`);
      if (data.metadata && Object.keys(data.metadata).length > 0) {
        console.log(`Metadata: ${JSON.stringify(data.metadata, null, 2)}`);
      }
    });

  people
    .command("add")
    .description("Add a person")
    .requiredOption("--name <name>", "Person name")
    .option("--notes <notes>", "Notes about this person", "")
    .option("--relationship <rel>", "Relationship type")
    .action(
      async (opts: { name: string; notes: string; relationship?: string }) => {
        const metadata: Record<string, unknown> = {};
        if (opts.relationship) metadata.relationship = opts.relationship;

        const data = await apiFetch<{ name: string }>("POST", "/people", {
          name: opts.name,
          notes: opts.notes,
          metadata,
        });
        console.log(`✅ Added "${data.name}".`);
      },
    );

  people
    .command("append <name> <text>")
    .description("Append text to a person's notes")
    .action(async (name: string, text: string) => {
      const current = await apiFetch<{ name: string; notes: string; metadata?: Record<string, unknown> }>(
        "GET",
        `/people/${encodeURIComponent(name)}`,
      );
      const updatedNotes = current.notes
        ? current.notes.trimEnd() + "\n" + text
        : text;
      await apiFetch("PUT", `/people/${encodeURIComponent(name)}`, {
        notes: updatedNotes,
      });
      console.log(`✅ Appended to "${name}".`);
    });

  people
    .command("update <name>")
    .description("Update a person")
    .option("--notes <notes>", "Updated notes")
    .action(async (name: string, opts: { notes?: string }) => {
      const body: Record<string, unknown> = {};
      if (opts.notes !== undefined) body.notes = opts.notes;

      await apiFetch("PUT", `/people/${encodeURIComponent(name)}`, body);
      console.log(`✅ Updated "${name}".`);
    });

  people
    .command("delete <name>")
    .description("Delete a person")
    .action(async (name: string) => {
      await apiFetch("DELETE", `/people/${encodeURIComponent(name)}`);
      console.log(`✅ Deleted "${name}".`);
    });

  people
    .command("dir")
    .description("Show people data directory path")
    .action(() => {
      const dir = join(process.env.HOME || "~", ".config", "tomu", "people");
      console.log(dir);
    });
}
