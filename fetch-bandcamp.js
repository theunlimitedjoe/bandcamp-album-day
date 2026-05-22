const fs = require("fs");

const SOURCE_URL = "https://daily.bandcamp.com/album-of-the-day";

async function main() {
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const page = await res.text();
  console.log(page.slice(0, 2000));
  const albums = [];

  const re = /<div class="list-article aotd">([\s\S]*?)<div class="title-wrapper">([\s\S]*?)<\/div>/g;
  let m;

  while ((m = re.exec(page)) !== null) {
    const block = m[1] + m[2];

    const linkMatch = block.match(/href="([^"]+)"/);
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"/);
    const titleText = clean(m[2]);

    albums.push({
      band: titleText.split(",")[0] || "",
      album: titleText.split(",").slice(1).join(",").replace(/[“”"]/g, "").trim(),
      date: "",
      image: imgMatch ? imgMatch[1] : "",
      link: linkMatch ? makeFullUrl(linkMatch[1]) : SOURCE_URL
    });
  }

  fs.writeFileSync("albums.json", JSON.stringify(albums, null, 2));
  console.log(`Saved ${albums.length} albums`);
}

function clean(text) {
  return text
    .replace(/<[^>]*>/g, " ")
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
