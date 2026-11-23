const projectId = new URLSearchParams(window.location.search).get('project');
let isNewProject = projectId === 'new';
const projectForm = document.getElementById('project-form');
const titleInput = document.getElementById('project-title');
const dateInput = document.getElementById('project-date');
const descriptionInput = document.getElementById('project-description');
const linkEditor = document.getElementById('link-editor');
const imageEditor = document.getElementById('image-editor');
const modelEditor = document.getElementById('model-editor');
const clipEditor = document.getElementById('clip-editor');
const showcaseOrderEditor = document.getElementById('showcase-order-editor');
const imageUpload = document.getElementById('image-upload');
const modelUpload = document.getElementById('model-upload');
const modelFolderUpload = document.getElementById('model-folder-upload');
const clipUpload = document.getElementById('clip-upload');
const commitButton = document.getElementById('commit-button');
const notice = document.getElementById('admin-notice');
const errorNotice = document.getElementById('editor-error');
const galleryResourcePaths = window.AdminCommon.galleryResourcePaths;
let originalProjects = [];
let originalProject = null;
let draftProject = null;
let photoUrls = new Map();
let uploads = new Map();
let objectUrls = new Map();
let projectMediaFolderName = '';
let ready = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getGalleryPictureUrl(name) {
  const picturePath = window.AdminCommon.encodePathSegments(
    `${galleryResourcePaths.pictures}/${name}`
  );
  return new URL(`../${picturePath}`, document.baseURI).href;
}

function getProjectMediaFolderName() {
  if (!projectMediaFolderName) {
    projectMediaFolderName = window.AdminCommon.projectFolderName(titleInput.value);
  }
  return projectMediaFolderName;
}

function normalizeProject(project) {
  const models = project.models || [];
  const clips = project.clips || [];
  const links = (project.links || []).map(link => {
    const platform = window.PortfolioLinkUtils.platformFor(link);
    return {
      platform,
      label: platform === 'other'
        ? String(link.label || '').trim()
        : window.PortfolioLinkUtils.labelFor(platform),
      url: String(link.url || '').trim()
    };
  });
  const showcase = Array.isArray(project.showcase)
    ? clone(project.showcase)
    : [
        ...(project.images || []).map(name => ({ type: 'image', name })),
        ...models.map(model => ({ type: 'model', src: model.src })),
        ...clips.map(clip => ({ type: clip.type, src: clip.src }))
      ];
  return { ...project, links, models, clips, showcase };
}

function syncMediaFromShowcase() {
  const modelsBySource = new Map(draftProject.models.map(model => [model.src, model]));
  const clipsBySource = new Map(draftProject.clips.map(clip => [clip.src, clip]));
  draftProject.images = draftProject.showcase
    .filter(item => item.type === 'image')
    .map(item => item.name);
  draftProject.models = draftProject.showcase
    .filter(item => item.type === 'model')
    .map(item => modelsBySource.get(item.src))
    .filter(Boolean);
  draftProject.clips = draftProject.showcase
    .filter(item => item.type === 'video' || item.type === 'gif')
    .map(item => clipsBySource.get(item.src))
    .filter(Boolean);
}

function setEditorError(message) {
  errorNotice.textContent = message;
  errorNotice.hidden = false;
}

function clearEditorError() {
  errorNotice.textContent = '';
  errorNotice.hidden = true;
}

function setNotice(message) {
  notice.textContent = message;
  notice.classList.remove('notice-error');
  notice.hidden = false;
}

