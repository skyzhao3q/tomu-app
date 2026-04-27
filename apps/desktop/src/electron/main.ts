import {
  app,
  BrowserWindow,
  globalShortcut,
  session,
  nativeImage,
  type BrowserWindowConstructorOptions,
} from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTray } from "./tray.js";
import { isQuitting, setQuitting } from "./app-state.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const EXPRESS_PORT = Number(process.env.EXPRESS_PORT) || 33001;
const VIEWER_DEV_URL = `http://localhost:${Number(process.env.VITE_PORT) || 55173}`;

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

function getViewerProdPath(): string {
  return path.join(app.getAppPath(), "..", "viewer", "dist", "index.html");
}

function createWindow(): BrowserWindow {
  const windowOptions: BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  };

  if (process.platform === "darwin") {
    windowOptions.titleBarStyle = "hiddenInset";
  }

  const win = new BrowserWindow(windowOptions);

  if (isDev) {
    win.loadURL(VIEWER_DEV_URL);
  } else {
    win.loadFile(getViewerProdPath());
  }

  win.once("ready-to-show", () => {
    win.show();
  });

  // macOS: hide window instead of closing
  if (process.platform === "darwin") {
    win.on("close", (e) => {
      if (!isQuitting) {
        e.preventDefault();
        win.hide();
      }
    });
  }

  return win;
}

function startExpressServer(): ChildProcess | null {
  // In dev, the Express server is started externally by the launcher script (scripts/dev.mjs)
  if (isDev) return null;

  // Prod: run compiled JS via system node
  const desktopRoot = path.resolve(__dirname, "..", "..");
  const command = "node";
  const args = [path.join(__dirname, "..", "main", "index.js")];

  const child = spawn(command, args, {
    env: { ...process.env, PORT: String(EXPRESS_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    cwd: desktopRoot,
  });

  child.stdout?.on("data", (data: Buffer) => {
    console.log(`[server] ${data.toString().trim()}`);
  });

  child.stderr?.on("data", (data: Buffer) => {
    console.error(`[server] ${data.toString().trim()}`);
  });

  child.on("exit", (code) => {
    console.log(`[server] exited with code ${code}`);
    serverProcess = null;
  });

  return child;
}

function setContentSecurityPolicy(): void {
  // Skip CSP in dev — Vite injects inline scripts and uses WebSocket for HMR
  if (isDev) return;

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:33001; img-src 'self' data: blob:; font-src 'self'",
        ],
      },
    });
  });
}

async function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.warn(`[electron] Timed out waiting for ${url}`);
}

app.on("before-quit", () => {
  setQuitting(true);
});

app.on("ready", async () => {
  setContentSecurityPolicy();

  if (isDev) {
    // Both servers started by launcher script — wait for them
    console.log("[electron] Waiting for servers...");
    await Promise.all([
      waitForServer(VIEWER_DEV_URL),
      waitForServer(`http://localhost:${EXPRESS_PORT}/api/health`),
    ]);
    console.log("[electron] Servers ready");
  } else {
    serverProcess = startExpressServer();
  }

  mainWindow = createWindow();

  if (isDev) {
    const accelerator =
      process.platform === "darwin" ? "Command+Option+I" : "Control+Shift+I";
    globalShortcut.register(accelerator, () => {
      mainWindow?.webContents.toggleDevTools();
    });
  }

  const trayIcon = nativeImage.createEmpty();
  createTray(trayIcon, mainWindow);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    mainWindow = createWindow();
  } else {
    mainWindow.show();
  }
});

app.on("quit", () => {
  globalShortcut.unregisterAll();
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
