import type { Command } from "commander";
import { createRequire } from "module";

export function registerVersion(program: Command): void {
  program
    .command("version")
    .description("Show CLI version")
    .action(() => {
      const require = createRequire(import.meta.url);
      const pkg = require("../../package.json") as { version: string };
      console.log(`tomu v${pkg.version}`);
    });
}
