# bandcamp-album-day

This project scrapes Bandcamp Daily Album of the Day listings and Aquarium Drunkard "On The Turntable" albums, then renders them locally in the same unified layout.

## Usage

1. Generate `albums.json`:

```bash
node fetch-bandcamp.js
```

For a once-per-day automatic refresh at 5 AM, schedule the script with your system task scheduler. For example, using cron:

```bash
0 5 * * * cd /workspaces/bandcamp-album-day && node fetch-bandcamp.js --daily
```

If you want to refresh immediately, run:

```bash
node fetch-bandcamp.js
```

2. Serve the folder from a local static server.
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

## Troubleshooting

- If the page shows `Loading...`, check the browser console for the error from `script.js`.
- If `albums.json` is empty, rerun `node fetch-bandcamp.js` and verify the file contains data.
- If `fetch-bandcamp.js` still returns `0 albums`, confirm the page HTML in `debug.html` matches the remote structure.
