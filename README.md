# SDR Power Queue Pro (PWA)

Zero-install, browser-native auto-dialer queue for SDR teams. Built with Vite + React + Dexie (IndexedDB). Works offline and deploys cleanly to Cloudflare Pages.

## Local dev (macOS/Linux/Windows)

```bash
# Node 18+ recommended
npm i
npm run dev
# open the URL it prints (usually http://localhost:5173)
```

Build & preview a production bundle:

```bash
npm run build
npm run preview
```

## GitHub + Cloudflare Pages (public hosting)

1. **Create a new GitHub repo** (empty).  
2. In your local project:
   ```bash
   git init
   git add -A
   git commit -m "Initial commit: SDR Power Queue Pro"
   git branch -M main
   git remote add origin https://github.com/<you>/sdr-power-queue-pro.git
   git push -u origin main
   ```
3. **Cloudflare Pages** → Create a project → **Connect to Git** → select your repo.  
4. Build settings:
   - **Framework**: Vite
   - **Build command**: `npm run build`
   - **Build output**: `dist`
5. Deploy. Pages will serve your PWA at `https://<project>.pages.dev`. Use **Custom Domains** if desired.

### PWA notes
- Service worker & manifest are handled by `vite-plugin-pwa`. After first load, the app works offline.
- Data is stored locally in **IndexedDB** via **Dexie**.

## Shortcuts
- `C` — Call top lead
- `1` — Log "No answer"
- `2` — Log "Left VM"
- `3` — Log "Conversation"
- `4` — Log "DNC"

## Tech
- React 18 + Vite
- Dexie (IndexedDB) for local database
- PWA via vite-plugin-pwa
