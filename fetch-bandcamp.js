const fs = require("fs");

const SOURCE_URL = "https://daily.bandcamp.com/album-of-the-day";

async function main() {
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const html = await res.text();
  fs.writeFileSync("debug.html", html);

  const albums = [];
  const articleRe = /<div class="list-article\s+aotd">([\s\S]*?)<div class="title-wrapper">([\s\S]*?)<\/div>\s*<\/div>/g;

  let articleMatch;
  while ((articleMatch = articleRe.exec(html)) !== null) {
    const articleHtml = articleMatch[0];

    const linkMatch = articleHtml.match(/<a[^>]+href="([^"]+)"[^>]*class="thumb aotd-image"/);
    const imageMatch = articleHtml.match(/<img[^>]+src="([^"]+)"/);
    const dateMatch = articleHtml.match(/<div class="article-info-text">[\s\S]*?·\s*([^<]+)</);
    const titleMatch = articleHtml.match(/<div class="title-wrapper">[\s\S]*?<a[^>]+class="title"[^>]*>([\s\S]*?)<\/a>/);

    if (!linkMatch || !dateMatch || !titleMatch) continue;

    const rawTitle = clean(titleMatch[1]);
    const titleParts = rawTitle.match(/^(.*?),\s*[“\"](.+?)[”\"]$/);
    const band = titleParts ? clean(titleParts[1]) : rawTitle;
    const album = titleParts ? clean(titleParts[2]) : "";

    albums.push({
      date: clean(dateMatch[1]),
      band,
      album,
      image: imageMatch ? makeFullUrl(imageMatch[1]) : "",
      link: makeFullUrl(linkMatch[1])
    });
  }

  fs.writeFileSync("albums.json", JSON.stringify(albums, null, 2));
  console.log(`Saved ${albums.length} albums`);
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
