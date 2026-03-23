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

// List all people
router.get("/people", (_req, res) => {
  const dir = getPeopleDir();
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    const people = files.map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf-8");
      const { data, content } = matter(raw);
      return {
        name: data.name || file.replace(".md", ""),
        relationship: data.relationship || null,
        tags: data.tags || [],
        notes: data.notes || null,
        content: content.trim(),
      };
    });
    res.json({ people });
  } catch {
    res.json({ people: [] });
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
  res.json({
    name: data.name || req.params.name,
    relationship: data.relationship || null,
    tags: data.tags || [],
    notes: data.notes || null,
    content: content.trim(),
  });
});

// Create a person
router.post("/people", (req, res) => {
  const { name, relationship, tags, content } = req.body as {
    name?: string;
    relationship?: string;
    tags?: string[];
    content?: string;
  };

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const filename = sanitizeFilename(name);
  const filePath = path.join(getPeopleDir(), `${filename}.md`);

  if (fs.existsSync(filePath)) {
    res.status(409).json({ error: "Person already exists" });
    return;
  }

  const frontmatter: Record<string, unknown> = { name };
  if (relationship) frontmatter.relationship = relationship;
  if (tags) frontmatter.tags = tags;

  const md = matter.stringify(content || "", frontmatter);
  fs.writeFileSync(filePath, md, "utf-8");
  res.status(201).json({ name, filename });
});

// Update a person
router.put("/people/:name", (req, res) => {
  const filePath = path.join(getPeopleDir(), `${sanitizeFilename(req.params.name)}.md`);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  const { name, relationship, tags, content } = req.body as {
    name?: string;
    relationship?: string;
    tags?: string[];
    content?: string;
  };

  const existing = matter(fs.readFileSync(filePath, "utf-8"));
  const data = { ...existing.data };
  if (name !== undefined) data.name = name;
  if (relationship !== undefined) data.relationship = relationship;
  if (tags !== undefined) data.tags = tags;

  const body = content !== undefined ? content : existing.content.trim();
  const md = matter.stringify(body, data);
  fs.writeFileSync(filePath, md, "utf-8");
  res.json({ success: true });
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
