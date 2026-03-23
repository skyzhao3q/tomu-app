import { describe, test, expect } from "vitest";
import { formatTable, formatJson, truncate } from "../lib/formatter.js";

describe("truncate", () => {
  test("returns text unchanged when shorter than maxLen", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  test("truncates and appends ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
  });

  test("handles exact length", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });
});

describe("formatTable", () => {
  test("formats rows with headers", () => {
    const rows = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];
    const columns = [
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
    ];
    const result = formatTable(rows, columns);
    expect(result).toContain("ID");
    expect(result).toContain("Name");
    expect(result).toContain("Alice");
    expect(result).toContain("Bob");
    // Has separator line
    const lines = result.split("\n");
    expect(lines.length).toBe(4); // header, separator, 2 rows
    expect(lines[1]).toMatch(/^-+/);
  });

  test("empty array returns No results message", () => {
    const result = formatTable([], [{ key: "id", label: "ID" }]);
    expect(result).toBe("No results.");
  });
});

describe("formatJson", () => {
  test("pretty-prints JSON", () => {
    const data = { name: "test", value: 42 };
    const result = formatJson(data);
    expect(result).toBe(JSON.stringify(data, null, 2));
  });
});