function buildProjectId(title) {
  const baseId = window.AdminCommon.slugifyProjectTitle(title);
  const usedIds = new Set(originalProjects.map(project => project.id));
  let candidate = baseId;
  let suffix = 2;
  while (usedIds.has(candidate) && candidate !== originalProject?.id) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function buildCurrentProject({ forCommit = false } = {}) {
  const title = titleInput.value.trim();
  const project = {
    id: isNewProject ? buildProjectId(title) : originalProject.id,
    title,
    date: dateInput.value,
    description: descriptionInput.value.trim() || 'Not specified',
    links: draftProject.links
      .filter(link => link.label.trim() || link.url.trim())
      .map(link => {
        const platform = window.PortfolioLinkUtils.platformFor(link);
        return {
          platform,
          label: platform === 'other'
            ? link.label.trim()
            : window.PortfolioLinkUtils.labelFor(platform),
          url: link.url.trim()
        };
      }),
    models: clone(draftProject.models || []),
    images: [...draftProject.images],
    clips: clone(draftProject.clips || []),
    showcase: clone(draftProject.showcase)
  };
  if (forCommit) {
    project.updatedAt = new Date().toISOString();
  } else if (originalProject?.updatedAt) {
    project.updatedAt = originalProject.updatedAt;
  }
  return project;
}

function getProjectsForCommit() {
  const project = buildCurrentProject({ forCommit: true });
  if (isNewProject) {
    return [...originalProjects, project];
  }
  return originalProjects.map(item => item.id === originalProject.id ? project : item);
}

function hasChanges() {
  if (!ready) {
    return false;
  }

  const current = buildCurrentProject();
  if (isNewProject) {
    return Boolean(
      current.title ||
      current.date ||
      current.description !== 'Not specified' ||
      current.links.length ||
      current.images.length ||
      current.models.length ||
      current.clips.length ||
      current.showcase.length
    );
  }
  return JSON.stringify(current) !== JSON.stringify(originalProject) || uploads.size > 0;
}

function updateCommitButton() {
  commitButton.hidden = !hasChanges();
}

function renderLinks() {
  linkEditor.replaceChildren();
  if (draftProject.links.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No external links specified.';
    linkEditor.appendChild(empty);
    return;
  }

  draftProject.links.forEach((link, index) => {
    const row = document.createElement('div');
    row.className = 'link-row';

    const platform = window.PortfolioLinkUtils.platformFor(link);
    const selector = document.createElement('details');
    selector.className = 'link-platform-selector';
    const trigger = document.createElement('summary');
    trigger.className = 'link-platform-trigger';
    const platformName = document.createElement('span');
    const caret = document.createElement('span');
    caret.className = 'link-platform-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '⌄';
    const updatePlatformTrigger = selectedPlatform => {
      platformName.textContent = window.PortfolioLinkUtils.labelFor(selectedPlatform);
      trigger.setAttribute('aria-label', `Link ${index + 1} platform: ${platformName.textContent}`);
      trigger.replaceChildren(
        window.PortfolioLinkUtils.createIcon(selectedPlatform),
        platformName,
        caret
      );
    };
    updatePlatformTrigger(platform);

    const choices = document.createElement('div');
    choices.className = 'link-platform-choices';
    choices.setAttribute('role', 'group');
    choices.setAttribute('aria-label', `Platform options for link ${index + 1}`);

    const label = document.createElement('input');
    label.type = 'text';
    label.className = 'link-custom-label';
    label.placeholder = 'Website name';
    label.setAttribute('aria-label', `Link ${index + 1} website name`);
    label.value = link.label;
    label.hidden = platform !== 'other';
    label.addEventListener('input', () => {
      draftProject.links[index].label = label.value;
      clearEditorError();
      updateCommitButton();
    });

    const url = document.createElement('input');
    url.type = 'url';
    url.placeholder = 'https://…';
    url.setAttribute('aria-label', `Link ${index + 1} URL`);
    url.value = link.url;
    url.addEventListener('input', () => {
      draftProject.links[index].url = url.value;
      clearEditorError();
      updateCommitButton();
    });

    Object.entries(window.PortfolioLinkUtils.platforms).forEach(([value, definition]) => {
      const option = document.createElement('label');
      option.className = 'link-platform-choice';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `link-platform-${index}`;
      radio.value = value;
      radio.checked = value === platform;
      radio.setAttribute('aria-label', `Link ${index + 1}: ${definition.label}`);
      if (radio.checked) {
        option.classList.add('is-selected');
      }
      const name = document.createElement('span');
      name.textContent = definition.label;
      option.append(radio, window.PortfolioLinkUtils.createIcon(value), name);
      radio.addEventListener('change', () => {
        if (!radio.checked) {
          return;
        }
        const currentLink = draftProject.links[index];
        const previousPlatform = window.PortfolioLinkUtils.platformFor(currentLink);
        currentLink.platform = value;
        if (value === 'other') {
          if (previousPlatform !== 'other') {
            currentLink.label = '';
          }
        } else {
          currentLink.label = window.PortfolioLinkUtils.labelFor(value);
        }
        choices.querySelectorAll('.link-platform-choice').forEach(choice => {
          choice.classList.toggle('is-selected', choice.querySelector('input').checked);
        });
        updatePlatformTrigger(value);
        selector.open = false;
        label.value = currentLink.label;
        label.hidden = value !== 'other';
        clearEditorError();
        updateCommitButton();
      });
      choices.appendChild(option);
    });
    selector.append(trigger, choices);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button button-delete button-small';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      draftProject.links.splice(index, 1);
      renderLinks();
      updateCommitButton();
    });

    const fields = document.createElement('div');
    fields.className = 'link-fields';
    fields.append(label, url, remove);
    row.append(selector, fields);
    linkEditor.appendChild(row);
  });
}

