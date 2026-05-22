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

  const matches = [
    ...html.matchAll(/<article[\s\S]*?<\/article>/g)
  ];

  for (const match of matches) {
    const block = match[0];

    const album =
      block.match(/<h2[^>]*>(.*?)<\/h2>/s)?.[1] ||
      "";

    const artist =
      block.match(/<h3[^>]*>(.*?)<\/h3>/s)?.[1] ||
      "";

    const image =
      block.match(/<img[^>]+src="([^"]+)"/)?.[1] ||
      "";

    const link =
      block.match(/<a[^>]+href="([^"]+)"/)?.[1] ||
      "";

    if (album || artist) {
      albums.push({
        album: clean(album),
        band: clean(artist),
        image,
        link,
        date: new Date().toISOString().split("T")[0]
      });
    }
  }

  fs.writeFileSync("albums.json", JSON.stringify(albums, null, 2));

  console.log(`Saved ${albums.length} albums`);
}

function clean(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

main();
