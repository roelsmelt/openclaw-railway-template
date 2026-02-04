#!/bin/bash
# Entrypoint script that fixes volume permissions before running as app user
# Railway mounts volumes after container start, so we need to fix permissions at runtime

VOLUME_PATH="/data"

# If /data exists and is a mount point, fix permissions
if [ -d "$VOLUME_PATH" ]; then
    echo "[entrypoint] Fixing permissions on $VOLUME_PATH..."
    chown -R openclaw:openclaw "$VOLUME_PATH" 2>/dev/null || {
        echo "[entrypoint] Warning: Could not chown $VOLUME_PATH (may not have permission)"
    }
fi

# Run the main command as the openclaw user
exec gosu openclaw "$@"