function renderImages() {
  imageEditor.replaceChildren();
  if (draftProject.images.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No pictures in this project.';
    imageEditor.appendChild(empty);
    return;
  }

  draftProject.images.forEach(name => {
    const filenameText = name.split('/').pop();
    const card = document.createElement('article');
    card.className = 'image-card';

    const image = document.createElement('img');
    image.src = photoUrls.get(name) || '';
    image.alt = `${draftProject.title || 'Project'} — ${filenameText}`;
    image.loading = 'lazy';

    const footer = document.createElement('div');
    footer.className = 'image-card-footer';
    const filename = document.createElement('span');
    filename.className = 'image-name';
    filename.textContent = filenameText;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button button-delete button-small';
    remove.textContent = 'Remove picture';
    remove.addEventListener('click', () => {
      draftProject.images = draftProject.images.filter(item => item !== name);
      draftProject.showcase = draftProject.showcase.filter(item =>
        item.type !== 'image' || item.name !== name
      );
      const path = `${galleryResourcePaths.pictures}/${name}`;
      uploads.delete(path);
      if (objectUrls.has(path)) {
        URL.revokeObjectURL(objectUrls.get(path));
        objectUrls.delete(path);
      }
      draftProject.models.forEach(model => {
        if (model.poster === name) {
          model.poster = '';
        }
      });
      draftProject.clips.forEach(clip => {
        if (clip.poster === name) {
          clip.poster = '';
        }
      });
      renderImages();
      renderModels();
      renderClips();
      renderShowcaseOrder();
      updateCommitButton();
    });

    footer.append(filename, remove);
    card.append(image, footer);
    imageEditor.appendChild(card);
  });
}

