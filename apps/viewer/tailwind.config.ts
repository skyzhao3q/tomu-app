import type { Config } from "tailwindcss";
import sharedConfig from "@tomu/ui/tailwind-config";

const config: Config = {
  presets: [sharedConfig],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};

export default config;
