# Running on a Raspberry Pi via Tailscale

No public exposure, no third-party host holding your data — just this Pi and
whatever devices are on your tailnet.

## One-time setup

1. Confirm the Pi is on your tailnet already (`tailscale status` on the Pi), and
   note its Tailscale hostname (MagicDNS name, e.g. `raspberrypi`) or run
   `tailscale ip -4` for its tailnet IP.

2. SSH into the Pi and check Node's installed and new enough (need >=20.6):
   ```
   node -v
   ```
   If missing or too old:
   ```
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. Clone and install (do this *before* anything sets `NODE_ENV=production` in
   your shell — that would skip the devDependencies this app needs to build):
   ```
   git clone https://github.com/cotweblog/life-work-os.git
   cd life-work-os
   npm install
   npm run build
   ```

4. Configure:
   ```
   cp .env.example .env
   nano .env
   ```
   Set `APP_PASSWORD` (still worth keeping even on a private tailnet — other
   devices/people may share it) and `ANTHROPIC_API_KEY` (optional, for the AI
   Assistant). Leave `DATA_DIR` blank — the Pi's own disk is already
   persistent, unlike Railway's throwaway container filesystem.

5. Test it:
   ```
   npm run start
   ```
   From your phone (connected to the same tailnet), open
   `http://<pi-hostname>:3001` and confirm it loads.

6. Make it survive reboots with a systemd service:
   ```
   sudo nano /etc/systemd/system/life-work-os.service
   ```
   ```ini
   [Unit]
   Description=Life Work OS
   After=network.target

   [Service]
   Type=simple
   WorkingDirectory=/home/pi/life-work-os
   ExecStart=/usr/bin/npm run start
   Restart=on-failure
   User=pi

   [Install]
   WantedBy=multi-user.target
   ```
   (The app loads `.env` itself from its working directory, so systemd doesn't
   need to pass environment variables separately.)

   Then:
   ```
   sudo systemctl daemon-reload
   sudo systemctl enable --now life-work-os
   sudo systemctl status life-work-os
   ```

## Accessing it

`http://<pi-tailscale-hostname>:3001` from any device on your tailnet, phone included.

## Redeploying after changes

```
cd life-work-os
git pull
npm install
npm run build
sudo systemctl restart life-work-os
```

## If you're also running this on Railway

The Pi and Railway would be two separate instances with two separate data
files — nothing syncs between them. Pick one as the real one you use day to
day, or shut the other down, otherwise tasks added on your phone might land
in whichever instance you happened to hit.