function renderModels() {
  modelEditor.replaceChildren();
  if (draftProject.models.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No 3D models in this project.';
    modelEditor.appendChild(empty);
    return;
  }

  draftProject.models.forEach((model, index) => {
    const card = document.createElement('article');
    card.className = 'image-card model-card';

    const hasPendingGltfFiles = /\.gltf$/i.test(model.src) &&
      [model.src, ...(model.assets || [])].some(path => uploads.has(path));
    if (hasPendingGltfFiles) {
      const preview = document.createElement('div');
      preview.className = 'model-preview-placeholder';
      preview.textContent = 'glTF preview available after commit';
      card.appendChild(preview);
    } else {
      const viewer = document.createElement('model-viewer');
      viewer.className = 'admin-model-viewer';
      viewer.setAttribute('src', objectUrls.get(model.src) || `../${model.src}`);
      viewer.setAttribute('alt', `${draftProject.title || 'Project'} — 3D model ${index + 1}`);
      viewer.setAttribute('camera-controls', '');
      viewer.setAttribute('loading', 'lazy');
      viewer.setAttribute('shadow-intensity', '1');
      if (model.poster) {
        viewer.setAttribute('poster', photoUrls.get(model.poster) || getGalleryPictureUrl(model.poster));
      }
      card.appendChild(viewer);
    }

    const footer = document.createElement('div');
    footer.className = 'image-card-footer';
    const filename = document.createElement('span');
    filename.className = 'image-name';
    filename.textContent = model.src.split('/').pop();

    const posterLabel = document.createElement('label');
    posterLabel.className = 'field';
    posterLabel.textContent = 'Poster screenshot';
    const posterSelect = document.createElement('select');
    posterSelect.setAttribute('aria-label', `Poster screenshot for ${filename.textContent}`);
    posterSelect.add(new Option('No poster', ''));
    draftProject.images.forEach(name =>
      posterSelect.add(new Option(name.split('/').pop(), name))
    );
    posterSelect.value = model.poster || '';
    posterSelect.addEventListener('change', () => {
      model.poster = posterSelect.value;
      const viewer = card.querySelector('model-viewer');
      if (viewer) {
        if (model.poster) {
          viewer.setAttribute('poster', photoUrls.get(model.poster) || getGalleryPictureUrl(model.poster));
        } else {
          viewer.removeAttribute('poster');
        }
      }
      renderShowcaseOrder();
      updateCommitButton();
    });
    posterLabel.appendChild(posterSelect);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button button-delete button-small';
    remove.textContent = 'Remove model';
    remove.addEventListener('click', () => {
      draftProject.showcase = draftProject.showcase.filter(item =>
        item.type !== 'model' || item.src !== model.src
      );
      draftProject.models.splice(index, 1);
      const usedModelFiles = new Set(draftProject.models.flatMap(item => [
        item.src,
        ...(item.assets || [])
      ]));
      [...uploads.keys()]
        .filter(path => path.startsWith(`${galleryResourcePaths.models}/`) && !usedModelFiles.has(path))
        .forEach(path => {
          uploads.delete(path);
          if (objectUrls.has(path)) {
            URL.revokeObjectURL(objectUrls.get(path));
            objectUrls.delete(path);
          }
        });
      renderModels();
      renderShowcaseOrder();
      updateCommitButton();
    });

    footer.append(filename, posterLabel, remove);
    card.appendChild(footer);
    modelEditor.appendChild(card);
  });
}

function renderClips() {
  clipEditor.replaceChildren();
  if (draftProject.clips.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No videos or GIFs in this project.';
    clipEditor.appendChild(empty);
    return;
  }

  draftProject.clips.forEach((clip, index) => {
    const card = document.createElement('article');
    card.className = 'image-card clip-card';
    const src = objectUrls.get(clip.src) || `../${clip.src}`;

    if (clip.type === 'gif') {
      const preview = document.createElement('img');
      preview.className = 'admin-gif-preview';
      preview.src = src;
      preview.alt = `${draftProject.title || 'Project'} — GIF ${index + 1}`;
      preview.loading = 'lazy';
      card.appendChild(preview);
    } else {
      const preview = document.createElement('video');
      preview.className = 'admin-video-preview';
      preview.src = src;
      preview.controls = true;
      preview.muted = true;
      preview.playsInline = true;
      preview.preload = 'metadata';
      if (clip.poster) {
        preview.poster = photoUrls.get(clip.poster) || getGalleryPictureUrl(clip.poster);
      }
      card.appendChild(preview);
    }

    const footer = document.createElement('div');
    footer.className = 'image-card-footer';
    const filename = document.createElement('span');
    filename.className = 'image-name';
    filename.textContent = clip.src.split('/').pop();

    const posterLabel = document.createElement('label');
    posterLabel.className = 'field';
    posterLabel.textContent = 'Poster screenshot';
    const posterSelect = document.createElement('select');
    posterSelect.setAttribute('aria-label', `Poster screenshot for ${filename.textContent}`);
    posterSelect.add(new Option('No poster', ''));
    draftProject.images.forEach(name =>
      posterSelect.add(new Option(name.split('/').pop(), name))
    );
    posterSelect.value = clip.poster || '';
    posterSelect.addEventListener('change', () => {
      clip.poster = posterSelect.value;
      const preview = card.querySelector('video');
      if (preview) {
        if (clip.poster) {
          preview.poster = photoUrls.get(clip.poster) || getGalleryPictureUrl(clip.poster);
        } else {
          preview.removeAttribute('poster');
        }
      }
      renderShowcaseOrder();
      updateCommitButton();
    });
    posterLabel.appendChild(posterSelect);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button button-delete button-small';
    remove.textContent = 'Remove clip';
    remove.addEventListener('click', () => {
      draftProject.showcase = draftProject.showcase.filter(item =>
        (item.type !== 'video' && item.type !== 'gif') || item.src !== clip.src
      );
      draftProject.clips.splice(index, 1);
      uploads.delete(clip.src);
      if (objectUrls.has(clip.src)) {
        URL.revokeObjectURL(objectUrls.get(clip.src));
        objectUrls.delete(clip.src);
      }
      renderClips();
      renderShowcaseOrder();
      updateCommitButton();
    });

    footer.append(filename, posterLabel, remove);
    card.appendChild(footer);
    clipEditor.appendChild(card);
  });
}

