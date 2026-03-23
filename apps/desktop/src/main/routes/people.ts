import { Router, type Router as RouterType } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import matter from "gray-matter";
import { getConfigDir } from "../db.js";

const router: RouterType = Router();

function getPeopleDir(): string {
  return path.join(getConfigDir(), "people");
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
}

function toPerson(data: Record<string, unknown>, content: string, fallbackName: string) {
  return {
    name: (data.name as string) || fallbackName,
    metadata: {
      relationship: data.relationship || null,
      tags: data.tags || [],
    },
    notes: content.trim(),
  };
}

// List all people
router.get("/people", (_req, res) => {
  const dir = getPeopleDir();
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    const people = files.map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf-8");
      const { data, content } = matter(raw);
      return toPerson(data, content, file.replace(".md", ""));
    });
    res.json(people);
  } catch {
    res.json([]);
  }
});

// Get a single person
router.get("/people/:name", (req, res) => {
  const filePath = path.join(getPeopleDir(), `${sanitizeFilename(req.params.name)}.md`);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  res.json(toPerson(data, content, req.params.name));
});

// Create a person
router.post("/people", (req, res) => {
  const { name, metadata, notes } = req.body as {
    name?: string;
    metadata?: Record<string, unknown>;
    notes?: string;
  };

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const dir = getPeopleDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filename = sanitizeFilename(name);
  const filePath = path.join(dir, `${filename}.md`);

  if (fs.existsSync(filePath)) {
    res.status(409).json({ error: "Person already exists" });
    return;
  }

  const frontmatter: Record<string, unknown> = { name };
  if (metadata?.relationship) frontmatter.relationship = metadata.relationship;
  if (metadata?.tags) frontmatter.tags = metadata.tags;

  const md = matter.stringify(notes || "", frontmatter);
  fs.writeFileSync(filePath, md, "utf-8");
  res.status(201).json({ name, metadata: metadata || {}, notes: notes || "" });
});

// Update a person
router.put("/people/:name", (req, res) => {
  const filePath = path.join(getPeopleDir(), `${sanitizeFilename(req.params.name)}.md`);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  const { name, metadata, notes } = req.body as {
    name?: string;
    metadata?: Record<string, unknown>;
    notes?: string;
  };

  const existing = matter(fs.readFileSync(filePath, "utf-8"));
  const data = { ...existing.data };
  if (name !== undefined) data.name = name;
  if (metadata?.relationship !== undefined) data.relationship = metadata.relationship;
  if (metadata?.tags !== undefined) data.tags = metadata.tags;

  const body = notes !== undefined ? notes : existing.content.trim();
  const md = matter.stringify(body, data);
  fs.writeFileSync(filePath, md, "utf-8");

  res.json(toPerson(data, body, req.params.name));
});

// Delete a person
router.delete("/people/:name", (req, res) => {
  const filePath = path.join(getPeopleDir(), `${sanitizeFilename(req.params.name)}.md`);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  fs.unlinkSync(filePath);
  res.json({ success: true });
});

export default router;
