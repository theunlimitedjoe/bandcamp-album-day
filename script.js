async function loadAlbums() {
  const container = document.getElementById("albums");

  try {
    const res = await fetch("albums.json");
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const albums = await res.json();
    if (!Array.isArray(albums) || albums.length === 0) {
      container.textContent = "No albums available. Run `node fetch-bandcamp.js` to generate albums.json, then serve this page from a local HTTP server.";
      console.error("albums.json loaded but contains no albums", albums);
      return;
    }

    container.innerHTML = albums.map(album => `
      <div class="album">
        <img src="${album.image}" alt="${album.album} cover">
        <div>
          <h2>${album.album}</h2>
          <h3>${album.band}</h3>
          <p>${album.date}</p>
          <a href="${album.link}" target="_blank">Read on Bandcamp</a>
        </div>
      </div>
    `).join("");

    console.log(`Loaded ${albums.length} albums`);
  } catch (err) {
    container.textContent = `Failed to load albums: ${err.message}`;
    console.error(err);
  }
}

loadAlbums();
