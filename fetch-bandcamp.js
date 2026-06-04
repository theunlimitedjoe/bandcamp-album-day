const fs = require("fs");

const BANDCAMP_URL = "https://daily.bandcamp.com/album-of-the-day";
const AOTY_URL = "https://www.albumoftheyear.org/releases/";
const AOTY_PROXY_URL = "https://r.jina.ai/http://www.albumoftheyear.org/releases/";
const RYM_URL = "https://rateyourmusic.com/new-music/";
const DRUNKARD_URL = "https://aquariumdrunkard.com/";
const FORCE = process.argv.includes("--force") || process.argv.includes("-f");
const DAILY = process.argv.includes("--daily");

async function main() {
  const logFile = 'fetch-bandcamp.log';
  const startTime = new Date().toISOString();
  console.log(`\n========== Fetch started: ${startTime} ==========`);
  
  const logMessage = (msg) => {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
  };

  try {
    const existing = loadExistingAlbums();

    if (DAILY && !FORCE && existing.fetchedAt && isSameLocalDay(existing.fetchedAt, new Date())) {
      const msg = `Already fetched today (${existing.fetchedAt}). Use --force to refresh manually.`;
      logMessage(msg);
      return;
    }

    logMessage("Fetching albums from Bandcamp, AOTY, RYM, and Drunkard...");
    const [bandcampAlbums, aotyAlbums, rymAlbums, drunkardAlbums] = await Promise.all([
      fetchBandcampAlbums(),
      fetchAotyAlbums(),
      fetchRymAlbums(),
      fetchDrunkardAlbums()
    ]);

    logMessage(`Fetched: ${bandcampAlbums.length} Bandcamp, ${aotyAlbums.length} AOTY, ${rymAlbums.length} RYM, ${drunkardAlbums.length} Drunkard`);

    const albumsToSave = [...bandcampAlbums.slice(0, 7), ...aotyAlbums.slice(0, 10), ...rymAlbums.slice(0, 10), ...drunkardAlbums.slice(0, 8)];
    logMessage(`Downloading images for ${albumsToSave.length} albums...`);
    const albums = await saveRemoteImages(albumsToSave);

    fs.writeFileSync("albums.json", JSON.stringify({
      fetchedAt: new Date().toISOString(),
      albums
    }, null, 2));

    const successCount = albums.filter(a => a.image && a.image !== '').length;
    const finalMsg = `✓ Saved ${albums.length} albums (${successCount} with images). Bandcamp: ${bandcampAlbums.length}, AOTY: ${aotyAlbums.length}, RYM: ${rymAlbums.length}, Drunkard: ${drunkardAlbums.length}`;
    logMessage(finalMsg);
    logMessage(`========== Fetch completed: ${new Date().toISOString()} ==========\n`);
  } catch (error) {
    const errMsg = `✗ Fatal error: ${error.message}\n${error.stack}`;
    console.error(errMsg);
    fs.appendFileSync(logFile, errMsg + '\n');
    process.exit(1);
  }
}

async function fetchAotyAlbums() {
  try {
    const res = await fetch(AOTY_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/",
        "Connection": "keep-alive"
      },
      signal: AbortSignal.timeout(15000)
    });

    const html = await res.text();
    fs.writeFileSync("debug-aoty.html", html);
    const albums = parseAotyAlbums(html);
    if (albums.length > 0) {
      console.log(`[AOTY] Direct fetch successful: ${albums.length} albums`);
      return albums;
    }

    console.warn("[AOTY] Direct parse returned 0 albums, falling back to proxy markdown fetch.");
    return fetchAotyAlbumsFromProxy();
  } catch (error) {
    console.error(`[AOTY] Direct fetch failed: ${error.message}, trying proxy...`);
    return fetchAotyAlbumsFromProxy();
  }
}

async function fetchAotyAlbumsFromProxy() {
  try {
    const res = await fetch(AOTY_PROXY_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/plain, text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/",
        "Connection": "keep-alive"
      },
      signal: AbortSignal.timeout(20000)
    });

    const text = await res.text();
    fs.writeFileSync("debug-aoty-proxy.txt", text);
    const albums = parseAotyProxyMarkdown(text);
    console.log(`[AOTY] Proxy fetch successful: ${albums.length} albums`);
    return albums;
  } catch (error) {
    console.error(`[AOTY] Proxy fetch failed: ${error.message}`);
    return [];
  }
}

