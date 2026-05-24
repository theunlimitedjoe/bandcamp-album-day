const fs = require("fs");

const BANDCAMP_URL = "https://daily.bandcamp.com/album-of-the-day";
const DRUNKARD_URL = "https://aquariumdrunkard.com/";
const FORCE = process.argv.includes("--force") || process.argv.includes("-f");
const DAILY = process.argv.includes("--daily");

async function main() {
  const existing = loadExistingAlbums();

  if (DAILY && !FORCE && existing.fetchedAt && isSameLocalDay(existing.fetchedAt, new Date())) {
    console.log(`Already fetched today (${existing.fetchedAt}). Use --force to refresh manually.`);
    return;
  }

  const [bandcampAlbums, drunkardAlbums] = await Promise.all([
    fetchBandcampAlbums(),
    fetchDrunkardAlbums()
  ]);

  const albums = [...bandcampAlbums.slice(0, 7), ...drunkardAlbums.slice(0, 8)];

  fs.writeFileSync("albums.json", JSON.stringify({
    fetchedAt: new Date().toISOString(),
    albums
  }, null, 2));

  console.log(`Saved ${albums.length} albums (${bandcampAlbums.length} bandcamp, ${drunkardAlbums.length} aquarium drunkard).`);
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
      link: makeFullUrl(linkMatch[1], "https://daily.bandcamp.com")
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
      link: ""
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
