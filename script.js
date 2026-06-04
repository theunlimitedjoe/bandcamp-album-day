async function loadAlbums() {
  const container = document.getElementById("albums");

  try {
    const res = await fetch("albums.json");
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const json = await res.json();
    const albums = Array.isArray(json) ? json : (Array.isArray(json.albums) ? json.albums : []);
    if (albums.length === 0) {
      container.textContent = "No albums available. Run `node fetch-bandcamp.js` to generate albums.json, then serve this page from a local HTTP server.";
      console.error("albums.json loaded but contains no albums", json);
      return;
    }

    const visibleAlbums = albums;

    container.innerHTML = visibleAlbums.map(album => {
      const albumName = album.album || album.band;
      const artistName = album.album ? album.band : "";
      const title = artistName ? `${albumName} by ${artistName}` : albumName;
      // Remove quotes and commas so they don't appear in external search queries
      const queryText = `${albumName} ${artistName}`.replace(/['"“”‘’,]/g, "").trim();
      const tidalSearchUrl = `https://tidal.com/search/albums?q=${encodeURIComponent(queryText)}`;
      const sourceLabel = album.source || (
        album.link?.includes('bandcamp.com') ? 'Bandcamp' :
        album.image?.includes('drunkard_') || album.image?.includes('aquariumdrunkard.com') ? 'Drunkard' :
        ''
      );
      const sourceText = sourceLabel ? `<div class="album-source">${sourceLabel}</div>` : "";

      return `
      <div class="album">
        <a href="${tidalSearchUrl}" target="_blank" rel="noopener noreferrer">
          <img src="${album.image}" alt="${title} cover">
        </a>
        <div class="album-details">
          <h2><a href="${tidalSearchUrl}" target="_blank" rel="noopener noreferrer"><span class="album-name">${albumName}</span>${artistName ? ` by <span class="artist-name">${artistName}</span>` : ""}</a></h2>
          ${sourceText}
        </div>
      </div>
    `;
    }).join("");

    console.log(`Loaded ${visibleAlbums.length} albums`);
  } catch (err) {
    container.textContent = `Failed to load albums: ${err.message}`;
    console.error(err);
  }
}

loadAlbums();
