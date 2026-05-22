async function loadAlbums() {
  const res = await fetch("albums.json");
  const albums = await res.json();

  document.getElementById("albums").innerHTML = albums.map(album => `
    <div class="album">
      <img src="${album.image}" alt="">
      <div>
        <h2>${album.album}</h2>
        <h3>${album.band}</h3>
        <p>${album.date}</p>
        <a href="${album.link}" target="_blank">Read on Bandcamp</a>
      </div>
    </div>
  `).join("");
}

loadAlbums();
