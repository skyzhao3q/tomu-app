import {
  Tray,
  Menu,
  app,
  type BrowserWindow,
  type NativeImage,
} from "electron";
import { setQuitting } from "./app-state.js";

let tray: Tray | null = null;

export function createTray(
  icon: NativeImage,
  mainWindow: BrowserWindow,
): Tray {
  tray = new Tray(icon);
  tray.setToolTip("tomu");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show tomu",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: "New Chat",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send("new-chat");
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        setQuitting(true);
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}
