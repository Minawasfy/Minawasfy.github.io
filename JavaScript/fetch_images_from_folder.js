   const GITHUB_API_URL = 'https://github.com/Minawasfy/Minawasfy.github.io'; // change this

    async function loadImages() {
      try {
        const response = await fetch(GITHUB_API_URL);
        const files = await response.json();

        const imageFiles = files.filter(file => {
          return file.name.match(/\.(jpg|jpeg|png|gif)$/i);
        });

        const gallery = document.getElementById('gallery');
        gallery.innerHTML = '';

        imageFiles.forEach(file => {
          const img = document.createElement('img');
          img.src = file.download_url;
          img.alt = file.name;
          gallery.appendChild(img);
        });

        if (imageFiles.length === 0) {
          gallery.innerHTML = '<p>No images found in the folder.</p>';
        }

      } catch (error) {
        console.error('Error loading images:', error);
        document.getElementById('gallery').innerHTML = '<p>Failed to load images.</p>';
      }
    }

    loadImages();