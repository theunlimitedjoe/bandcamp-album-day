const fs = require("fs");

const SOURCE_URL = "https://daily.bandcamp.com/album-of-the-day";

async function main() {
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const html = await res.text();

  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/\n+/g, "\n")
    .trim();

  const lines = text.split("\n").map(x => x.trim()).filter(Boolean);

  const albums = [];

  for (let i = 0; i < lines.length; i++) {
    const dateMatch = lines[i].match(/^[A-Z]+\s+\d{1,2},\s+\d{4}$/i);

    if (dateMatch && lines[i - 1] === "ALBUM OF THE DAY") {
      const titleLine = lines[i + 1] || "";
      const split = titleLine.match(/^(.+?),\s+[“"](.*)[”"]$/);

      if (split) {
        albums.push({
          band: split[1],
          album: split[2],
          date: lines[i],
          image: "",
          link: SOURCE_URL
        });
      }
    }
  }

  fs.writeFileSync("albums.json", JSON.stringify(albums, null, 2));
  console.log(`Saved ${albums.length} albums`);
}

main();
