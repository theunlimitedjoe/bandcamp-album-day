const fs = require("fs");

// Helper functions from fetch-bandcamp.js
function clean(str) {
  return (str || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function makeFullUrl(url, base) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return base + url;
  return base + "/" + url;
}

// Updated parser function
function parseRymAlbums(html) {
  const albums = [];
  const segments = html.split(/class="newreleases_itembox/).slice(1);

  for (const segment of segments) {
    if (albums.length >= 10) break;

    const titleMatch = segment.match(/class="album newreleases_item_title"[^>]*>([^<]+)</i);
    const artistMatch = segment.match(/class="artist"[^>]*>([^<]+)</i);
    const imageMatch = segment.match(/class="newreleases_item_art[^>]*(?:src|data-src)="([^"]+)"/i);
    const linkMatch = segment.match(/class="album newreleases_item_title"[^>]*href="([^"]+)"/i);

    if (!titleMatch || !artistMatch || !imageMatch) {
      console.log(`Skipping segment - title: ${!!titleMatch}, artist: ${!!artistMatch}, image: ${!!imageMatch}`);
      continue;
    }

    albums.push({
      band: clean(artistMatch[1]),
      album: clean(titleMatch[1]),
      image: makeFullUrl(imageMatch[1], "https://rateyourmusic.com"),
      link: makeFullUrl(linkMatch ? linkMatch[1] : "", "https://rateyourmusic.com"),
      source: "RYM"
    });
  }

  return albums;
}

// Test with the debug HTML file
try {
  const html = fs.readFileSync("debug-rym.html", "utf8");
  const albums = parseRymAlbums(html);
  console.log(`\n✓ Successfully parsed ${albums.length} albums from RYM`);
  albums.forEach((album, i) => {
    console.log(`  ${i + 1}. ${album.band} - ${album.album}`);
  });
} catch (error) {
  console.error("Error:", error.message);
}
