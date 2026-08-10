# Deploy Desktop-App to GitHub (step by step)

GitHub **builds** the Windows `.exe` and **hosts** it on Releases. The installer calls whatever URL is in `Desktop-App/public/api-base.json`.

---

## Before you start

1. Code is pushed to GitHub (this repo).
2. Set **`Desktop-App/public/api-base.json`** to the API every installed PC should use:
   - **Local lab (each PC runs Laravel on itself):** `"apiBase": "http://127.0.0.1:8000"`
   - **LAN server:** `"apiBase": "http://192.168.x.x:8000"` (your machine’s IP)
   - **Cloud (Railway etc.):** `"apiBase": "https://your-laravel-service.up.railway.app"`
3. Test the URL in a browser: `…/health` must return JSON with `"status":"ok"` and `"php"`.

---

## Step 1 — Push the workflow to GitHub

Commit and push (if not already on `main`):

- `.github/workflows/desktop-release.yml`
- `Desktop-App/public/api-base.json` (with the correct `apiBase`)
- `Desktop-App/scripts/write-electron-build-config.cjs`

```powershell
cd C:\Users\ranie\OneDrive\Desktop\Sia-Web
git add .github/workflows/desktop-release.yml Desktop-App/
git commit -m "feat(desktop): GitHub Actions release workflow"
git push origin main
```

The workflow reads `api-base.json` at build time — no GitHub secret required.

---

## Step 2 — Create a version tag

Each release needs a new tag, e.g. `v1.0.0` (must start with `v`).

```powershell
git tag v1.0.0
git push origin v1.0.0
```

Or in GitHub UI: **Releases** → **Draft a new release** → type tag `v1.0.0` → **Publish release**.

---

## Step 3 — Watch the build

1. Repo → **Actions** tab.
2. Open **Desktop App Release** for your tag.
3. Wait until the job is green (often 5–15 minutes on first run).

If it fails, open the failed job log. Common fixes: bump `version` in `package.json`, ensure `public/api-base.json` has a non-empty `apiBase`.

---

## Step 4 — Download the installer

1. Repo → **Releases**.
2. Open your tag (e.g. `v1.0.0`).
3. Download the `.exe` under **Assets** (e.g. `Desktop Login App Setup 1.0.0.exe`).

Share that link with lab PCs or IT.

---

## Step 5 — Install on a PC

1. Download the `.exe` from Releases.
2. Run it. Windows may say **Unknown publisher** — for school/lab use: **More info** → **Run anyway**.
3. Install the **Chrome extension** separately (monitoring uses `localhost:9876` on that PC when the Desktop App is running).
4. **Localhost build:** Laravel must be running on that PC (`php artisan serve` on port 8000).
5. Open the app and test login.

---

## Step 6 — Ship a new version later

1. Update `apiBase` in `public/api-base.json` if the API URL changed.
2. Edit `version` in `Desktop-App/package.json` (e.g. `1.0.1`).
3. Commit, push, tag:

```powershell
git add Desktop-App/public/api-base.json Desktop-App/package.json
git commit -m "chore(desktop): release 1.0.1"
git push origin main
git tag v1.0.1
git push origin v1.0.1
```

4. New `.exe` appears on Releases.

---

## What GitHub does vs your API

| Piece | Role |
|-------|------|
| **Laravel** (local or cloud) | API the app talks to |
| **GitHub Releases** | Stores the Windows installer |
| **Each PC** | Runs the installed app; calls the URL baked into `api-base.json` |

---

## Optional: test build on your PC first

```powershell
cd Desktop-App
copy .env.example .env
npm install
npm run build:app
```

Installer output: `Desktop-App/release/`