async function fetchRymAlbums() {
  try {
    const res = await fetch(RYM_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/",
        "Connection": "keep-alive"
      },
      signal: AbortSignal.timeout(20000)
    });

    const html = await res.text();
    fs.writeFileSync("debug-rym.html", html);
    const albums = parseRymAlbums(html);
    console.log(`[RYM] Fetch successful: ${albums.length} albums`);
    return albums;
  } catch (error) {
    console.error(`[RYM] Fetch failed: ${error.message}`);
    return [];
  }
}

function parseRymAlbums(html) {
  const albums = [];
  const segments = html.split(/class="newreleases_item_artbox"/i).slice(1);

  for (const segment of segments) {
    if (albums.length >= 10) break;

    const titleMatch = segment.match(/title="([^"]+)"/i);
    const artistMatch = segment.match(/class="artist"[^>]*>([^<]+)</i);
    const imageMatch = segment.match(/<img[^>]+src="([^"]+)"/i);
    const linkMatch = segment.match(/<a[^>]+href="([^"]+)"/i);

    if (!titleMatch || !artistMatch || !imageMatch) {
      continue;
    }

    albums.push({
      band: clean(artistMatch[1]),
      album: clean(titleMatch[1]),
      image: makeFullUrl(imageMatch[1], "https://rateyourmusic.com"),
      link: makeFullUrl(linkMatch ? linkMatch[1] : "", "https://rateyourmusic.com"),
      source: "RYM"
    });
  }

  return albums;
}

function parseAotyProxyMarkdown(markdown) {
  const albums = [];
  const entryRegex = /\[!\[Image \d+: ([^\]]+)\]\(([^)]+)\)\]\(([^)]+)\)[\s\S]*?\[([^\]]+)\]\(([^)]+)\)\[([^\]]+)\]\(([^)]+)\)/g;

  for (const match of markdown.matchAll(entryRegex)) {
    const raw = match[1].replace(/^Image \d+: /, "");
    const separatorIndex = raw.lastIndexOf(' - ');
    const band = separatorIndex >= 0 ? clean(raw.slice(0, separatorIndex)) : clean(raw);
    const album = separatorIndex >= 0 ? clean(raw.slice(separatorIndex + 3)) : "";
    albums.push({
      band,
      album,
      image: match[2],
      link: makeFullUrl(match[3], "https://www.albumoftheyear.org"),
      source: "AOTY"
    });
    if (albums.length >= 10) break;
  }

  return albums;
}

function parseAotyAlbums(html) {
  const blocks = html.split('<div class="albumBlock five"').slice(1, 11);
  const albums = [];

  for (const block of blocks) {
    const imageMatch = block.match(/<img[^>]+src="([^"]+)"/);
    const artistMatch = block.match(/<div class="artistTitle">([\s\S]*?)<\/div>/);
    const albumMatch = block.match(/<div class="albumTitle">([\s\S]*?)<\/div>/);
    const linkMatch = block.match(/<a href="([^"]+)"[^>]*><div class="albumTitle"/);

    if (!artistMatch || !albumMatch) {
      continue;
    }

    albums.push({
      band: clean(artistMatch[1]),
      album: clean(albumMatch[1]),
      image: imageMatch ? imageMatch[1] : "",
      link: linkMatch ? makeFullUrl(linkMatch[1], "https://www.albumoftheyear.org") : "",
      source: "AOTY"
    });
  }

  return albums;
}

