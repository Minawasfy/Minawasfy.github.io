function showProjectMessage(message) {
  const projectMessage = document.getElementById('project-message');
  projectMessage.textContent = message;
  projectMessage.hidden = false;
}

function renderProjectLinks(links) {
  const container = document.getElementById('project-links');
  container.replaceChildren();

  if (links.length === 0) {
    const message = document.createElement('p');
    message.className = 'not-specified';
    message.textContent = 'Not specified';
    container.appendChild(message);
    return;
  }

  const list = document.createElement('ul');
  links.forEach(({ label, url, platform: savedPlatform }) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const platform = window.PortfolioLinkUtils.platformFor({ label, platform: savedPlatform });
    const linkLabel = document.createElement('span');
    linkLabel.className = 'project-link-label';
    linkLabel.textContent = platform === 'other'
      ? label
      : window.PortfolioLinkUtils.labelFor(platform);
    const externalIcon = document.createElement('span');
    externalIcon.className = 'project-link-external';
    externalIcon.setAttribute('aria-hidden', 'true');
    externalIcon.textContent = '↗';
    link.append(window.PortfolioLinkUtils.createIcon(platform), linkLabel, externalIcon);
    item.appendChild(link);
    list.appendChild(item);
  });
  container.appendChild(list);
}

function setupMotionMedia(gallery, prefersReducedMotion) {
  const media = [...gallery.querySelectorAll('[data-motion-src]')];
  if (media.length === 0) {
    return;
  }

  const startVideo = video => {
    if (prefersReducedMotion || video.dataset.inViewport !== 'true' ||
        video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA || !video.paused) {
      return;
    }
    video.play().catch(error => {
      console.warn('Automatic video playback could not start:', error);
    });
  };

  const activate = element => {
    if (!element.hasAttribute('src')) {
      if (element instanceof HTMLVideoElement) {
        element.preload = 'auto';
        element.addEventListener('canplay', () => startVideo(element), { once: true });
      }
      element.src = element.dataset.motionSrc;
      if (element instanceof HTMLVideoElement) {
        element.load();
      }
    }
    if (element instanceof HTMLVideoElement) {
      startVideo(element);
    }
  };

  const deactivate = element => {
    if (element instanceof HTMLVideoElement) {
      element.pause();
      element.removeAttribute('src');
      element.load();
    } else {
      element.removeAttribute('src');
    }
  };

  if (!('IntersectionObserver' in window)) {
    const updateVisibility = () => {
      media.forEach(element => {
        const bounds = element.getBoundingClientRect();
        const nearViewport = bounds.bottom >= -700 && bounds.top <= window.innerHeight + 700;
        if (element instanceof HTMLVideoElement) {
          element.dataset.inViewport = String(bounds.bottom > 0 && bounds.top < window.innerHeight);
        }
        if (nearViewport) {
          activate(element);
        } else {
          deactivate(element);
        }
        if (element instanceof HTMLVideoElement) {
          startVideo(element);
        }
      });
    };
    window.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility);
    updateVisibility();
    return;
  }

  const preloadObserver = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) {
        activate(target);
      } else {
        deactivate(target);
      }
    });
  }, { rootMargin: '700px 0px', threshold: 0.01 });

  const playbackObserver = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!(target instanceof HTMLVideoElement)) {
        return;
      }
      target.dataset.inViewport = String(isIntersecting);
      if (isIntersecting) {
        startVideo(target);
      } else {
        target.pause();
      }
    });
  }, { threshold: 0.1 });

  media.forEach(element => {
    preloadObserver.observe(element);
    if (element instanceof HTMLVideoElement) {
      playbackObserver.observe(element);
    }
  });
}

