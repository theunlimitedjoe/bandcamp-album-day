# bandcamp-album-day

This project scrapes Bandcamp Daily Album of the Day listings and Aquarium Drunkard "On The Turntable" albums, then renders them locally in the same unified layout.

## Usage

1. Generate `albums.json`:

```bash
node fetch-bandcamp.js
```

2. **Setup automatic daily updates** (optional but recommended):

Use the provided setup script to automatically configure cron for daily updates at 5 AM:

```bash
bash setup-cron.sh
```

Or manually add this to your crontab:

```bash
crontab -e
# Add this line:
0 5 * * * cd /workspaces/bandcamp-album-day && /usr/bin/node fetch-bandcamp.js --daily >> fetch-bandcamp.log 2>&1
```

**To check if your cron job is running:**

```bash
# View installed cron jobs
crontab -l

# Check recent execution logs
tail -20 fetch-bandcamp.log

# Check for any image download errors
tail fetch-errors.log
```

**To test the script immediately:**

```bash
node fetch-bandcamp.js --force
```

3. Serve the folder from a local static server.
   Opening `index.html` directly in the browser will usually fail to fetch `albums.json`.

Example with Python 3:

```bash
cd /workspaces/bandcamp-album-day
python3 -m http.server 8000
```

Then open:

```
http://localhost:8000
```

## Logs

The script creates two log files to help with debugging:

- **`fetch-bandcamp.log`**: Main execution log with timestamps and status for each run
- **`fetch-errors.log`**: Detailed error log for failed image downloads

Check these files if updates aren't working as expected:

```bash
tail -f fetch-bandcamp.log  # Monitor in real-time
cat fetch-errors.log         # View all failed image downloads
```

## Troubleshooting

- **Page shows "Loading..."**: Check the browser console for errors from `script.js`
- **`albums.json` is empty**: Run `node fetch-bandcamp.js --force` and check `fetch-bandcamp.log` for errors
- **AOTY images not showing**: Check `fetch-errors.log` for failed AOTY image downloads. This can happen if proxy services are down. Wait a moment and try running the script again.
- **Cron job not updating**: Verify the job is installed with `crontab -l`, then check `fetch-bandcamp.log` for execution errors
- **Old albums still showing**: The script caches daily fetches. Use `--force` flag to refresh immediately: `node fetch-bandcamp.js --force`
