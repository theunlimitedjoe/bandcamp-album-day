#!/bin/bash
# Setup script for scheduling daily bandcamp album updates via cron

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRON_JOB="0 5 * * * cd $SCRIPT_DIR && /usr/bin/node fetch-bandcamp.js --daily >> fetch-bandcamp.log 2>&1"

echo "Setting up cron job for daily album updates..."
echo "Job: $CRON_JOB"

# Check if job already exists
if crontab -l 2>/dev/null | grep -q "fetch-bandcamp.js"; then
    echo "Cron job already exists. Removing old job..."
    crontab -l 2>/dev/null | grep -v "fetch-bandcamp.js" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✓ Cron job installed!"
echo ""
echo "To verify installation, run:"
echo "  crontab -l"
echo ""
echo "To check logs, run:"
echo "  tail -f $SCRIPT_DIR/fetch-bandcamp.log"
echo ""
echo "To test the script immediately, run:"
echo "  cd $SCRIPT_DIR && node fetch-bandcamp.js --force"
