# Deploy Desktop-App to GitHub (step by step)

GitHub **builds** the Windows `.exe` and **hosts** it on Releases. Your API stays on **Railway**.

---

## Before you start

1. Code is pushed to GitHub (this repo).
2. You know your **Laravel Railway URL** (not the React site).
   - Test: open `https://YOUR-LARAVEL.up.railway.app/health` in a browser.
   - You should see JSON with `"status":"ok"` and a `"php"` field.

---

## Step 1 — Add GitHub secret (one time)

1. Open your repo on **github.com**.
2. **Settings** → **Secrets and variables** → **Actions**.
3. **New repository secret**
   - **Name:** `VITE_API_BASE_URL`
   - **Value:** `https://smart-monitoring-production.up.railway.app`  
     (or your real Laravel URL — no trailing slash, no `/api`)

---

## Step 2 — Push the workflow to GitHub

Commit and push these files (if not already on `main`):

- `.github/workflows/desktop-release.yml`
- `Desktop-App/scripts/write-electron-build-config.cjs`
- Updated `Desktop-App/package.json` and `Desktop-App/electron/main.ts`

```powershell
cd C:\Users\ranie\OneDrive\Desktop\Sia-Web
git add .github/workflows/desktop-release.yml Desktop-App/
git commit -m "feat(desktop): GitHub Actions release workflow"
git push origin main
```

---

## Step 3 — Create a version tag

Each release needs a new tag, e.g. `v1.0.0` (must start with `v`).

```powershell
git tag v1.0.0
git push origin v1.0.0
```

Or in GitHub UI: **Releases** → **Draft a new release** → type tag `v1.0.0` → **Publish release**.

---

## Step 4 — Watch the build

1. Repo → **Actions** tab.
2. Open **Desktop App Release** for your tag.
3. Wait until the job is green (often 5–15 minutes on first run).

If it fails:

- Check secret `VITE_API_BASE_URL` exists and is the Laravel URL.
- Open the failed job log for the error line.

---

## Step 5 — Download the installer

1. Repo → **Releases**.
2. Open `v1.0.0`.
3. Download the `.exe` under **Assets** (e.g. `Desktop Login App Setup 1.0.0.exe`).

Share that link with lab PCs or IT.

---

## Step 6 — Install on a PC

1. Download the `.exe` from Releases.
2. Run it. Windows may say **Unknown publisher** — for school/lab use: **More info** → **Run anyway**.
3. Install the **Chrome extension** separately (monitoring still uses `localhost:9876` on that PC).
4. Open the app and test login (should hit Railway, not localhost).

---

## Step 7 — Ship a new version later

1. Edit `version` in `Desktop-App/package.json` (e.g. `1.0.1`).
2. Commit and push to `main`.
3. Tag and push:

```powershell
git tag v1.0.1
git push origin v1.0.1
```

4. New `.exe` appears on Releases.

---

## What GitHub does vs Railway

| Service | Role |
|---------|------|
| **Railway** | Laravel API + React web (always online) |
| **GitHub Releases** | Stores the Windows installer file |
| **Each PC** | Runs the installed app; calls Railway over HTTPS |

---

## Optional: test build on your PC first

```powershell
cd Desktop-App
copy .env.example .env
# Edit .env: set VITE_API_BASE_URL to your Railway Laravel URL
npm install
npm run build:app
```

Installer output: `Desktop-App/release/`
