const fs = require("fs");

const SOURCE_URL = "https://daily.bandcamp.com/album-of-the-day";
const FORCE = process.argv.includes("--force") || process.argv.includes("-f");
const DAILY = process.argv.includes("--daily");

async function main() {
  const existing = loadExistingAlbums();

  if (DAILY && !FORCE && existing.fetchedAt && isSameLocalDay(existing.fetchedAt, new Date())) {
    console.log(`Already fetched today (${existing.fetchedAt}). Use --force to refresh manually.`);
    return;
  }

  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const html = await res.text();
  fs.writeFileSync("debug.html", html);

  const articles = html.split(/<div class="list-article\s+aotd">/).slice(1);
  const albums = [];

  console.log(`Found ${articles.length} article blocks`);

  for (const articleBody of articles) {
    const articleHtml = articleBody.split(/<\/div>\s*<\/div>/)[0];

    const linkMatch = articleHtml.match(/<a[^>]+class="thumb aotd-image"[^>]*href="([^"]+)"/) ||
      articleHtml.match(/<a[^>]+href="([^"]+)"[^>]*class="thumb aotd-image"/);
    const imageMatch = articleHtml.match(/<img[^>]+src="([^"]+)"/);
    const titleMatch = articleHtml.match(/<div class="title-wrapper">[\s\S]*?<a[^>]+class="title"[^>]*>([\s\S]*?)<\/a>/);

    if (!linkMatch || !titleMatch) {
      console.error("Skipping article because required fields were missing", {
        link: !!linkMatch,
        title: !!titleMatch,
        snippet: articleHtml.slice(0, 200)
      });
      continue;
    }

    const rawTitle = clean(titleMatch[1]);
    const titleParts = rawTitle.match(/^(.*),\s*[“\"](.+?)[”\"]$/);
    const band = titleParts ? clean(titleParts[1]) : rawTitle;
    const album = titleParts ? clean(titleParts[2]) : "";

    albums.push({
      band,
      album,
      image: imageMatch ? makeFullUrl(imageMatch[1]) : "",
      link: makeFullUrl(linkMatch[1])
    });
  }

  const visibleAlbums = albums.slice(0, 7);
  fs.writeFileSync("albums.json", JSON.stringify({
    fetchedAt: new Date().toISOString(),
    albums: visibleAlbums
  }, null, 2));
  console.log(`Saved ${visibleAlbums.length} albums`);
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

function makeFullUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return "https://daily.bandcamp.com" + url;
}

main();
