# Deploying to Railway

## One-time setup

1. Push this folder to a GitHub repo (Railway deploys from GitHub).
2. At [railway.app](https://railway.app), **New Project → Deploy from GitHub repo**, pick this repo.
3. Railway reads `railway.json` automatically — it'll run `npm run build` then `npm run start`. No other config needed there.
4. In the service's **Variables** tab, add:
   - `ANTHROPIC_API_KEY` — your key, for the AI Assistant.
   - `APP_PASSWORD` — a password you choose. Without this the app is wide open to anyone with the URL.
   - `DATA_DIR` — `/data` (must match the volume mount path in step 5).
5. In the service's **Volumes** tab, attach a volume mounted at `/data`. This is what makes your tasks/journal/etc. survive restarts and redeploys — without it, every deploy wipes your data.
6. Railway assigns a public URL automatically (Settings → Networking → Generate Domain).

## Using it

- Visit the Railway URL from any browser or phone. You'll get a native browser login prompt — any username, and the `APP_PASSWORD` you set.
- Add it to your phone's home screen (Share → Add to Home Screen on iOS, or the browser menu on Android) for an app-like icon.

## Redeploying after changes

Push to the connected GitHub branch — Railway redeploys automatically. Your data isn't touched since it lives on the volume, not in the deployed code.

## Rotating the password

Change `APP_PASSWORD` in the Variables tab and redeploy (Railway does this automatically on any variable change).
