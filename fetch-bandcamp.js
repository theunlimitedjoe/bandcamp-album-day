const fs = require("fs");

const SOURCE_URL = "https://daily.bandcamp.com/album-of-the-day";

async function main() {
  const res = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const html = await res.text();

  const albums = [];
  const articleRegex = /<div class="list-article aotd">([\s\S]*?)<\/article>/g;

  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const block = match[1];

    const title =
      block.match(/<div class="title">\s*<a[^>]*>(.*?)<\/a>/s)?.[1]?.trim() ||
      block.match(/<h3[^>]*>\s*<a[^>]*>(.*?)<\/a>/s)?.[1]?.trim() ||
      "";

    const artist =
      block.match(/<div class="artist">(.*?)<\/div>/s)?.[1]?.trim() ||
      "";

    const link =
      block.match(/<a[^>]+href="([^"]+)"/s)?.[1] ||
      "";

    const image =
      block.match(/<img[^>]+src="([^"]+)"/s)?.[1] ||
      "";

    const date =
      block.match(/<time[^>]*>(.*?)<\/time>/s)?.[1]?.trim() ||
      "";

    if (title || artist || image) {
      albums.push({
        band: clean(artist),
        album: clean(title),
        date: clean(date),
        image,
        link: link.startsWith("http") ? link : `https://daily.bandcamp.com${link}`
      });
    }
  }

  fs.writeFileSync("albums.json", JSON.stringify(albums, null, 2));
  console.log(`Saved ${albums.length} albums`);
}

function clean(text) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

main();
