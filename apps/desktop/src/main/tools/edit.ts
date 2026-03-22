import * as fs from "node:fs";

interface EditArgs {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export async function executeEdit({ file_path, old_string, new_string, replace_all }: EditArgs): Promise<string> {
  try {
    const content = fs.readFileSync(file_path, "utf-8");

    if (!content.includes(old_string)) {
      return `Error: old_string not found in ${file_path}`;
    }

    if (!replace_all) {
      const firstIdx = content.indexOf(old_string);
      const lastIdx = content.lastIndexOf(old_string);
      if (firstIdx !== lastIdx) {
        return `Error: old_string matches multiple locations. Provide more context or use replace_all=true.`;
      }
    }

    const updated = replace_all
      ? content.replaceAll(old_string, new_string)
      : content.replace(old_string, new_string);

    fs.writeFileSync(file_path, updated, "utf-8");
    return `Edited ${file_path}`;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
