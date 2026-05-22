const fs = require("fs");

const SOURCE_URL = "https://daily.bandcamp.com/album-of-the-day";

async function main() {
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const html = await res.text();

  fs.writeFileSync("debug.html", html);

  const albums = [];

  const re = /ALBUM OF THE DAY[\s\S]*?·\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>\s*([^<]+),\s*[“"](.*?)[”"]/g;

  let m;
  

  while ((m = re.exec(html)) !== null) {
    albums.push({
      date: clean(m[1]),
      band: clean(m[3]),
      album: clean(m[4]),
      image: "",
      link: makeFullUrl(m[2])
    });
  }

  fs.writeFileSync("albums.json", JSON.stringify(albums, null, 2));
  console.log(`Saved ${albums.length} albums`);
}

function clean(text) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function makeFullUrl(url) {
  if (url.startsWith("http")) return url;
  return "https://daily.bandcamp.com" + url;
}

main();
