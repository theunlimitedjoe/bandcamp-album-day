#!/usr/bin/env node

const fs = require("fs");

// Helper functions copied from fetch-bandcamp.js
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

// UPDATED parser function with improved regex patterns
function parseRymAlbums(html) {
  const albums = [];
  // Split by the full itembox container to capture all data including artist
  const segments = html.split(/class="newreleases_itembox/).slice(1);

  for (const segment of segments) {
    if (albums.length >= 10) break;

    // Extract album title - look for the album link with class="album newreleases_item_title"
    const titleMatch = segment.match(/class="album newreleases_item_title"[^>]*title="([^"]*)"[^>]*>([^<]+)<\/a>/i);
    const titleText = titleMatch ? titleMatch[2] : null;
    
    // Extract artist - look for any link with class="artist"
    const artistMatch = segment.match(/class="artist"[^>]*>([^<]+)<\/a>/i);
    
    // Extract image src - look for img with class="newreleases_item_art" and src or data-src
    let imageMatch = segment.match(/<img[^>]*class="newreleases_item_art"[^>]*src="([^"]+)"/i);
    if (!imageMatch) {
      imageMatch = segment.match(/<img[^>]*class="newreleases_item_art"[^>]*data-src="([^"]+)"/i);
    }
    if (!imageMatch) {
      // Try with src before class attribute
      imageMatch = segment.match(/<img[^>]*src="([^"]+)"[^>]*class="newreleases_item_art"/i);
    }
    
    // Extract link from album title link
    const linkMatch = segment.match(/class="album newreleases_item_title"[^>]*href="([^"]+)"/i);

    if (!titleText || !artistMatch || !imageMatch) {
      console.log(`[DEBUG] Skipping segment - title: ${!!titleText}, artist: ${!!artistMatch}, image: ${!!imageMatch}`);
      continue;
    }

    albums.push({
      band: clean(artistMatch[1]),
      album: clean(titleText),
      image: makeFullUrl(imageMatch[1], "https://rateyourmusic.com"),
      link: makeFullUrl(linkMatch ? linkMatch[1] : "", "https://rateyourmusic.com"),
      source: "RYM"
    });
  }

  return albums;
}

// Try to fetch and test
(async () => {
  try {
    console.log("Fetching RYM page...");
    const RYM_URL = "https://rateyourmusic.com/new-music/";
    const res = await fetch(RYM_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/",
        "Connection": "keep-alive"
      },
      signal: AbortSignal.timeout(20000)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const html = await res.text();
    console.log(`✓ Fetched ${html.length} bytes`);
    
    // Save for debugging
    fs.writeFileSync("debug-rym.html", html);
    console.log("✓ Saved debug-rym.html");
    
    // Test parser
    const albums = parseRymAlbums(html);
    console.log(`\n✓ Parser found ${albums.length} albums\n`);
    
    if (albums.length > 0) {
      console.log("Sample albums:");
      albums.slice(0, 3).forEach((album, i) => {
        console.log(`  ${i + 1}. "${album.album}" by ${album.band}`);
        console.log(`     Image: ${album.image}`);
        console.log(`     Link: ${album.link}`);
      });
    } else {
      console.log("⚠️  No albums were parsed. Check the HTML structure in debug-rym.html");
    }
    
  } catch (error) {
    console.error("Error:", error.message);
  }
})();
