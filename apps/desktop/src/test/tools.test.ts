import { describe, test, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { executeBash } from "../main/tools/bash.js";
import { executeRead } from "../main/tools/read.js";
import { executeWrite } from "../main/tools/write.js";
import { executeEdit } from "../main/tools/edit.js";
import { executeGlob } from "../main/tools/glob.js";
import { executeGrep } from "../main/tools/grep.js";
import { redactSecrets } from "../main/tools/redact.js";

// ---------------------------------------------------------------------------
// Temporary directory for file-based tool tests
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tomu-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// executeBash
// ---------------------------------------------------------------------------

describe("executeBash", () => {
  test("runs simple commands and returns stdout", async () => {
    const result = await executeBash({ command: "echo hello" });
    expect(result.trim()).toBe("hello");
  });

  test("returns stderr on failure", async () => {
    const result = await executeBash({ command: "ls /nonexistent-path-xyz" });
    expect(result).toContain("Exit code:");
  });

  test("respects timeout", async () => {
    const result = await executeBash({ command: "sleep 10", timeout: 500 });
    // Should fail due to timeout
    expect(result).toContain("Exit code:");
  });

  test("caps timeout at 120s", async () => {
    // Passing a huge timeout should not throw; the function caps it internally
    const result = await executeBash({ command: "echo ok", timeout: 999999 });
    expect(result.trim()).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// executeRead
// ---------------------------------------------------------------------------

describe("executeRead", () => {
  test("reads files with line numbers", async () => {
    const filePath = path.join(tmpDir, "read-test.txt");
    fs.writeFileSync(filePath, "line1\nline2\nline3\n", "utf-8");

    const result = await executeRead({ file_path: filePath });
    expect(result).toContain("line1");
    expect(result).toContain("line2");
    expect(result).toContain("line3");
  });

  test("supports offset and limit", async () => {
    const filePath = path.join(tmpDir, "offset-test.txt");
    fs.writeFileSync(filePath, "a\nb\nc\nd\ne\n", "utf-8");

    const result = await executeRead({ file_path: filePath, offset: 2, limit: 2 });
    expect(result).toContain("b");
    expect(result).toContain("c");
    expect(result).not.toContain("|a");
    expect(result).not.toContain("|d");
  });

  test("returns error for missing file", async () => {
    const result = await executeRead({ file_path: "/nonexistent-file-xyz.txt" });
    expect(result).toContain("Error:");
  });
});

// ---------------------------------------------------------------------------
// executeWrite
// ---------------------------------------------------------------------------

describe("executeWrite", () => {
  test("creates files", async () => {
    const filePath = path.join(tmpDir, "write-test.txt");
    const result = await executeWrite({ file_path: filePath, content: "hello world" });
    expect(result).toContain("Wrote");
    expect(fs.readFileSync(filePath, "utf-8")).toBe("hello world");
  });

  test("creates parent directories", async () => {
    const filePath = path.join(tmpDir, "sub", "dir", "file.txt");
    await executeWrite({ file_path: filePath, content: "nested" });
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("nested");
  });

  test("overwrites existing files", async () => {
    const filePath = path.join(tmpDir, "overwrite.txt");
    fs.writeFileSync(filePath, "old content", "utf-8");
    await executeWrite({ file_path: filePath, content: "new content" });
    expect(fs.readFileSync(filePath, "utf-8")).toBe("new content");
  });
});

// ---------------------------------------------------------------------------
// executeEdit
// ---------------------------------------------------------------------------

describe("executeEdit", () => {
  test("search and replace works", async () => {
    const filePath = path.join(tmpDir, "edit-test.txt");
    fs.writeFileSync(filePath, "hello world\ngoodbye world\n", "utf-8");

    const result = await executeEdit({
      file_path: filePath,
      old_string: "hello world",
      new_string: "hi world",
    });
    expect(result).toContain("Edited");
    expect(fs.readFileSync(filePath, "utf-8")).toContain("hi world");
  });

  test("returns error when old_string not found", async () => {
    const filePath = path.join(tmpDir, "edit-missing.txt");
    fs.writeFileSync(filePath, "some content\n", "utf-8");

    const result = await executeEdit({
      file_path: filePath,
      old_string: "nonexistent",
      new_string: "replacement",
    });
    expect(result).toContain("Error:");
    expect(result).toContain("not found");
  });

  test("rejects ambiguous matches without replace_all", async () => {
    const filePath = path.join(tmpDir, "edit-ambiguous.txt");
    fs.writeFileSync(filePath, "foo bar\nfoo baz\n", "utf-8");

    const result = await executeEdit({
      file_path: filePath,
      old_string: "foo",
      new_string: "qux",
    });
    expect(result).toContain("Error:");
    expect(result).toContain("multiple");
  });

  test("replace_all replaces all occurrences", async () => {
    const filePath = path.join(tmpDir, "edit-all.txt");
    fs.writeFileSync(filePath, "foo bar\nfoo baz\n", "utf-8");

    const result = await executeEdit({
      file_path: filePath,
      old_string: "foo",
      new_string: "qux",
      replace_all: true,
    });
    expect(result).toContain("Edited");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toBe("qux bar\nqux baz\n");
  });
});

// ---------------------------------------------------------------------------
// executeGlob
// ---------------------------------------------------------------------------

describe("executeGlob", () => {
  test("finds files matching pattern", async () => {
    fs.writeFileSync(path.join(tmpDir, "a.ts"), "", "utf-8");
    fs.writeFileSync(path.join(tmpDir, "b.ts"), "", "utf-8");
    fs.writeFileSync(path.join(tmpDir, "c.js"), "", "utf-8");

    const result = await executeGlob({ pattern: "*.ts", path: tmpDir });
    expect(result).toContain("a.ts");
    expect(result).toContain("b.ts");
    expect(result).not.toContain("c.js");
  });

  test("returns 'No files found' when nothing matches", async () => {
    const result = await executeGlob({ pattern: "*.xyz", path: tmpDir });
    expect(result).toBe("No files found");
  });
});

// ---------------------------------------------------------------------------
// executeGrep
// ---------------------------------------------------------------------------

describe("executeGrep", () => {
  test("finds content in files", async () => {
    fs.writeFileSync(path.join(tmpDir, "grep-test.txt"), "hello world\nfoo bar\n", "utf-8");

    const result = await executeGrep({
      pattern: "hello",
      path: tmpDir,
      output_mode: "content",
    });
    expect(result).toContain("hello world");
  });

  test("returns 'No matches found' when nothing matches", async () => {
    fs.writeFileSync(path.join(tmpDir, "grep-empty.txt"), "nothing here\n", "utf-8");

    const result = await executeGrep({
      pattern: "zzzznonexistent",
      path: tmpDir,
    });
    expect(result).toBe("No matches found");
  });
});

// ---------------------------------------------------------------------------
// redactSecrets
// ---------------------------------------------------------------------------

describe("redactSecrets", () => {
  test("masks OpenAI-style API keys", () => {
    const input = "my key is sk-abcdefghijklmnopqrstuvwxyz1234567890";
    const result = redactSecrets(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("sk-abcdef");
  });

  test("masks GitHub personal access tokens", () => {
    const input = "token: ghp_abcdefghijklmnopqrstuvwxyz1234567890AB";
    const result = redactSecrets(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("ghp_abcdef");
  });

  test("masks AWS access key IDs", () => {
    const input = "aws key AKIAIOSFODNN7EXAMPLE";
    const result = redactSecrets(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  test("leaves normal text unchanged", () => {
    const input = "this is normal text with no secrets";
    const result = redactSecrets(input);
    expect(result).toBe(input);
  });

  test("masks tokens after key/token/secret keywords", () => {
    const input = 'api_key: "abcdefghijklmnopqrstuvwxyz12345678"';
    const result = redactSecrets(input);
    expect(result).toContain("[REDACTED]");
  });
});
