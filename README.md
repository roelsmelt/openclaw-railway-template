# OpenClaw Railway Buddy - Auto-Configuration Guide

Forked from [arjunkomath/openclaw-railway-template](https://github.com/arjunkomath/openclaw-railway-template) with auto-configuration support.

## 🎯 Quick Deploy

1. **Create new service** in Railway from this repo
2. **Set environment variables** (see below)
3. **Deploy** - buddy auto-configures on first start
4. **Done!** No manual /setup wizard needed

## 📋 Environment Variables

### Shared Variables (Project-wide)
Set these once in Railway **Project Settings → Shared Variables**:
- `GEMINI_API_KEY` - Your Google Gemini API key
- `GCS_BUDDY_KEY` - Google Cloud Storage key for buddy data

### Per-Buddy Variables  
Set these individually in each **Service → Variables**:
- `TELEGRAM_BOT_TOKEN` - Unique Telegram bot token for this buddy
- `SETUP_PASSWORD` - Setup wizard password (auto-generated in template)
- `OPENCLAW_MODEL` - Optional, defaults to `google/gemini-2.0-flash`

### Auto-Generated Variables
These are set automatically by the template, don't change:
- `OPENCLAW_STATE_DIR` = `/data/.openclaw`
- `OPENCLAW_WORKSPACE_DIR` = `/data/workspace`
- `OPENCLAW_GATEWAY_TOKEN` - Auto-generated per buddy
- `INTERNAL_GATEWAY_HOST` = `127.0.0.1`
- `INTERNAL_GATEWAY_PORT` = `18789`
- `PORT` = `8080`
- `RAILWAY_RUN_UID` = `0`

## 🤖 Auto-Configuration

### How It Works
1. Container starts
2. `scripts/auto-setup.js` runs before server
3. Checks if already configured (clawdbot.json exists)
4. If not configured + env vars present → auto-configures via setup API
5. Server starts fully configured

### Logs
Watch deployment logs for auto-setup progress:
```
[auto-setup] Starting auto-configuration check...
[auto-setup] All required variables present, proceeding with auto-setup...
[auto-setup] Waiting for server to start...
[auto-setup] Server is ready
[auto-setup] Running automated setup...
[auto-setup] ✅ Setup completed successfully
[auto-setup] 🎉 Auto-setup complete! Starting main server...
```

### Reconfiguring a Buddy
To reconfigure (e.g., new Telegram bot):
1. Update `TELEGRAM_BOT_TOKEN` in Railway
2. Go to service Settings → Delete `emrys-data` volume (or equivalent)
3. Redeploy
4. Auto-setup runs again with new config

## 🚀 Deployment

Current buddy deployments:
- **Roel | Galahad**: [roel-or-galahad-production.up.railway.app](https://roel-or-galahad-production.up.railway.app)
- **Roel | Emrys**: [openclaw-production-cd53.up.railway.app](https://openclaw-production-cd53.up.railway.app)  
- **Ess | Morgan**: [openclaw-production-5ef6.up.railway.app](https://openclaw-production-5ef6.up.railway.app)
- **Ess | Kaleh**: TBD

## 🔧 Manual Setup (Fallback)

If auto-setup fails or is disabled (`AUTO_SETUP_ENABLED=false`):
1. Navigate to `https://<your-buddy>.up.railway.app/setup`
2. Login with `SETUP_PASSWORD`
3. Configure manually via wizard

## 📦 Updating OpenClaw Version

Auto-updates are tracked via GitHub Action. To manually update:
1. Edit `Dockerfile` line 17
2. Change version: `RUN npm install -g openclaw@X.X.X`
3. Commit and push
4. Railway auto-deploys

See [VERSION_MANAGEMENT.md](VERSION_MANAGEMENT.md) for version tracking details.

## 🐛 Troubleshooting

### Auto-setup fails
Check Railway logs for specific error. Common issues:
- Missing `GEMINI_API_KEY` in shared variables
- Missing `TELEGRAM_BOT_TOKEN` for this buddy
- Invalid bot token

### Buddy keeps showing /setup wizard
Means auto-setup was skipped. Check:
```bash
railway logs | grep auto-setup
```

Look for messages about missing variables.

### Change Telegram bot mid-deployment
1. Update `TELEGRAM_BOT_TOKEN` variable
2. Delete volume to force reconfiguration
3. Redeploy

## 📝 Creating New Buddies

1. **In Railway:**
   - Create new service from this repo
   - Attach to `MyBuddyTalk` project to use shared variables
   
2. **Create Telegram Bot:**
   - Message [@BotFather](https://t.me/botfather)
   - `/newbot` → follow prompts
   - Copy bot token
   
3. **Set Variables:**
   ```
   TELEGRAM_BOT_TOKEN=<your-bot-token>
   OPENCLAW_MODEL=google/gemini-2.0-flash  # optional
   ```
   
4. **Deploy:** Buddy auto-configures on first start

5. **Pair via Telegram:**
   - Message your bot
   - Get pairing code from buddy setup page
   - Approve pairing

## 🔗 Links

- [OpenClaw Releases](https://github.com/openclaw/openclaw/releases)
- [Original Template](https://github.com/arjunkomath/openclaw-railway-template)
- [Railway Docs](https://docs.railway.app)
