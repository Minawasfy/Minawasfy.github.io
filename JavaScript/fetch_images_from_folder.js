   const GITHUB_API_URL = 'https://api.github.com/repos/Minawasfy/Minawasfy.github.io/contents/Photos'; // change this



  async function loadImages() {
    try {
      const response = await fetch(GITHUB_API_URL);
      const files = await response.json();

      const imageFiles = files.filter(file =>
        file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      );

      const gallery = document.getElementById('gallery');
      gallery.innerHTML = '';

      const row = document.createElement('div');
      row.className = 'row';

      imageFiles.forEach(file => {
        const column = document.createElement('div');
        column.className = 'column';

        const img = document.createElement('img');
        img.src = file.download_url;
        img.alt = file.name;
        img.style.width = '100%';

        column.appendChild(img);
        row.appendChild(column);
      });

      gallery.appendChild(row);

      if (imageFiles.length === 0) {
        gallery.innerHTML = '<p style="padding:20px;">No images found.</p>';
      }

    } catch (err) {
      console.error('Error loading images:', err);
      document.getElementById('gallery').innerHTML =
        '<p style="padding:20px;">Failed to load images. Check console for details.</p>';
    }
  }

  loadImages();