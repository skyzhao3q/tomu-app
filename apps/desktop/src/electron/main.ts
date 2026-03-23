import {
  app,
  BrowserWindow,
  session,
  nativeImage,
  type BrowserWindowConstructorOptions,
} from "electron";
import { fork, type ChildProcess } from "node:child_process";
import path from "node:path";
import { createTray } from "./tray.js";
import { isQuitting, setQuitting } from "./app-state.js";

const isDev = !app.isPackaged;
const EXPRESS_PORT = 23001;
const VIEWER_DEV_URL = `http://localhost:5173`;

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

function startExpressServer(): ChildProcess {
  const serverEntry = path.join(__dirname, "..", "main", "index.js");
  const child = fork(serverEntry, [], {
    env: { ...process.env, PORT: String(EXPRESS_PORT) },
    stdio: "pipe",
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
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:23001 ws://localhost:5173; img-src 'self' data:; font-src 'self'",
        ],
      },
    });
  });
}

app.on("before-quit", () => {
  setQuitting(true);
});

app.on("ready", () => {
  setContentSecurityPolicy();
  serverProcess = startExpressServer();
  mainWindow = createWindow();

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
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
