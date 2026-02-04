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
 * - OPENCLAW_MODEL: Model to use (default: google/gemini-2.0-flash-exp)
 * - AUTO_SETUP_ENABLED: Set to "false" to disable auto-setup (default: true)
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const STATE_DIR = process.env.OPENCLAW_STATE_DIR?.trim() || path.join(os.homedir(), '.openclaw');
const CONFIG_PATH = path.join(STATE_DIR, 'clawdbot.json');
const AUTO_SETUP_ENABLED = process.env.AUTO_SETUP_ENABLED?.toLowerCase() !== 'false';

const REQUIRED_VARS = {
    SETUP_PASSWORD: process.env.SETUP_PASSWORD?.trim(),
    GEMINI_API_KEY: process.env.GEMINI_API_KEY?.trim(),
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN?.trim(),
};

const OPTIONAL_VARS = {
    OPENCLAW_MODEL: process.env.OPENCLAW_MODEL?.trim() || 'google/gemini-2.0-flash-exp',
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

// Main execution
async function main() {
    console.log('[auto-setup] Starting auto-configuration check...');

    // Check if auto-setup is enabled
    if (!AUTO_SETUP_ENABLED) {
        console.log('[auto-setup] Auto-setup is disabled (AUTO_SETUP_ENABLED=false)');
        console.log('[auto-setup] Skipping...');
        process.exit(0);
    }

    // Check if already configured
    if (isConfigured()) {
        console.log('[auto-setup] Already configured (config exists)');
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
