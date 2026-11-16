const siteNewsLimit = 5;
const siteNewsData = Promise.all([
  window.portfolioProjectsPromise,
  window.fetchPortfolioImageUrls()
]);

function projectDateValue(project) {
  const timestamp = project.date ? Date.parse(`${project.date}T00:00:00Z`) : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatProjectDate(date) {
  if (!date) {
    return '';
  }
  return new Date(`${date}T00:00:00`).toLocaleDateString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function createNewsIcon() {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.8');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.setAttribute('aria-hidden', 'true');

  const bell = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  bell.setAttribute('d', 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9');
  const clapper = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  clapper.setAttribute('d', 'M10 21h4');
  icon.append(bell, clapper);
  return icon;
}

function createNewsWidget(host, widgetIndex) {
  const widget = document.createElement('div');
  widget.className = 'site-news';

  const toggle = document.createElement('button');
  toggle.className = 'site-news-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'News');
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  const panelId = `site-news-panel-${widgetIndex}`;
  toggle.setAttribute('aria-controls', panelId);
  toggle.append(createNewsIcon());

  const label = document.createElement('span');
  label.className = 'site-news-label';
  label.textContent = 'News';
  toggle.appendChild(label);

  const count = document.createElement('span');
  count.className = 'site-news-count';
  count.setAttribute('aria-hidden', 'true');
  count.hidden = true;
  toggle.appendChild(count);

  const panel = document.createElement('section');
  panel.className = 'site-news-panel';
  panel.id = panelId;
  panel.setAttribute('aria-label', 'Recent gallery releases');
  panel.setAttribute('aria-hidden', 'true');
  panel.inert = true;

  const heading = document.createElement('div');
  heading.className = 'site-news-heading';
  const titleGroup = document.createElement('div');
  const eyebrow = document.createElement('p');
  eyebrow.textContent = 'GALLERY UPDATES';
  const title = document.createElement('h2');
  title.textContent = 'Recent releases';
  titleGroup.append(eyebrow, title);

  const close = document.createElement('button');
  close.className = 'site-news-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Close news');
  close.textContent = '×';
  heading.append(titleGroup, close);

  const list = document.createElement('div');
  list.className = 'site-news-list';
  list.setAttribute('aria-live', 'polite');
  const loading = document.createElement('p');
  loading.className = 'site-news-status';
  loading.textContent = 'Loading recent releases…';
  list.appendChild(loading);
  panel.append(heading, list);
  widget.append(toggle, panel);
  host.replaceChildren(widget);

  const hoverMedia = window.matchMedia('(hover: hover) and (pointer: fine)');
  let closeTimer;
  const setOpen = isOpen => {
    window.clearTimeout(closeTimer);
    widget.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    panel.setAttribute('aria-hidden', String(!isOpen));
    panel.inert = !isOpen;
  };
  toggle.addEventListener('click', event => {
    const isOpen = widget.classList.contains('is-open');
    setOpen(hoverMedia.matches && event.detail > 0 ? true : !isOpen);
  });
  if (hoverMedia.matches) {
    widget.addEventListener('pointerenter', () => setOpen(true));
    widget.addEventListener('pointerleave', () => {
      closeTimer = window.setTimeout(() => setOpen(false), 160);
    });
  }
  widget.addEventListener('focusout', event => {
    if (!hoverMedia.matches && !widget.contains(event.relatedTarget)) {
      setOpen(false);
    }
  });
  close.addEventListener('click', () => {
    setOpen(false);
    toggle.focus();
  });
  document.addEventListener('pointerdown', event => {
    if (!widget.contains(event.target)) {
      setOpen(false);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });

  siteNewsData.then(([projects, imageUrls]) => {
    const releases = [...projects]
      .sort((left, right) => projectDateValue(right) - projectDateValue(left))
      .slice(0, siteNewsLimit);
    count.textContent = String(releases.length);
    count.hidden = releases.length === 0;
    toggle.setAttribute('aria-label', releases.length ? `News, ${releases.length} recent releases` : 'News');
    list.replaceChildren();

    if (releases.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'site-news-status';
      empty.textContent = 'No releases have been added yet.';
      list.appendChild(empty);
      return;
    }

    releases.forEach(project => {
      const item = document.createElement('a');
      item.className = 'site-news-item';
      item.href = `project.html?project=${encodeURIComponent(project.id)}`;
      item.setAttribute('aria-label', `Check out new release ${project.title}`);
      const coverName = project.images?.[0];
      const coverUrl = imageUrls.get(coverName);
      if (coverUrl) {
        const image = document.createElement('img');
        image.className = 'site-news-image';
        image.src = coverUrl;
        image.alt = project.title;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => {
          const placeholder = document.createElement('span');
          placeholder.className = 'site-news-image site-news-placeholder';
          placeholder.textContent = 'PROJECT';
          image.replaceWith(placeholder);
        }, { once: true });
        item.appendChild(image);
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'site-news-image site-news-placeholder';
        placeholder.textContent = 'PROJECT';
        item.appendChild(placeholder);
      }

      const copy = document.createElement('span');
      copy.className = 'site-news-copy';
      const message = document.createElement('span');
      message.textContent = 'Check out new release';
      const projectTitle = document.createElement('strong');
      projectTitle.textContent = project.title;
      copy.append(message, projectTitle);
      if (project.date) {
        const date = document.createElement('time');
        date.dateTime = project.date;
        date.textContent = formatProjectDate(project.date);
        copy.appendChild(date);
      }
      item.appendChild(copy);
      list.appendChild(item);
    });
  }).catch(error => {
    console.error('Could not load gallery news:', error);
    list.replaceChildren();
    const message = document.createElement('p');
    message.className = 'site-news-status';
    message.textContent = 'Recent releases could not be loaded. Please try again later.';
    list.appendChild(message);
  });
}

document.querySelectorAll('[data-site-news]').forEach((host, index) => {
  createNewsWidget(host, index + 1);
});
