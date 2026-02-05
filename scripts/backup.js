const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
const archiver = require('archiver');

const GCS_KEY = process.env.GCS_MAGICIAN_KEY || process.env.GCS_BUDDY_KEY;
const BUCKET_NAME = 'mybuddy-backups';
const BUDDY_NAME = process.env.BUDDY_NAME || 'unknown-buddy';
const VOLUME_PATH = '/data';

if (!GCS_KEY) {
    console.error('[backup] ⚠️ No GCS key found. Backups disabled.');
    process.exit(0);
}

let storage;
try {
    const keyData = JSON.parse(GCS_KEY);
    storage = new Storage({
        credentials: keyData,
        projectId: keyData.project_id
    });
} catch (err) {
    console.error(`[backup] ⚠️ Failed to parse GCS key: ${err.message}`);
    process.exit(1);
}

async function runBackup() {
    console.log(`[backup] 🚀 Starting daily backup for ${BUDDY_NAME}...`);

    if (!fs.existsSync(VOLUME_PATH)) {
        console.error('[backup] ⚠️ volume /data not found. Nothing to backup.');
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `${BUDDY_NAME}-${timestamp}.tar.gz`;
    const localArchivePath = path.join('/tmp', archiveName);

    const output = fs.createWriteStream(localArchivePath);
    const archive = archiver('tar', { gzip: true });

    return new Promise((resolve, reject) => {
        output.on('close', async () => {
            console.log(`[backup] 📦 Archive created: ${archive.pointer()} total bytes`);
            try {
                await storage.bucket(BUCKET_NAME).upload(localArchivePath, {
                    destination: `daily/${BUDDY_NAME}/${archiveName}`,
                });
                console.log(`[backup] ✅ Uploaded to gs://${BUCKET_NAME}/daily/${BUDDY_NAME}/${archiveName}`);
                fs.unlinkSync(localArchivePath);
                resolve();
            } catch (err) {
                console.error(`[backup] ❌ Upload failed: ${err.message}`);
                reject(err);
            }
        });

        archive.on('error', (err) => { reject(err); });
        archive.pipe(output);

        // Backup .openclaw (state) and workspace
        if (fs.existsSync(path.join(VOLUME_PATH, '.openclaw'))) {
            archive.directory(path.join(VOLUME_PATH, '.openclaw'), '.openclaw');
        }
        if (fs.existsSync(path.join(VOLUME_PATH, 'workspace'))) {
            archive.directory(path.join(VOLUME_PATH, 'workspace'), 'workspace');
        }

        archive.finalize();
    });
}

// Run immediately if --once flag is present, otherwise start interval
if (process.argv.includes('--once')) {
    runBackup().then(() => process.exit(0)).catch(() => process.exit(1));
} else {
    // Run once at startup
    runBackup().catch(console.error);
    // Then every 24 hours
    setInterval(() => {
        runBackup().catch(console.error);
    }, 24 * 60 * 60 * 1000);
}
