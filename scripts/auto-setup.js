#!/usr/bin/env node
/**
 * Auto-setup script for OpenClaw buddy
 * Runs before server.js starts to automatically configure buddy from environment variables
 * 
 * Required environment variables:
 * - SETUP_PASSWORD: Password for setup API authentication
 * - GEMINI_API_KEY: Google Gemini API key
 * - TELEGRAM_BOT_TOKEN: Telegram bot token
 * 
 * Optional:
 * - OPENCLAW_MODEL: Model to use (default: google/gemini-2.0-flash)
 * - AUTO_SETUP_ENABLED: Set to "false" to disable auto-setup (default: true)
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Volume mount path (Railway mounts to /data by default)
const VOLUME_PATH = '/data';
const VOLUME_STATE_DIR = path.join(VOLUME_PATH, '.openclaw');
const VOLUME_WORKSPACE_DIR = path.join(VOLUME_PATH, 'workspace');

// Default OpenClaw paths (these get symlinked to volume)
const DEFAULT_STATE_DIR = path.join(os.homedir(), '.openclaw');
const DEFAULT_WORKSPACE_DIR = path.join(process.cwd(), 'data', 'workspace');

// Use volume paths if volume is mounted, otherwise use defaults
const VOLUME_MOUNTED = fs.existsSync(VOLUME_PATH) && fs.statSync(VOLUME_PATH).isDirectory();
const STATE_DIR = process.env.OPENCLAW_STATE_DIR?.trim() || (VOLUME_MOUNTED ? VOLUME_STATE_DIR : DEFAULT_STATE_DIR);
const WORKSPACE_DIR = process.env.OPENCLAW_WORKSPACE_DIR?.trim() || (VOLUME_MOUNTED ? VOLUME_WORKSPACE_DIR : DEFAULT_WORKSPACE_DIR);
const CONFIG_PATH = path.join(STATE_DIR, 'clawdbot.json');
const AUTO_SETUP_ENABLED = process.env.AUTO_SETUP_ENABLED?.toLowerCase() !== 'false';

/**
 * Set up persistent state by creating symlinks from default paths to volume
 * This ensures pairing and config survive redeploys
 */
function setupPersistentState() {
    if (!VOLUME_MOUNTED) {
        console.log('[auto-setup] No volume mounted at /data, using ephemeral storage');
        return;
    }

    console.log('[auto-setup] Setting up persistent state on volume...');

    // Ensure volume directories exist with proper permissions
    try {
        if (!fs.existsSync(VOLUME_STATE_DIR)) {
            fs.mkdirSync(VOLUME_STATE_DIR, { recursive: true, mode: 0o700 });
            console.log(`[auto-setup] ✅ Created ${VOLUME_STATE_DIR} (mode 700)`);
        } else {
            // Fix permissions on existing state dir
            fs.chmodSync(VOLUME_STATE_DIR, 0o700);
        }
        if (!fs.existsSync(VOLUME_WORKSPACE_DIR)) {
            fs.mkdirSync(VOLUME_WORKSPACE_DIR, { recursive: true, mode: 0o755 });
            console.log(`[auto-setup] ✅ Created ${VOLUME_WORKSPACE_DIR}`);
        }
    } catch (err) {
        console.error(`[auto-setup] ⚠️ Could not create volume directories: ${err.message}`);
        console.log('[auto-setup] Falling back to ephemeral storage');
        return;
    }

    // Create symlink for state dir (if default path is used and not already a symlink)
    try {
        if (!process.env.OPENCLAW_STATE_DIR && fs.existsSync(DEFAULT_STATE_DIR)) {
            const stats = fs.lstatSync(DEFAULT_STATE_DIR);
            if (!stats.isSymbolicLink()) {
                // If there's existing data, copy it first
                if (fs.readdirSync(DEFAULT_STATE_DIR).length > 0) {
                    console.log('[auto-setup] Migrating existing state to volume...');
                    fs.cpSync(DEFAULT_STATE_DIR, VOLUME_STATE_DIR, { recursive: true });
                }
                fs.rmSync(DEFAULT_STATE_DIR, { recursive: true });
                fs.symlinkSync(VOLUME_STATE_DIR, DEFAULT_STATE_DIR);
                console.log(`[auto-setup] ✅ Symlinked ${DEFAULT_STATE_DIR} → ${VOLUME_STATE_DIR}`);
            }
        } else if (!process.env.OPENCLAW_STATE_DIR && !fs.existsSync(DEFAULT_STATE_DIR)) {
            // Create symlink if default doesn't exist yet
            fs.symlinkSync(VOLUME_STATE_DIR, DEFAULT_STATE_DIR);
            console.log(`[auto-setup] ✅ Symlinked ${DEFAULT_STATE_DIR} → ${VOLUME_STATE_DIR}`);
        }
    } catch (err) {
        console.error(`[auto-setup] ⚠️ Could not create state symlink: ${err.message}`);
    }

    console.log('[auto-setup] Persistent state setup complete');
}