async function loadProject() {
  const projectId = new URLSearchParams(window.location.search).get('project');
  let projects;

  try {
    projects = await window.portfolioProjectsPromise;
  } catch (error) {
    console.error('Error loading project data:', error);
    showProjectMessage('Project information could not be loaded. Please try again later.');
    return;
  }

  const project = projects.find(item => item.id === projectId);

  if (!project) {
    document.title = 'Project Not Found — Mina Wasfy';
    document.getElementById('project-title').textContent = 'Project not found';
    showProjectMessage('This project could not be found. Browse the portfolio to choose another project.');
    return;
  }

  document.title = `${project.title} — Mina Wasfy`;
  document.getElementById('project-title').textContent = project.title;
  document.getElementById('project-description').textContent = project.description;
  renderProjectLinks(project.links);

  const date = document.getElementById('project-date');
  if (project.date) {
    date.dateTime = project.date;
    date.textContent = new Date(`${project.date}T00:00:00`).toLocaleDateString('en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  try {
    const imageUrls = await window.fetchPortfolioImageUrls();
    const missingImages = project.images.filter(name => !imageUrls.has(name));
    if (missingImages.length > 0) {
      throw new Error(`Project images not found: ${missingImages.join(', ')}`);
    }

    const models = project.models || [];
    const clips = project.clips || [];
    const showcase = Array.isArray(project.showcase)
      ? project.showcase
      : [
          ...project.images.map(name => ({ type: 'image', name })),
          ...models.map(model => ({ type: 'model', src: model.src })),
          ...clips.map(clip => ({ type: clip.type, src: clip.src }))
        ];
    const modelsBySource = new Map(models.map(model => [model.src, model]));
    const clipsBySource = new Map(clips.map(clip => [clip.src, clip]));
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gallery = document.getElementById('project-gallery');
    showcase.forEach((item, index) => {
      const figure = document.createElement('figure');
      figure.className = 'project-image';
      const caption = document.createElement('figcaption');
      const sequence = `${String(index + 1).padStart(2, '0')} / ${String(showcase.length).padStart(2, '0')}`;

      if (item.type === 'image' && imageUrls.has(item.name)) {
        const image = document.createElement('img');
        image.src = imageUrls.get(item.name);
        image.alt = `${project.title} — showcase image ${index + 1}`;
        image.loading = index === 0 ? 'eager' : 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => figure.remove(), { once: true });
        caption.textContent = sequence;
        figure.append(image, caption);
      } else if (item.type === 'model' && modelsBySource.has(item.src)) {
        const model = modelsBySource.get(item.src);
        figure.classList.add('project-model');
        const modelTitle = document.createElement('span');
        modelTitle.className = 'project-model-title';
        modelTitle.textContent = '3D MODEL VIEWER';
        modelTitle.setAttribute('aria-hidden', 'true');
        const viewer = document.createElement('model-viewer');
        viewer.className = 'project-model-viewer';
        viewer.src = model.src;
        viewer.alt = `${project.title} — interactive 3D model ${index + 1}`;
        viewer.setAttribute('camera-controls', '');
        viewer.setAttribute('loading', 'lazy');
        viewer.setAttribute('shadow-intensity', '1');
        if (model.poster && imageUrls.has(model.poster)) {
          viewer.poster = imageUrls.get(model.poster);
        }
        viewer.addEventListener('error', () => {
          showProjectMessage(`The 3D model "${model.src.split('/').pop()}" could not be loaded.`);
        }, { once: true });
        caption.textContent = `3D MODEL · ${sequence}`;
        figure.append(modelTitle, viewer, caption);
      } else if ((item.type === 'video' || item.type === 'gif') &&
          clipsBySource.has(item.src) && clipsBySource.get(item.src).type === item.type) {
        const clip = clipsBySource.get(item.src);
        figure.classList.add('project-motion');
        if (clip.type === 'video') {
          const video = document.createElement('video');
          video.className = 'project-video';
          video.dataset.motionSrc = clip.src;
          video.setAttribute('aria-label', `${project.title} — video showcase ${index + 1}`);
          video.controls = true;
          video.muted = true;
          video.defaultMuted = true;
          video.loop = true;
          video.playsInline = true;
          video.preload = 'none';
          video.dataset.inViewport = 'false';
          video.addEventListener('playing', () => video.classList.add('is-playing'));
          video.addEventListener('waiting', () => video.classList.remove('is-playing'));
          if (clip.poster && imageUrls.has(clip.poster)) {
            video.poster = imageUrls.get(clip.poster);
          }
          video.addEventListener('error', () => {
            showProjectMessage(`The video "${clip.src.split('/').pop()}" could not be loaded.`);
          }, { once: true });
          caption.textContent = `VIDEO · ${sequence}`;
          figure.append(video, caption);
        } else if (prefersReducedMotion) {
          if (clip.poster && imageUrls.has(clip.poster)) {
            const poster = document.createElement('img');
            poster.className = 'project-gif-poster';
            poster.src = imageUrls.get(clip.poster);
            poster.alt = `${project.title} — GIF poster ${index + 1}`;
            poster.loading = 'lazy';
            poster.decoding = 'async';
            figure.appendChild(poster);
          } else {
            const message = document.createElement('p');
            message.className = 'motion-reduced-message';
            message.textContent = 'Animated preview hidden because reduced motion is enabled.';
            figure.appendChild(message);
          }
          caption.textContent = `GIF · ${sequence}`;
          figure.appendChild(caption);
        } else {
          const gif = document.createElement('img');
          gif.className = 'project-gif';
          gif.dataset.motionSrc = clip.src;
          gif.alt = `${project.title} — animated GIF showcase ${index + 1}`;
          gif.loading = 'eager';
          gif.decoding = 'async';
          gif.addEventListener('error', () => {
            showProjectMessage(`The GIF "${clip.src.split('/').pop()}" could not be loaded.`);
          }, { once: true });
          caption.textContent = `GIF · ${sequence}`;
          figure.append(gif, caption);
        }
      } else {
        throw new Error(`Invalid showcase entry at position ${index + 1}.`);
      }

      gallery.appendChild(figure);
    });
    setupMotionMedia(gallery, prefersReducedMotion);
  } catch (error) {
    console.error('Error loading project images:', error);
    showProjectMessage('The project artwork could not be loaded. Please try again later.');
  }
}

loadProject();
