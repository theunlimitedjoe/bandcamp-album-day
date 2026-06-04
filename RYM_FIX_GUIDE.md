# RYM Parser Fix - Complete Solution

## Problem
The Rate Your Music (RYM) parser was returning 0 albums despite the HTML source containing valid album data. The `albums.json` file had entries from Bandcamp (7), AOTY (10), and Drunkard (8), but no RYM albums.

## Root Cause
The `parseRymAlbums()` function was splitting the HTML by the wrong element:

**Wrong (old code):**
```javascript
const segments = html.split(/class="newreleases_item_artbox"/i).slice(1);
```

This split point only isolated the image container section. Since the album title and artist data are located in a **different section that comes AFTER** the artbox closes, the regex patterns couldn't find this data and all albums were rejected.

**HTML Structure Issue:**
```html
<div class="newreleases_itembox">              <!-- Should split HERE -->
  <div class="newreleases_item_artbox">        <!-- Old code split HERE (wrong!) -->
    <a href="..."><img src="..."></a>
  </div>
  <!-- Artist/album data is HERE, outside artbox -->
  <div class="newreleases_text_stats_container">
    <a class="album newreleases_item_title">Album Title</a>
    <span class="newreleases_item_artist">
      <a class="artist">Artist Name</a>
    </span>
  </div>
</div>
```

## Solution Applied
**Changed split point to:**
```javascript
const segments = html.split(/class="newreleases_itembox/).slice(1);
```

**Improved regex patterns:**
- **Title:** `class="album newreleases_item_title"[^>]*title="([^"]*)"[^>]*>([^<]+)<\/a>`
  - Captures exact album title from link text
- **Artist:** `class="artist"[^>]*>([^<]+)<\/a>`
  - Captures artist name from link
- **Image:** Multiple fallback patterns handling different attribute orders
  - Pattern 1: `<img[^>]*class="newreleases_item_art"[^>]*src="([^"]+)"`
  - Pattern 2: `<img[^>]*class="newreleases_item_art"[^>]*data-src="([^"]+)"`
  - Pattern 3: `<img[^>]*src="([^"]+)"[^>]*class="newreleases_item_art"`
- **Link:** `class="album newreleases_item_title"[^>]*href="([^"]+)"`

## Files Modified
- **[fetch-bandcamp.js](fetch-bandcamp.js)** - Updated `parseRymAlbums()` function (lines 138-178)

## Testing

### Option 1: Quick Validation Test
```bash
node test-fix.js
```
This will:
- Fetch the live RYM page
- Parse it with the updated function
- Display sample albums if successful
- Save debug-rym.html for inspection

### Option 2: Full Fetch (Recommended)
```bash
node fetch-bandcamp.js
```
This will:
- Fetch from all 4 sources (Bandcamp, AOTY, RYM, Drunkard)
- Parse and download images
- Generate albums.json with ~25 total albums
- Include ~10 RYM albums in the output

### Verification
After running the fetch, check:
1. **albums.json** should contain `"source": "RYM"` entries
2. **images/** folder should have RYM images (rym_1.jpg, rym_2.jpg, etc.)
3. **index.html** should display the new albums in the grid
4. Album titles and artists should be correctly extracted

## Expected Output Example
```json
{
  "band": "Boards of Canada",
  "album": "Inferno",
  "image": "images/rym_1.jpg",
  "link": "https://rateyourmusic.com/release/album/boards-of-canada/inferno/",
  "source": "RYM"
}
```

## Debugging
If the fix doesn't work:
1. Check **debug-rym.html** to inspect the actual HTML structure
2. Run `node test-fix.js` to see which albums match/don't match
3. Verify your internet connection can reach rateyourmusic.com
4. Check browser console in index.html for any frontend errors
