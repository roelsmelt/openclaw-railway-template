# OpenClaw Railway Template - Forked Version

Forked from [arjunkomath/openclaw-railway-template](https://github.com/arjunkomath/openclaw-railway-template) for custom configuration and stability.

## Customizations

- **Dockerfile**: Added comments about OpenClaw versioning
- **Environment**: Configured for Gemini API and GCS bucket integration
- **Stability**: Control over updates to prevent breaking changes

## Deployment

This fork is deployed to Railway for the MyBuddyTalk project:
- **Ess | Morgan**: openclaw-production-5ef6.up.railway.app
- **Roel | Emrys**: openclaw-production-cd53.up.railway.app

## Environment Variables Required

See original README for full documentation. Key variables:
- `OPENCLAW_STATE_DIR=/data/.openclaw`
- `OPENCLAW_WORKSPACE_DIR=/data/workspace`
- `OPENCLAW_GATEWAY_TOKEN` (generated secret)
- `SETUP_PASSWORD` (generated secret)
- `GEMINI_API_KEY` (from Railway Shared Secrets)
- `GCS_BUDDY_KEY` (from Railway Shared Secrets)

## Updating OpenClaw Version

If OpenClaw releases a breaking change, pin the version in Dockerfile:
```dockerfile
RUN npm install -g openclaw@2026.1.24
```

See [OpenClaw releases](https://github.com/openclaw/openclaw/releases) for version history.