function renderShowcaseOrder() {
  showcaseOrderEditor.replaceChildren();
  if (draftProject.showcase.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Add screenshots, models, videos, or GIFs to arrange the showcase.';
    showcaseOrderEditor.appendChild(empty);
    return;
  }

  draftProject.showcase.forEach((item, index) => {
    const isImage = item.type === 'image';
    const isModel = item.type === 'model';
    const isClip = item.type === 'video' || item.type === 'gif';
    const model = isModel ? draftProject.models.find(entry => entry.src === item.src) : null;
    const clip = isClip ? draftProject.clips.find(entry => entry.src === item.src) : null;
    const name = isImage
      ? item.name.split('/').pop()
      : (model?.src || clip?.src)?.split('/').pop() || (isModel ? '3D model' : 'Media clip');
    const card = document.createElement('article');
    card.className = 'showcase-order-card';

    const preview = document.createElement('div');
    preview.className = 'showcase-order-preview';
    const previewName = isImage ? item.name : model?.poster || clip?.poster;
    if (previewName && photoUrls.has(previewName)) {
      const image = document.createElement('img');
      image.src = photoUrls.get(previewName);
      image.alt = '';
      preview.appendChild(image);
    } else if (item.type === 'gif' && objectUrls.has(item.src)) {
      const image = document.createElement('img');
      image.src = objectUrls.get(item.src);
      image.alt = '';
      preview.appendChild(image);
    } else {
      preview.textContent = isImage ? 'SCREENSHOT' : isModel ? '3D MODEL' : item.type.toUpperCase();
    }
    if (!isImage) {
      const badge = document.createElement('span');
      badge.className = 'showcase-order-badge';
      badge.textContent = isModel ? '3D MODEL' : item.type.toUpperCase();
      preview.appendChild(badge);
    }

    const details = document.createElement('div');
    details.className = 'showcase-order-details';
    const type = document.createElement('span');
    type.className = 'eyebrow';
    type.textContent = isImage
      ? 'SCREENSHOT'
      : isModel
        ? 'INTERACTIVE MODEL'
        : item.type === 'gif' ? 'ANIMATED GIF' : 'VIDEO CLIP';
    const filename = document.createElement('span');
    filename.className = 'image-name';
    filename.textContent = name;
    details.append(type, filename);

    const actions = document.createElement('div');
    actions.className = 'showcase-order-actions';
    const moveUp = document.createElement('button');
    moveUp.type = 'button';
    moveUp.className = 'button button-secondary button-small';
    moveUp.textContent = '↑';
    moveUp.setAttribute('aria-label', `Move ${name} up`);
    moveUp.disabled = index === 0;
    moveUp.addEventListener('click', () => {
      [draftProject.showcase[index - 1], draftProject.showcase[index]] =
        [draftProject.showcase[index], draftProject.showcase[index - 1]];
      syncMediaFromShowcase();
      renderImages();
      renderModels();
      renderClips();
      renderShowcaseOrder();
      updateCommitButton();
    });

    const moveDown = document.createElement('button');
    moveDown.type = 'button';
    moveDown.className = 'button button-secondary button-small';
    moveDown.textContent = '↓';
    moveDown.setAttribute('aria-label', `Move ${name} down`);
    moveDown.disabled = index === draftProject.showcase.length - 1;
    moveDown.addEventListener('click', () => {
      [draftProject.showcase[index], draftProject.showcase[index + 1]] =
        [draftProject.showcase[index + 1], draftProject.showcase[index]];
      syncMediaFromShowcase();
      renderImages();
      renderModels();
      renderClips();
      renderShowcaseOrder();
      updateCommitButton();
    });

    actions.append(moveUp, moveDown);
    card.append(preview, details, actions);
    showcaseOrderEditor.appendChild(card);
  });
}

