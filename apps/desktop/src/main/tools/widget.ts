import * as crypto from "node:crypto";

interface WidgetArgs {
  html: string;
  title?: string;
}

export interface WidgetResult {
  widget_id: string;
  html: string;
  title: string;
}

export async function executeWidget({
  html,
  title,
}: WidgetArgs): Promise<WidgetResult> {
  return {
    widget_id: crypto.randomUUID(),
    html,
    title: title || "Widget",
  };
}