// Workspace template files (stored in /app/templates or bundled with image)
const WORKSPACE_TEMPLATES = ['Bootstrap.md', 'Identity.md', 'Soul.md', 'Memory.md'];
const TEMPLATES_DIR = path.join(process.cwd(), 'templates', 'workspace');

const REQUIRED_VARS = {
    SETUP_PASSWORD: process.env.SETUP_PASSWORD?.trim(),
    GEMINI_API_KEY: process.env.GEMINI_API_KEY?.trim(),
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN?.trim(),
};

const OPTIONAL_VARS = {
    OPENCLAW_MODEL: process.env.OPENCLAW_MODEL?.trim() || 'google/gemini-2.0-flash',
};

function isConfigured() {
    return fs.existsSync(CONFIG_PATH);
}

function checkRequiredVars() {
    const missing = [];
    for (const [key, value] of Object.entries(REQUIRED_VARS)) {
        if (!value) {
            missing.push(key);
        }
    }
    return missing;
}

/**
 * Copy workspace templates to the workspace directory if they don't exist
 * Templates are processed to replace placeholders with actual values
 */
function copyWorkspaceTemplates() {
    console.log('[auto-setup] Checking workspace templates...');

    // Ensure workspace directory exists
    if (!fs.existsSync(WORKSPACE_DIR)) {
        fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
        console.log(`[auto-setup] Created workspace directory: ${WORKSPACE_DIR}`);
    }

    // Check if templates directory exists
    if (!fs.existsSync(TEMPLATES_DIR)) {
        console.log(`[auto-setup] ⚠️  Templates directory not found: ${TEMPLATES_DIR}`);
        console.log('[auto-setup] Skipping workspace template setup');
        return;
    }

    let added = 0;
    let skipped = 0;

    for (const templateFile of WORKSPACE_TEMPLATES) {
        const sourcePath = path.join(TEMPLATES_DIR, templateFile);
        const destPath = path.join(WORKSPACE_DIR, templateFile);

        // Skip if destination already exists (don't overwrite)
        if (fs.existsSync(destPath)) {
            skipped++;
            continue;
        }

        // Skip if source doesn't exist
        if (!fs.existsSync(sourcePath)) {
            console.log(`[auto-setup] ⚠️  Template not found: ${templateFile}`);
            continue;
        }

        // Read template and process placeholders
        let content = fs.readFileSync(sourcePath, 'utf-8');

        // Replace placeholders with environment values or defaults
        const placeholders = {
            '{{BUDDY_NAME}}': process.env.BUDDY_NAME || 'Buddy',
            '{{HUMAN}}': process.env.BUDDY_HUMAN || 'Human',
            '{{TELEGRAM_BOT_USERNAME}}': process.env.TELEGRAM_BOT_USERNAME || '@UnknownBot',
        };

        for (const [placeholder, value] of Object.entries(placeholders)) {
            content = content.replace(new RegExp(placeholder, 'g'), value);
        }

        // Write to workspace
        fs.writeFileSync(destPath, content, 'utf-8');
        console.log(`[auto-setup] ✅ Added ${templateFile} to workspace`);
        added++;
    }

    console.log(`[auto-setup] Workspace templates: ${added} added, ${skipped} already exist`);
}

async function waitForServer(maxAttempts = 30) {
    const url = 'http://localhost:8080/setup/healthz';

    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                console.log('[auto-setup] Server is ready');
                return true;
            }
        } catch (err) {
            // Server not ready yet
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    throw new Error('Server did not become ready in time');
}

