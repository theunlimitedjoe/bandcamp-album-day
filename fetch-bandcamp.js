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
    const titleParts = rawTitle.match(/^(.*),\s*[“\"](.+?)[”\"]$/);
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
  const res = await fetch(DRUNKARD_URL, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const html = await res.text();
  fs.writeFileSync("debug-drunkard.html", html);

  const albums = [];
  const chunkRegex = /data-album-name=("|')album__\d+\1[\s\S]*?data-album-title=("|')([^"']+)\2[\s\S]*?data-album-artist=("|')([^"']+)\4[\s\S]*?(?:data-album-cover=("|')([^"']+)\6|<img[^>]+src=("|')([^"']+)\8)[\s\S]*?(?:data-album-url=("|')([^"']+)\10|href=("|')([^"']+)\12)/g;
  let match;

  while ((match = chunkRegex.exec(html))) {
    const title = clean(match[3]);
    const artist = clean(match[5]);
    const image = makeFullUrl(match[7] || match[9] || "", "https://aquariumdrunkard.com");
    const link = makeFullUrl(match[11] || match[13] || "", "https://aquariumdrunkard.com");

    if (!title || !artist || !link) {
      continue;
    }

    albums.push({
      band: artist,
      album: title,
      image,
      link
    });
  }

  return albums;
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

main();
