# OpenClaw Version Management

## How It Works

Your fork uses **pinned OpenClaw versions** for stability, with **automated update notifications** via GitHub Actions.

### Current Setup

**Dockerfile:** OpenClaw version is pinned to `2026.2.2-3`
```dockerfile
RUN npm install -g openclaw@2026.2.2-3
```

### Automated Update Workflow

**Schedule:** Every Monday & Thursday at 10:00 UTC  
**Trigger:** Can also run manually via GitHub Actions tab

**What happens:**
1. 🔍 GitHub Action checks npm for new OpenClaw version
2. 📝 If newer version found, creates a PR with:
   - Updated Dockerfile
   - Changelog link
   - Testing checklist
3. 🚀 Railway automatically creates **preview deployment** for the PR
4. ✅ You test the preview, then merge if stable
5. 🎯 Railway auto-deploys to production after merge

### Testing a Version Update PR

When you receive a PR titled "🦞 Update OpenClaw to X.X.X":

1. **Check Railway Preview**
   - PR will have Railway preview deployment link
   - Click "View deployment"
   
2. **Test the Preview**
   - Check `/setup/healthz` endpoint
   - Verify gateway starts
   - Test Gemini API responses
   - Check Telegram bot

3. **Review Changelog**
   - Click the "OpenClaw releases" link in PR
   - Look for breaking changes
   - Note new features

4. **Merge or Close**
   - ✅ If stable: Merge PR → auto-deploys to production
   - ❌ If broken: Close PR, wait for fix

### Manual Version Update

If you need to update immediately:

```bash
cd /Users/roelsmelt/Antigravity/Viriya/MyBuddy/openclaw-railway-fork

# Edit Dockerfile - change version line
# Then commit and push
git add Dockerfile
git commit -m "chore: update OpenClaw to X.X.X"
git push origin main
```

Railway will auto-deploy after push.

### Monitoring

**Watch OpenClaw releases:**
1. Go to https://github.com/openclaw/openclaw
2. Click "Watch" → "Custom" → "Releases"
3. Get notified immediately when new version drops

**Check workflow runs:**
- GitHub repo → "Actions" tab
- See "Check OpenClaw Updates" workflow
- Green ✅ = no update needed
- PR created 📝 = update available

### Emergency: Rollback Version

If a new version breaks production:

1. **Quick fix** - revert Dockerfile:
   ```bash
   cd openclaw-railway-fork
   # Change version back to previous stable
   git add Dockerfile
   git commit -m "revert: rollback OpenClaw to X.X.X"
   git push origin main
   ```

2. **Railway redeploys** with old version automatically

### Benefits

✅ **Stability**: Production always runs tested version  
✅ **Awareness**: Notified of all updates  
✅ **Safety**: Preview deployments for testing  
✅ **Control**: You decide when to update  
✅ **Speed**: Automated PR creation saves time

### Troubleshooting

**Workflow didn't run:**
- Check Actions tab for errors
- Manually trigger: Actions → Check OpenClaw Updates → Run workflow

**PR not created:**
- Already on latest version (check npm view openclaw version)
- GitHub token permissions issue (check Settings → Actions)

**Preview deployment failed:**
- Likely breaking change in new OpenClaw version
- Close PR, investigate changelog
- Report issue to OpenClaw repo if needed