async function fetchImageWithFallback(url, source) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Cache-Control": "no-cache"
  };

  if (source === 'AOTY') {
    headers.Referer = 'https://www.albumoftheyear.org/';
  } else if (source === 'Bandcamp') {
    headers.Referer = 'https://daily.bandcamp.com/';
  } else if (source === 'Drunkard') {
    headers.Referer = 'https://aquariumdrunkard.com/';  } else if (source === 'RYM') {
    headers.Referer = 'https://rateyourmusic.com/';  }

  const tryFetch = async (fetchUrl, timeout = 20000) => {
    const res = await fetch(fetchUrl, {
      headers,
      signal: AbortSignal.timeout(timeout)
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());

    // Accept when content-type is an image
    if (contentType.startsWith('image/')) {
      return buf;
    }

    // Some proxies return incorrect content-type (text/plain) but still stream raw image bytes.
    // Detect common image magic numbers (jpeg, png, gif, webp) and accept those buffers.
    if (buf.length >= 4) {
      // JPEG: FF D8 FF
      if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return buf;
      // PNG: 89 50 4E 47
      if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return buf;
      // GIF: 47 49 46 38
      if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return buf;
      // WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
      if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
        const tail = buf.slice(8, 12).toString('ascii');
        if (tail === 'WEBP') return buf;
      }
    }

    throw new Error(`Unexpected content type: ${contentType}`);
  };

  try {
    return await tryFetch(url, 15000);
  } catch (err) {
    console.warn(`[${source}] Direct image fetch failed: ${err.message}`);
  }

  // More robust proxy list with better alternatives
  const proxies = [
    // Use weserv image proxy for AOTY/CDN images — returns proper image content-type.
    url => `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}&w=400`,
    // Jina AI proxy (works well for AOTY)
    url => `https://r.jina.ai/${url}`,
    // AllOrigins
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    // CodeTabs
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    // CORS Proxy
    url => `https://cors-anywhere.herokuapp.com/${url}`
  ];

  for (let i = 0; i < proxies.length; i++) {
    const makeProxyUrl = proxies[i];
    const proxyUrl = makeProxyUrl(url);
    try {
      const result = await tryFetch(proxyUrl, 20000);
      console.log(`[${source}] Image downloaded via proxy ${i + 1}: ${url}`);
      return result;
    } catch (err) {
      console.warn(`[${source}] Proxy ${i + 1} failed: ${err.message}`);
    }
  }

  throw new Error(`Failed to download image after all attempts: ${url}`);
}

