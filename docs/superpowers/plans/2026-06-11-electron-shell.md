# Electron Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Electron shell to wrap the existing Vite+React client as a Windows desktop app, without modifying any existing code.

**Architecture:** New `packages/electron` workspace package. Main process creates a BrowserWindow that loads the client (dev server in development, built files in production). Uses tsup to compile main process TS, electron-builder for Windows packaging. Zero changes to existing packages.

**Tech Stack:** Electron 35, electron-builder 26, tsup (already used in project)

**Verification:** Electron window opens and loads the client UI.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/electron/package.json` | Create | Package metadata, scripts, Electron + builder deps |
| `packages/electron/tsconfig.json` | Create | Node-side TypeScript config for main process |
| `packages/electron/src/main.ts` | Create | Electron main process entry point |
| `packages/electron/electron-builder.yml` | Create | Windows packaging configuration |

**No files modified.** All existing packages remain untouched.

---

### Task 1: Scaffold Package

**Files:**
- Create: `packages/electron/package.json`
- Create: `packages/electron/tsconfig.json`

- [ ] **Step 1.1: Create package.json**

Create `packages/electron/package.json`:

```json
{
  "name": "@vt/electron",
  "version": "1.0.0",
  "private": true,
  "main": "dist/main.cjs",
  "scripts": {
    "dev": "tsup src/main.ts --format cjs --out-dir dist && electron .",
    "build": "tsup src/main.ts --format cjs --out-dir dist --clean",
    "package": "pnpm build && electron-builder --win --config electron-builder.yml"
  },
  "devDependencies": {
    "electron": "^35.0.0",
    "electron-builder": "^26.0.0",
    "tsup": "^8.5.1",
    "typescript": "~5.9.3"
  }
}
```

- [ ] **Step 1.2: Create tsconfig.json**

Create `packages/electron/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 1.3: Install dependencies**

Run from `packages/electron`:
```
pnpm install
```

Expected: electron, electron-builder, tsup, typescript installed. The `pnpm-workspace.yaml` glob `packages/*` auto-includes this package.

- [ ] **Step 1.4: Verify package recognized**

Run from repo root:
```
pnpm ls --filter @vt/electron
```

Expected: lists @vt/electron with its dependencies.

---

### Task 2: Main Process

**Files:**
- Create: `packages/electron/src/main.ts`

- [ ] **Step 2.1: Create src directory**

```
mkdir packages/electron/src
```

- [ ] **Step 2.2: Write main.ts**

Create `packages/electron/src/main.ts`:

```typescript
import { app, BrowserWindow } from "electron";
import path from "path";

const isDev = !app.isPackaged;
const CLIENT_DEV_URL = "http://localhost:5173";

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

  if (isDev) {
    win.loadURL(CLIENT_DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(__dirname, "../../client/dist/index.html");
    win.loadFile(indexPath);
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});
```

- [ ] **Step 2.3: Verify build**

Run from `packages/electron`:
```
pnpm build
```

Expected: `dist/main.cjs` is generated without errors.

---

### Task 3: Electron Builder Config

**Files:**
- Create: `packages/electron/electron-builder.yml`

- [ ] **Step 3.1: Write electron-builder.yml**

Create `packages/electron/electron-builder.yml`:

```yaml
appId: com.stfcs.app
productName: STFCS
directories:
  output: release
files:
  - dist/**/*
  - package.json
extraResources:
  - from: ../client/dist
    to: client
    filter:
      - "**/*"
win:
  target:
    - target: portable
      arch:
        - x64
```

- [ ] **Step 3.2: Update main.ts production path for packaged app**

The `extraResources` copies client/dist to `resources/client/` in the packaged app. Update the production path in `main.ts`:

Change the production loadFile line:
```typescript
const indexPath = path.join(__dirname, "../../client/dist/index.html");
```
to:
```typescript
const indexPath = path.join(process.resourcesPath, "client/index.html");
```

The full if/else block becomes:

```typescript
if (isDev) {
    win.loadURL(CLIENT_DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
} else {
    const indexPath = path.join(process.resourcesPath, "client/index.html");
    win.loadFile(indexPath);
}
```

- [ ] **Step 3.3: Rebuild**

Run from `packages/electron`:
```
pnpm build
```

Expected: `dist/main.cjs` rebuilt successfully.

---

### Task 4: Dev Smoke Test

**Files:** None (verification only)

- [ ] **Step 4.1: Start client dev server**

Run from repo root (in a separate terminal or background):
```
pnpm --filter client dev
```

Wait until Vite prints `Local: http://localhost:5173/`.

- [ ] **Step 4.2: Launch Electron in dev mode**

Run from `packages/electron`:
```
pnpm exec electron .
```

Expected:
- An Electron window opens with title "STFCS"
- The client UI loads (same as browser at localhost:5173)
- DevTools opens in a detached window
- Menu bar is hidden
- Window background is dark (#0a0a1a) before content loads

If the window shows a blank page or connection error, the client dev server is not running. Start it first.

- [ ] **Step 4.3: Verify Socket.IO connection**

In the Electron window, the app should connect to the backend server (if running). Navigate to the lobby. If the server is also running (via `pnpm dev` at root), the lobby should work identically to the browser version.

---

### Task 5: Production Build Test (Optional)

**Files:** None (verification only)

- [ ] **Step 5.1: Build client**

Run from repo root:
```
pnpm --filter client build
```

Expected: `packages/client/dist/` populated with built files.

- [ ] **Step 5.2: Package Electron**

Run from `packages/electron`:
```
pnpm package
```

Expected: `packages/electron/release/` contains a portable `.exe` file.

Note: First run downloads the Electron binary (~80MB). This step is optional for the experiment — dev mode is sufficient to validate the shell works.