function renderProject(project) {
  titleInput.value = project.title;
  dateInput.value = project.date || '';
  descriptionInput.value = project.description === 'Not specified' ? '' : project.description;
  draftProject = clone(normalizeProject(project));
  projectMediaFolderName = draftProject.images[0]?.split('/')[0] || '';
  renderLinks();
  renderImages();
  renderModels();
  renderClips();
  renderShowcaseOrder();
}

function onProjectFieldsChange() {
  if (draftProject) {
    draftProject.title = titleInput.value;
    draftProject.date = dateInput.value;
    draftProject.description = descriptionInput.value;
  }
  clearEditorError();
  updateCommitButton();
}

function createImageFilename(file, index) {
  const prefix = window.AdminCommon.slugifyProjectTitle(titleInput.value) || 'project';
  const basename = file.name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'image';
  const extension = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  return `${prefix}-${Date.now()}-${index}-${basename}.${extension}`;
}

function createClipFilename(file, index) {
  const prefix = window.AdminCommon.slugifyProjectTitle(titleInput.value) || 'project';
  const basename = file.name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'clip';
  const extension = file.name.split('.').pop().toLowerCase();
  return `${prefix}-${Date.now()}-${index}-${basename}.${extension}`;
}

imageUpload.addEventListener('change', () => {
  clearEditorError();
  if (!titleInput.value.trim()) {
    setEditorError('Enter a project title before adding pictures.');
    imageUpload.value = '';
    return;
  }

  const files = [...imageUpload.files];
  const folderName = getProjectMediaFolderName();
  files.forEach((file, index) => {
    if (/\.gif$/i.test(file.name)) {
      setEditorError(`${file.name} is animated. Add it from the Videos & GIFs section instead.`);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setEditorError(`${file.name} is not an image.`);
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setEditorError(`${file.name} is larger than GitHub’s 100 MB file limit.`);
      return;
    }

    let name = createImageFilename(file, index);
    let relativePath = `${folderName}/${name}`;
    let suffix = 2;
    while (photoUrls.has(relativePath)) {
      name = createImageFilename(file, `${index}-${suffix}`);
      relativePath = `${folderName}/${name}`;
      suffix += 1;
    }
    const previewUrl = URL.createObjectURL(file);
    const path = `${galleryResourcePaths.pictures}/${relativePath}`;
    uploads.set(path, file);
    objectUrls.set(path, previewUrl);
    photoUrls.set(relativePath, previewUrl);
    draftProject.images.push(relativePath);
    draftProject.showcase.push({ type: 'image', name: relativePath });
  });

  imageUpload.value = '';
  renderImages();
  renderModels();
  renderClips();
  renderShowcaseOrder();
  updateCommitButton();
});

