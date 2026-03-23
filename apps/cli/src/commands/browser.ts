import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson, formatTable } from "../lib/formatter.js";

export function registerBrowser(program: Command): void {
  const browser = program.command("browser").description("Browser automation via Chrome Relay");

  browser
    .command("status")
    .description("Chrome Relay connection status")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<{ connected: boolean; version?: string }>(
        "GET",
        "/browser/status",
      );
      if (opts.json) {
        console.log(formatJson(data));
        return;
      }
      console.log(`Browser: ${data.connected ? "connected" : "disconnected"}`);
      if (data.version) console.log(`Version: ${data.version}`);
    });

  browser
    .command("tabs")
    .description("List open Chrome tabs")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<Array<{ id: string; title: string; url: string }>>(
        "GET",
        "/browser/tabs",
      );
      if (opts.json) {
        console.log(formatJson(data));
        return;
      }
      if (data.length === 0) {
        console.log("No tabs open.");
        return;
      }
      console.log(
        formatTable(data, [
          { key: "id", label: "ID" },
          { key: "title", label: "Title" },
          { key: "url", label: "URL" },
        ]),
      );
    });

  browser
    .command("open [url]")
    .description("Open a new tab (optionally with URL)")
    .action(async (url: string | undefined) => {
      const data = await apiFetch<{ id: string }>("POST", "/browser/tabs/open", { url });
      console.log(`✅ Opened tab ${data.id}`);
    });

  browser
    .command("goto <tabId> <url>")
    .description("Navigate tab to URL")
    .action(async (tabId: string, url: string) => {
      await apiFetch("POST", `/browser/tabs/${tabId}/goto`, { url });
      console.log(`✅ Navigated tab ${tabId} to ${url}`);
    });

  browser
    .command("click <tabId> <selector>")
    .description("Click element by CSS selector")
    .action(async (tabId: string, selector: string) => {
      await apiFetch("POST", `/browser/tabs/${tabId}/click`, { selector });
      console.log(`✅ Clicked ${selector} in tab ${tabId}`);
    });

  browser
    .command("type <tabId> <selector> <text>")
    .description("Type into input field")
    .option("--enter", "Press Enter after typing")
    .action(async (tabId: string, selector: string, text: string, opts: { enter?: boolean }) => {
      await apiFetch("POST", `/browser/tabs/${tabId}/type`, {
        selector,
        text,
        pressEnter: opts.enter ?? false,
      });
      console.log(`✅ Typed into ${selector} in tab ${tabId}`);
    });

  browser
    .command("screenshot [tabId]")
    .description("Take screenshot (prints file path)")
    .action(async (tabId: string | undefined) => {
      const endpoint = tabId
        ? `/browser/tabs/${tabId}/screenshot`
        : "/browser/tabs/screenshot";
      const data = await apiFetch<{ path: string }>("POST", endpoint);
      console.log(data.path);
    });

  browser
    .command("read <tabId>")
    .description("Read page content as markdown")
    .action(async (tabId: string) => {
      const data = await apiFetch<{ content: string }>(
        "GET",
        `/browser/tabs/${tabId}/read`,
      );
      console.log(data.content);
    });

  browser
    .command("read-dom <tabId>")
    .description("List interactive DOM elements (JSON)")
    .action(async (tabId: string) => {
      const data = await apiFetch<unknown>("GET", `/browser/tabs/${tabId}/read-dom`);
      console.log(formatJson(data));
    });

  browser
    .command("eval <tabId> <code>")
    .description("Execute JavaScript in page")
    .option("--json", "Output raw JSON")
    .action(async (tabId: string, code: string, opts: { json?: boolean }) => {
      const data = await apiFetch<{ result: unknown }>(
        "POST",
        `/browser/tabs/${tabId}/eval`,
        { code },
      );
      if (opts.json) {
        console.log(formatJson(data));
        return;
      }
      console.log(String(data.result));
    });

  browser
    .command("scroll <tabId> <direction> [amount]")
    .description("Scroll page (up|down)")
    .action(async (tabId: string, direction: string, amount: string | undefined) => {
      await apiFetch("POST", `/browser/tabs/${tabId}/scroll`, {
        direction,
        amount: amount ? parseInt(amount, 10) : undefined,
      });
      console.log(`✅ Scrolled ${direction} in tab ${tabId}`);
    });

  browser
    .command("back <tabId>")
    .description("Go back in history")
    .action(async (tabId: string) => {
      await apiFetch("POST", `/browser/tabs/${tabId}/back`);
      console.log(`✅ Went back in tab ${tabId}`);
    });

  browser
    .command("forward <tabId>")
    .description("Go forward in history")
    .action(async (tabId: string) => {
      await apiFetch("POST", `/browser/tabs/${tabId}/forward`);
      console.log(`✅ Went forward in tab ${tabId}`);
    });
}
