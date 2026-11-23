async function loadImages() {
  const gallery = document.getElementById('gallery');

  try {
    const [projects, imageUrls] = await Promise.all([
      window.portfolioProjectsPromise,
      window.fetchPortfolioImageUrls()
    ]);
    const orderedProjects = window.sortPortfolioProjectsByUpdate(projects);
    const projectImageNames = orderedProjects.flatMap(project => project.images);
    const missingImages = projectImageNames.filter(name => !imageUrls.has(name));

    if (missingImages.length > 0) {
      throw new Error(`Project images not found: ${missingImages.join(', ')}`);
    }

    gallery.replaceChildren();
    const updateGalleryRows = () => {
      const columnCount = Number.parseInt(
        getComputedStyle(gallery).getPropertyValue('--gallery-columns'),
        10
      ) || 1;
      const rowCount = Math.max(1, Math.ceil(orderedProjects.length / columnCount));
      gallery.style.setProperty('--gallery-rows', String(rowCount));
    };
    updateGalleryRows();
    window.addEventListener('resize', updateGalleryRows);

    orderedProjects.forEach(project => {
      const coverName = project.images[0];
      const figure = document.createElement('figure');
      figure.className = 'gallery-item';

      const link = document.createElement('a');
      link.href = `project.html?project=${encodeURIComponent(project.id)}`;
      link.setAttribute('aria-label', `View ${project.title}`);

      const image = document.createElement('img');
      image.src = imageUrls.get(coverName);
      image.alt = `${project.title} — project preview`;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => figure.remove(), { once: true });

      const caption = document.createElement('figcaption');
      caption.textContent = project.title;

      link.appendChild(image);
      figure.append(link, caption);
      gallery.appendChild(figure);
    });

    if (orderedProjects.length === 0) {
      const message = document.createElement('p');
      message.className = 'gallery-message';
      message.textContent = 'No projects are available right now.';
      gallery.appendChild(message);
    }
  } catch (error) {
    console.error('Error loading portfolio images:', error);
    const message = document.createElement('p');
    message.className = 'gallery-message';
    message.textContent = 'The gallery could not be loaded. Please try again later.';
    gallery.replaceChildren(message);
  }
}

loadImages();