function getModelRelativePath(file, fromFolder) {
  let path = fromFolder && file.webkitRelativePath ? file.webkitRelativePath.replace(/\\/g, '/') : file.name;
  const parts = path.split('/');
  if (fromFolder && parts.length > 1) {
    parts.shift();
  }
  if (parts.length === 0 || parts.some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Could not safely read the path for ${file.name}.`);
  }
  return parts.join('/');
}

function addModelFiles(fileList, fromFolder) {
  clearEditorError();
  if (!titleInput.value.trim()) {
    setEditorError('Enter a project title before adding 3D models.');
    return;
  }

  const files = [...fileList];
  if (files.length === 0) {
    return;
  }
  if (files.some(file => file.size > 100 * 1024 * 1024)) {
    setEditorError('Each model file and dependency must be under GitHub’s 100 MB file limit.');
    return;
  }

  const modelFiles = files.filter(file => /\.(glb|gltf)$/i.test(file.name));
  if (modelFiles.length === 0) {
    setEditorError('Choose at least one .glb or .gltf model file.');
    return;
  }

  try {
    const folder = `${window.AdminCommon.slugifyProjectTitle(titleInput.value)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const projectFolder = getProjectMediaFolderName();
    const packageFiles = files.map(file => ({
      file,
      path: `${galleryResourcePaths.models}/${projectFolder}/${folder}/${getModelRelativePath(file, fromFolder)}`
    }));
    const paths = packageFiles.map(item => item.path);
    if (new Set(paths).size !== paths.length || paths.some(path => uploads.has(path))) {
      throw new Error('The selected files contain duplicate paths. Choose the glTF folder to preserve its structure.');
    }

    packageFiles.forEach(({ file, path }) => uploads.set(path, file));
    const dependencyPaths = packageFiles
      .filter(({ file }) => !/\.(glb|gltf)$/i.test(file.name))
      .map(item => item.path);
    modelFiles.forEach(file => {
      const { path } = packageFiles.find(item => item.file === file);
      const model = { src: path, assets: [path, ...dependencyPaths], poster: '' };
      draftProject.models.push(model);
      draftProject.showcase.push({ type: 'model', src: path });
      if (/\.glb$/i.test(path)) {
        objectUrls.set(path, URL.createObjectURL(file));
      }
    });
  } catch (error) {
    setEditorError(error.message);
    return;
  }

  renderModels();
  renderShowcaseOrder();
  updateCommitButton();
}

modelUpload.addEventListener('change', () => {
  addModelFiles(modelUpload.files, false);
  modelUpload.value = '';
});

modelFolderUpload.addEventListener('change', () => {
  addModelFiles(modelFolderUpload.files, true);
  modelFolderUpload.value = '';
});

clipUpload.addEventListener('change', () => {
  clearEditorError();
  if (!titleInput.value.trim()) {
    setEditorError('Enter a project title before adding videos or GIFs.');
    clipUpload.value = '';
    return;
  }

  const files = [...clipUpload.files];
  if (files.some(file => !/\.(mp4|webm|gif)$/i.test(file.name))) {
    setEditorError('Choose only .mp4, .webm, or .gif files.');
    clipUpload.value = '';
    return;
  }
  if (files.some(file => file.size > 100 * 1024 * 1024)) {
    setEditorError('Each video or GIF must be under GitHub’s 100 MB file limit.');
    clipUpload.value = '';
    return;
  }

  const folder = `${window.AdminCommon.slugifyProjectTitle(titleInput.value)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const projectFolder = getProjectMediaFolderName();
  files.forEach((file, index) => {
    const path = `${galleryResourcePaths.videos}/${projectFolder}/${folder}/${createClipFilename(file, index)}`;
    const type = /\.gif$/i.test(file.name) ? 'gif' : 'video';
    const clip = { type, src: path, poster: '' };
    uploads.set(path, file);
    objectUrls.set(path, URL.createObjectURL(file));
    draftProject.clips.push(clip);
    draftProject.showcase.push({ type, src: path });
  });

  clipUpload.value = '';
  renderClips();
  renderShowcaseOrder();
  updateCommitButton();
});

document.getElementById('add-link').addEventListener('click', () => {
  draftProject.links.push({ platform: 'other', label: '', url: '' });
  renderLinks();
  updateCommitButton();
  linkEditor.lastElementChild?.querySelector('summary')?.focus();
});

titleInput.addEventListener('input', onProjectFieldsChange);
dateInput.addEventListener('input', onProjectFieldsChange);
descriptionInput.addEventListener('input', onProjectFieldsChange);
projectForm.addEventListener('submit', event => event.preventDefault());

window.AdminCommon.setupCommitDialog(
  () => {
    const projects = getProjectsForCommit();
    const usedFiles = new Set(projects.flatMap(window.AdminCommon.projectAssetPaths));
    const deletedFiles = [...new Set(originalProjects.flatMap(window.AdminCommon.projectAssetPaths))]
      .filter(path => !usedFiles.has(path));
    const currentProject = buildCurrentProject({ forCommit: true });
    return {
      projects,
      uploads,
      deletedFiles,
      message: `${isNewProject ? 'Add' : 'Update'} portfolio project: ${currentProject.title}`,
      summary: `Commit the changes to "${currentProject.title}" with ${currentProject.images.length} screenshot(s), ${currentProject.models.length} 3D model(s), and ${currentProject.clips.length} video/GIF clip(s) to main?`
    };
  },
  (commitSha, changes, commitResult) => {
    const currentDraft = buildCurrentProject();
    const pendingPaths = new Set(commitResult.pendingUploadPaths);
    const submittedProject = changes.projects.find(item =>
      item.title.trim().toLocaleLowerCase() === currentDraft.title.trim().toLocaleLowerCase()
    );
    originalProjects = commitResult.projects;
    const savedProject = originalProjects.find(item => item.id === submittedProject?.id);
    if (!savedProject) {
      setNotice(`Changes were committed successfully (${commitSha.slice(0, 7)}). Reopen this project to refresh its saved data.`);
      return;
    }
    currentDraft.id = savedProject.id;
    originalProject = clone(savedProject);
    uploads = new Map([...changes.uploads].filter(([path]) => pendingPaths.has(path)));
    renderProject(currentDraft);
    ready = true;
    document.getElementById('page-title').textContent = savedProject.title;
    if (isNewProject) {
      history.replaceState(null, '', `edit.html?project=${encodeURIComponent(savedProject.id)}`);
      isNewProject = false;
    }
    updateCommitButton();
    const pendingMessage = pendingPaths.size
      ? ` ${pendingPaths.size} file(s) remain uncommitted in this editor; retry them or remove them before leaving.`
      : '';
    setNotice(`Changes were committed successfully (${commitSha.slice(0, 7)}).${pendingMessage} GitHub Pages will publish shortly.`);
  }
);

async function loadEditor() {
  try {
    originalProjects = (await window.AdminCommon.loadProjectCatalog())
      .map(project => ({ ...project, models: project.models || [], clips: project.clips || [] }));
    photoUrls = await window.AdminCommon.loadPhotoFiles(originalProjects);

    if (isNewProject) {
      document.title = 'Add Project — Gallery Admin';
      document.getElementById('page-title').textContent = 'Add project';
      renderProject({
        id: '',
        title: '',
        date: '',
        description: 'Not specified',
        links: [],
        images: [],
        clips: []
      });
    } else {
      const project = originalProjects.find(item => item.id === projectId);
      if (!project) {
        throw new Error('This project was not found on the main branch.');
      }
      originalProject = normalizeProject(project);
      document.title = `Edit ${originalProject.title} — Gallery Admin`;
      document.getElementById('page-title').textContent = originalProject.title;
      renderProject(originalProject);
    }

    ready = true;
    projectForm.hidden = false;
    updateCommitButton();
  } catch (error) {
    console.error('Could not load project editor:', error);
    setEditorError(`${error.message} Check the GitHub repository and try again.`);
    projectForm.hidden = true;
  }
}

window.addEventListener('beforeunload', () => {
  objectUrls.forEach(url => URL.revokeObjectURL(url));
});

loadEditor();