async function runSetup() {
    console.log('[auto-setup] Running automated setup...');

    const setupPayload = {
        flow: 'quickstart',
        authChoice: 'gemini-api-key',
        authSecret: REQUIRED_VARS.GEMINI_API_KEY,
        model: OPTIONAL_VARS.OPENCLAW_MODEL,
        telegramToken: REQUIRED_VARS.TELEGRAM_BOT_TOKEN,
    };

    const auth = Buffer.from(`:${REQUIRED_VARS.SETUP_PASSWORD}`).toString('base64');

    try {
        const response = await fetch('http://localhost:8080/setup/api/run', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(setupPayload),
        });

        const result = await response.json();

        if (result.ok) {
            console.log('[auto-setup] ✅ Setup completed successfully');
            console.log('[auto-setup] Configuration:');
            console.log(`  - Model: ${OPTIONAL_VARS.OPENCLAW_MODEL}`);
            console.log(`  - Telegram: ${REQUIRED_VARS.TELEGRAM_BOT_TOKEN.substring(0, 10)}...`);

            // CRITICAL: Set gateway.mode=local - without this the gateway refuses to start
            await setGatewayMode(auth);

            return true;
        } else {
            console.error('[auto-setup] ❌ Setup failed');
            console.error('[auto-setup] Output:', result.output);
            return false;
        }
    } catch (err) {
        console.error('[auto-setup] ❌ Setup request failed:', err.message);
        return false;
    }
}

async function setGatewayMode(auth) {
    console.log('[auto-setup] Setting gateway.mode=local...');
    try {
        const response = await fetch('http://localhost:8080/setup/api/config', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path: 'gateway.mode', value: 'local' }),
        });

        if (response.ok) {
            console.log('[auto-setup] ✅ Gateway mode set to local');
        } else {
            // If API fails, try direct file modification
            console.log('[auto-setup] API failed, setting gateway.mode directly in config file...');
            const configPath = path.join(STATE_DIR, 'openclaw.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                config.gateway = config.gateway || {};
                config.gateway.mode = 'local';
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                console.log('[auto-setup] ✅ Gateway mode set to local (direct file update)');
            }
        }
    } catch (err) {
        // Fallback: direct file modification
        console.log('[auto-setup] Setting gateway.mode directly in config file...');
        const configPath = path.join(STATE_DIR, 'openclaw.json');
        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                config.gateway = config.gateway || {};
                config.gateway.mode = 'local';
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                console.log('[auto-setup] ✅ Gateway mode set to local (direct file update)');
            } catch (e) {
                console.error('[auto-setup] ❌ Failed to set gateway mode:', e.message);
            }
        }
    }
}

// Main execution
async function main() {
    console.log('[auto-setup] Starting auto-configuration check...');

    // Set up persistent state on volume (symlinks)
    setupPersistentState();

    // Check if auto-setup is enabled
    if (!AUTO_SETUP_ENABLED) {
        console.log('[auto-setup] Auto-setup is disabled (AUTO_SETUP_ENABLED=false)');
        console.log('[auto-setup] Skipping...');
        process.exit(0);
    }

    // Check if already configured
    if (isConfigured()) {
        console.log('[auto-setup] Already configured (config exists)');
        // Still ensure workspace templates exist
        copyWorkspaceTemplates();
        console.log('[auto-setup] To reconfigure, delete the config or set different env vars');
        process.exit(0);
    }

    // Check for required environment variables
    const missing = checkRequiredVars();
    if (missing.length > 0) {
        console.log('[auto-setup] ⚠️  Missing required environment variables:', missing.join(', '));
        console.log('[auto-setup] Auto-setup cannot proceed. The /setup wizard will be available.');
        process.exit(0);
    }

    console.log('[auto-setup] All required variables present, proceeding with auto-setup...');

    // Start the server in background
    const { spawn } = await import('node:child_process');
    const serverProc = spawn('node', ['src/server.js'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
    });

    let serverOutput = '';
    serverProc.stdout.on('data', (data) => {
        const text = data.toString();
        serverOutput += text;
        // Only show important server messages during auto-setup
        if (text.includes('[wrapper]') || text.includes('ERROR') || text.includes('error')) {
            process.stdout.write(text);
        }
    });

    serverProc.stderr.on('data', (data) => {
        process.stderr.write(data);
    });

    // Wait for server to be ready
    console.log('[auto-setup] Waiting for server to start...');
    try {
        await waitForServer();
    } catch (err) {
        console.error('[auto-setup] ❌', err.message);
        serverProc.kill();
        process.exit(1);
    }

    // Run the setup
    const success = await runSetup();

    // Kill the temporary server
    serverProc.kill();

    // Wait a bit for cleanup
    await new Promise(r => setTimeout(r, 1000));

    if (success) {
        console.log('[auto-setup] 🎉 Auto-setup complete! Starting main server...');
        process.exit(0);
    } else {
        console.error('[auto-setup] ❌ Auto-setup failed. Check logs above.');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('[auto-setup] Fatal error:', err);
    process.exit(1);
});
