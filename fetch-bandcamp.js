const fs = require("fs");

const BANDCAMP_URL = "https://daily.bandcamp.com/album-of-the-day";
const AOTY_URL = "https://www.albumoftheyear.org/releases/";
const AOTY_PROXY_URL = "https://r.jina.ai/http://www.albumoftheyear.org/releases/";
const DRUNKARD_URL = "https://aquariumdrunkard.com/";
const FORCE = process.argv.includes("--force") || process.argv.includes("-f");
const DAILY = process.argv.includes("--daily");

async function main() {
  const existing = loadExistingAlbums();

  if (DAILY && !FORCE && existing.fetchedAt && isSameLocalDay(existing.fetchedAt, new Date())) {
    console.log(`Already fetched today (${existing.fetchedAt}). Use --force to refresh manually.`);
    return;
  }

  const [bandcampAlbums, aotyAlbums, drunkardAlbums] = await Promise.all([
    fetchBandcampAlbums(),
    fetchAotyAlbums(),
    fetchDrunkardAlbums()
  ]);

  // Download Aquarium Drunkard images locally and rewrite their paths
  const localDrunkardAlbums = await Promise.all(drunkardAlbums.map(async (album, i) => {
    if (!album.image || !album.image.startsWith('http')) return album;
    const ext = album.image.split('.').pop().split('?')[0].replace(/[^a-zA-Z0-9]/g, '');
    const filename = `drunkard_${i + 1}.${ext}`;
    const localPath = `images/${filename}`;
    try {
      const res = await fetch(album.image);
      if (!res.ok) throw new Error(`Failed to fetch image: ${album.image}`);
      const arrayBuffer = await res.arrayBuffer();
      fs.mkdirSync('images', { recursive: true });
      fs.writeFileSync(localPath, Buffer.from(arrayBuffer));
      return { ...album, image: localPath };
    } catch (e) {
      console.error('Image download failed', album.image, e.message);
      return album;
    }
  }));

  const albums = [...bandcampAlbums.slice(0, 7), ...aotyAlbums.slice(0, 10), ...localDrunkardAlbums.slice(0, 8)];

  fs.writeFileSync("albums.json", JSON.stringify({
    fetchedAt: new Date().toISOString(),
    albums
  }, null, 2));

  console.log(`Saved ${albums.length} albums (${bandcampAlbums.length} bandcamp, ${aotyAlbums.length} AOTY, ${drunkardAlbums.length} aquarium drunkard).`);
}

async function fetchAotyAlbums() {
  const res = await fetch(AOTY_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.google.com/",
      "Connection": "keep-alive"
    }
  });

  const html = await res.text();
  fs.writeFileSync("debug-aoty.html", html);
  const albums = parseAotyAlbums(html);
  if (albums.length > 0) {
    return albums;
  }

  console.warn("AOTY direct parse failed, falling back to proxy markdown fetch.");
  return fetchAotyAlbumsFromProxy();
}

async function fetchAotyAlbumsFromProxy() {
  const res = await fetch(AOTY_PROXY_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Accept": "text/plain, text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.google.com/",
      "Connection": "keep-alive"
    }
  });

  const text = await res.text();
  fs.writeFileSync("debug-aoty-proxy.txt", text);
  return parseAotyProxyMarkdown(text);
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
