import { app, BrowserWindow } from "electron";

const REMOTE_URL = "https://stfcs.205716.xyz";
const LOCAL_URL = "http://localhost:5173";
const useLocal = process.argv.includes("--local");

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "STFCS",
    backgroundColor: "#0a0a1a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);

  if (useLocal) {
    win.loadURL(LOCAL_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadURL(REMOTE_URL);
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});