async function saveRemoteImages(albums) {
  const counts = { Bandcamp: 0, AOTY: 0, RYM: 0, Drunkard: 0, other: 0 };
  const errorLog = [];
  fs.mkdirSync('images', { recursive: true });

  const results = await Promise.all(albums.map(async album => {
    if (!album.image || !album.image.startsWith('http')) return album;

    const source = album.source || 'other';
    const key = ['Bandcamp', 'AOTY', 'RYM', 'Drunkard'].includes(source) ? source : 'other';
    counts[key] += 1;
    const ext = album.image.split('.').pop().split('?')[0].replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
    const filename = `${key.toLowerCase()}_${counts[key]}.${ext}`;
    const localPath = `images/${filename}`;

    try {
      const buffer = await fetchImageWithFallback(album.image, source);
      fs.writeFileSync(localPath, buffer);
      console.log(`✓ [${source}] Downloaded: ${album.band} - image saved to ${localPath}`);
      return { ...album, image: localPath };
    } catch (e) {
      const errMsg = `✗ [${source}] Failed to download image for ${album.band}: ${e.message}`;
      console.error(errMsg);
      errorLog.push({ album: album.band, source, error: e.message });
      // Return album without image to skip broken images
      return { ...album, image: '' };
    }
  }));

  // Log any errors to a file
  if (errorLog.length > 0) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] Failed images:\n${errorLog.map(e => `  - ${e.source} ${e.album}: ${e.error}`).join('\n')}\n\n`;
    fs.appendFileSync('fetch-errors.log', logEntry);
  }

  return results;
}

async function fetchBandcampAlbums() {
  const res = await fetch(BANDCAMP_URL, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const html = await res.text();
  fs.writeFileSync("debug-bandcamp.html", html);

  const articles = html.split(/<div class="list-article\s+aotd">/).slice(1);
  const albums = [];

  for (const articleBody of articles) {
    const articleHtml = articleBody.split(/<\/div>\s*<\/div>/)[0];

    const linkMatch = articleHtml.match(/<a[^>]+class="thumb aotd-image"[^>]*href="([^"]+)"/) ||
      articleHtml.match(/<a[^>]+href="([^"]+)"[^>]*class="thumb aotd-image"/);
    const imageMatch = articleHtml.match(/<img[^>]+src="([^"]+)"/);
    const titleMatch = articleHtml.match(/<div class="title-wrapper">[\s\S]*?<a[^>]+class="title"[^>]*>([\s\S]*?)<\/a>/);

    if (!linkMatch || !titleMatch) {
      continue;
    }

    const rawTitle = clean(titleMatch[1]);
    const titleParts = rawTitle.match(/^(.*),\s*[""](.+?)[""]$/);
    const band = titleParts ? clean(titleParts[1]) : rawTitle;
    const album = titleParts ? clean(titleParts[2]) : "";

    albums.push({
      band,
      album,
      image: imageMatch ? makeFullUrl(imageMatch[1], "https://daily.bandcamp.com") : "",
      link: makeFullUrl(linkMatch[1], "https://daily.bandcamp.com"),
      source: "Bandcamp"
    });
  }

  return albums;
}

async function fetchDrunkardAlbums() {
  const maxRetries = 3;
  const timeout = 30000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(DRUNKARD_URL, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(timeout)
      });

      const html = await res.text();
      fs.writeFileSync("debug-drunkard.html", html);
      return parseDrunkardAlbums(html);
    } catch (error) {
      console.error(`Attempt ${attempt}/${maxRetries} failed for Drunkard albums:`, error.message);
      if (attempt === maxRetries) {
        console.warn("Failed to fetch Drunkard albums after retries. Returning empty array.");
        return [];
      }
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }

  return [];
}

function parseDrunkardAlbums(html) {
  const navSection = html.match(/<div class="on_the_turntable_nav">[\s\S]*?<nav>([\s\S]*?)<\/nav>[\s\S]*?<\/div>/i);

  if (!navSection) {
    return [];
  }

  const albums = [];

  for (const match of navSection[1].matchAll(/<a[^>]+data-album-name="(album__\d+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const anchorHtml = match[2];
    const title = extractFirst(anchorHtml, /title="([^"]+)"/) || extractFirst(anchorHtml, /alt="([^"]+)"/);
    const image = makeFullUrl(
      extractFirst(anchorHtml, /data-lazy-src="([^"]+)"/) || extractFirst(anchorHtml, /<img[^>]+src="([^"]+)"/),
      "https://aquariumdrunkard.com"
    );

    if (!title) {
      continue;
    }

    const { band, album } = splitDrunkardTitle(title);

    albums.push({
      band: band || clean(title),
      album: album || "",
      image,
      link: "",
      source: "Drunkard"
    });
  }

  return albums;
}

function splitDrunkardTitle(title) {
  if (!title) {
    return { band: "", album: "" };
  }

  const separator = title.match(/^(.*?)(?:\s*::\s*|\s*–\s*|\s*\/\s*)(.*)$/);

  if (!separator) {
    return { band: title, album: "" };
  }

  return {
    band: clean(separator[1]),
    album: clean(separator[2])
  };
}

function inferAlbumNameFromLinks(chunk) {
  const appleMatch = chunk.match(/https:\/\/music\.apple\.com\/[^"]*\/album\/([^/?"]+)/i);

  if (!appleMatch) {
    return "";
  }

  return slugToTitle(appleMatch[1]);
}

function slugToTitle(slug) {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[a-z]/g, (match) => match.toUpperCase())
    .trim();
}

function extractFirst(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1] : "";
}

function loadExistingAlbums() {
  try {
    const raw = fs.readFileSync("albums.json", "utf8");
    const parsed = JSON.parse(raw);
    return parsed && parsed.fetchedAt ? parsed : {};
  } catch (err) {
    return {};
  }
}

function isSameLocalDay(isoString, date) {
  const other = new Date(isoString);
  return (
    other.getFullYear() === date.getFullYear() &&
    other.getMonth() === date.getMonth() &&
    other.getDate() === date.getDate()
  );
}

function clean(text) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function makeFullUrl(url, base) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (!base) return url;
  if (url.startsWith("/")) return `${base.replace(/\/$/, "")}${url}`;
  return `${base.replace(/\/$/, "")}/${url}`;
}

module.exports = {
  fetchBandcampAlbums,
  fetchDrunkardAlbums,
  parseDrunkardAlbums,
  clean,
  makeFullUrl,
  splitDrunkardTitle,
  inferAlbumNameFromLinks,
  slugToTitle
};

if (require.main === module) {
  main();
}
