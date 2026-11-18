const GITHUB_OWNER = 'Minawasfy';
const GITHUB_REPOSITORY = 'Minawasfy.github.io';
const GITHUB_BRANCH = 'main';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}`;
const PROJECTS_PATH = 'Data/projects.json';

async function githubRequest(path, { token, method = 'GET', body } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers,
    cache: 'no-store',
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  let result;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    const message = result?.message || 'Unknown GitHub API error.';
    throw new Error(`${method} ${path} failed (HTTP ${response.status}): ${message}`);
  }
  return result;
}

async function loadProjectCatalog() {
  const response = await fetch(`../${PROJECTS_PATH}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load project data (${response.status}).`);
  }

  const projects = await response.json();
  if (!Array.isArray(projects)) {
    throw new Error('Project data must be a list.');
  }
  return projects;
}

async function loadPhotoFiles() {
  const files = await githubRequest(`/contents/Photos?ref=${GITHUB_BRANCH}`);
  if (!Array.isArray(files)) {
    throw new Error('GitHub returned an unsupported photo list.');
  }
  return new Map(
    files
      .filter(file => file.type === 'file' && file.name && file.download_url && /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name))
      .map(file => [file.name, file.download_url])
  );
}

function validateProjects(projects) {
  if (!Array.isArray(projects)) {
    throw new Error('Project data must be a list.');
  }

  const ids = new Set();
  const titles = new Set();
  projects.forEach((project, index) => {
    const title = project.title?.trim();
    const normalizedTitle = title?.toLocaleLowerCase();
    if (!title) {
      throw new Error(`Project ${index + 1} needs a title.`);
    }
    if (!project.id || ids.has(project.id)) {
      throw new Error(`Project ${title} has a missing or duplicate ID.`);
    }
    if (titles.has(normalizedTitle)) {
      throw new Error(`There is already a project named "${title}".`);
    }
    if (!Array.isArray(project.images) || !Array.isArray(project.links) ||
        (project.showcase !== undefined && !Array.isArray(project.showcase)) ||
        (project.models !== undefined && !Array.isArray(project.models)) ||
        (project.clips !== undefined && !Array.isArray(project.clips))) {
      throw new Error(`Project "${title}" has invalid media or showcase data.`);
    }
    if (project.images.some(name => typeof name !== 'string' || !name || name.includes('/') || name.includes('\\') || name === '.' || name === '..')) {
      throw new Error(`Project "${title}" has an invalid screenshot filename.`);
    }
    if (project.images.length === 0) {
      throw new Error(`Project "${title}" needs at least one screenshot for its gallery cover.`);
    }

    ids.add(project.id);
    titles.add(normalizedTitle);
    (project.models || []).forEach((model, modelIndex) => {
      const validModelPath = path =>
        typeof path === 'string' &&
        path.startsWith('Models/') &&
        !path.includes('\\') &&
        path.split('/').slice(1).every(part => part && part !== '.' && part !== '..');
      if (!model || !validModelPath(model.src) || !/\.(glb|gltf)$/i.test(model.src)) {
        throw new Error(`Project "${title}" has an invalid 3D model in entry ${modelIndex + 1}.`);
      }
      if (model.assets !== undefined &&
          (!Array.isArray(model.assets) || !model.assets.includes(model.src) || model.assets.some(path => !validModelPath(path)))) {
        throw new Error(`Project "${title}" has invalid model files in entry ${modelIndex + 1}.`);
      }
      if (model.poster && !project.images.includes(model.poster)) {
        throw new Error(`Project "${title}" uses a poster that is not in its screenshots.`);
      }
    });
    const clipSources = new Set();
    (project.clips || []).forEach((clip, clipIndex) => {
      const validClipPath = path =>
        typeof path === 'string' &&
        path.startsWith('Videos/') &&
        !path.includes('\\') &&
        path.split('/').slice(1).every(part => part && part !== '.' && part !== '..');
      const validType = clip?.type === 'video' || clip?.type === 'gif';
      const validExtension = clip?.type === 'gif'
        ? /\.gif$/i.test(clip.src)
        : /\.(mp4|webm)$/i.test(clip?.src || '');
      if (!clip || !validType || !validClipPath(clip.src) || !validExtension || clipSources.has(clip.src)) {
        throw new Error(`Project "${title}" has an invalid video or GIF in entry ${clipIndex + 1}.`);
      }
      if (clip.poster && !project.images.includes(clip.poster)) {
        throw new Error(`Project "${title}" uses a clip poster that is not in its screenshots.`);
      }
      clipSources.add(clip.src);
    });
    if (project.showcase !== undefined) {
      const expected = new Set([
        ...project.images.map(name => `image:${name}`),
        ...(project.models || []).map(model => `model:${model.src}`),
        ...(project.clips || []).map(clip => `clip:${clip.src}`)
      ]);
      const ordered = new Set();
      project.showcase.forEach((item, mediaIndex) => {
        const key = item?.type === 'image' && project.images.includes(item.name)
          ? `image:${item.name}`
          : item?.type === 'model' && (project.models || []).some(model => model.src === item.src)
            ? `model:${item.src}`
            : (item?.type === 'video' || item?.type === 'gif') &&
                (project.clips || []).some(clip => clip.src === item.src && clip.type === item.type)
              ? `clip:${item.src}`
              : '';
        if (!key || ordered.has(key)) {
          throw new Error(`Project "${title}" has an invalid showcase entry at position ${mediaIndex + 1}.`);
        }
        ordered.add(key);
      });
      if (ordered.size !== expected.size || [...expected].some(key => !ordered.has(key))) {
        throw new Error(`Project "${title}" showcase order must include every media item once.`);
      }
    }
    project.links.forEach((link, linkIndex) => {
      let url;
      try {
        url = new URL(link.url);
      } catch {
        throw new Error(`Project "${title}" has an invalid URL in link ${linkIndex + 1}.`);
      }
      if (!link.label?.trim() || !['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`Project "${title}" links must have a label and an HTTP or HTTPS URL.`);
      }
    });
  });
}

function projectAssetPaths(project) {
  const screenshots = (project.images || []).map(name => `Photos/${name}`);
  const models = (project.models || []).flatMap(model => [
    model.src,
    ...(Array.isArray(model.assets) ? model.assets : [])
  ]);
  const clips = (project.clips || []).map(clip => clip.src);
  return [...new Set([...screenshots, ...models, ...clips].filter(Boolean))];
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function createBlobWithProgress(token, content, encoding, onProgress) {
  const path = '/git/blobs';
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${GITHUB_API}${path}`);
    request.setRequestHeader('Accept', 'application/vnd.github+json');
    request.setRequestHeader('X-GitHub-Api-Version', '2022-11-28');
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.setRequestHeader('Content-Type', 'application/json');
    request.upload.addEventListener('progress', event => {
      if (event.lengthComputable) {
        onProgress(Math.min(99, Math.floor((event.loaded / event.total) * 100)));
      }
    });
    request.addEventListener('load', () => {
      let result;
      try {
        result = JSON.parse(request.responseText);
      } catch {
        result = null;
      }

      if (request.status < 200 || request.status >= 300) {
        const message = result?.message || 'Unknown GitHub API error.';
        reject(new Error(`POST ${path} failed (HTTP ${request.status}): ${message}`));
        return;
      }
      resolve(result);
    });
    request.addEventListener('error', () => {
      reject(new Error(`POST ${path} failed: network error while uploading.`));
    });
    request.addEventListener('abort', () => {
      reject(new Error(`POST ${path} failed: upload was canceled.`));
    });
    request.send(JSON.stringify({ content, encoding }));
  });
}

function filterProjectsForSelectedUploads(projects, stagedPaths, selectedPaths) {
  const isAvailable = path => !stagedPaths.has(path) || selectedPaths.has(path);
  return projects.map(project => {
    const images = project.images.filter(name => isAvailable(`Photos/${name}`));
    const models = (project.models || [])
      .filter(model => {
        const requiredFiles = model.assets?.length ? model.assets : [model.src];
        return requiredFiles.every(isAvailable);
      })
      .map(model => ({
        ...model,
        poster: model.poster && images.includes(model.poster) ? model.poster : ''
      }));
    const clips = (project.clips || [])
      .filter(clip => isAvailable(clip.src))
      .map(clip => ({
        ...clip,
        poster: clip.poster && images.includes(clip.poster) ? clip.poster : ''
      }));
    const modelSources = new Set(models.map(model => model.src));
    const clipSources = new Set(clips.map(clip => clip.src));
    const showcase = Array.isArray(project.showcase)
      ? project.showcase.filter(item =>
          (item.type === 'image' && images.includes(item.name)) ||
          (item.type === 'model' && modelSources.has(item.src)) ||
          ((item.type === 'video' || item.type === 'gif') && clipSources.has(item.src))
        )
      : project.showcase;

    return { ...project, images, models, clips, showcase };
  });
}

async function commitPortfolioChanges({
  projects,
  selectedPaths,
  uploadedBlobs,
  deletedFiles,
  projectBlobSha,
  token,
  message
}) {
  validateProjects(projects);
  const ref = await githubRequest(`/git/ref/heads/${GITHUB_BRANCH}`, { token });
  const parentSha = ref.object.sha;
  const parentCommit = await githubRequest(`/git/commits/${parentSha}`, { token });
  const treeEntries = [{
    path: PROJECTS_PATH,
    mode: '100644',
    type: 'blob',
    sha: projectBlobSha
  }];
  selectedPaths.forEach(path => {
    const sha = uploadedBlobs.get(path);
    if (!sha) {
      throw new Error(`The upload for "${path}" is not complete.`);
    }
    treeEntries.push({
      path,
      mode: '100644',
      type: 'blob',
      sha
    });
  });

  const usedFiles = new Set(projects.flatMap(projectAssetPaths));
  (deletedFiles || [])
    .filter(path => !usedFiles.has(path))
    .forEach(path => {
      treeEntries.push({
        path,
        mode: '100644',
        type: 'blob',
        sha: null
      });
    });

  const tree = await githubRequest('/git/trees', {
    token,
    method: 'POST',
    body: { base_tree: parentCommit.tree.sha, tree: treeEntries }
  });
  const commit = await githubRequest('/git/commits', {
    token,
    method: 'POST',
    body: {
      message,
      tree: tree.sha,
      parents: [parentSha]
    }
  });

  await githubRequest(`/git/refs/heads/${GITHUB_BRANCH}`, {
    token,
    method: 'PATCH',
    body: { sha: commit.sha, force: false }
  });
  return commit.sha;
}

function setupCommitDialog(getChanges, onSuccess) {
  const openButton = document.getElementById('commit-button');
  const dialog = document.getElementById('commit-dialog');
  const confirmButton = document.getElementById('confirm-commit');
  const startUploadButton = document.getElementById('start-upload');
  const cancelButton = document.getElementById('cancel-commit');
  const tokenInput = document.getElementById('github-token');
  const summary = document.getElementById('commit-summary');
  const errorMessage = document.getElementById('commit-error');
  const statusMessage = document.getElementById('commit-status');
  const fileList = document.getElementById('commit-file-list');
  const projectDataProgress = document.getElementById('project-data-progress');
  const projectDataPercent = document.getElementById('project-data-percent');
  const projectDataStatus = document.getElementById('project-data-status');
  const projectDataRetry = document.getElementById('project-data-retry');
  const projectDataRow = document.getElementById('project-data-row');
  let activeChanges = null;
  let uploadItems = [];
  let uploadedBlobs = new Map();
  let token = '';
  let uploadStageStarted = false;
  let isUploading = false;
  let isCommitting = false;
  let projectBlobSha = '';
  let projectBlobContent = '';

  const setProjectDataState = (state, percent, error = '') => {
    projectDataRow.classList.toggle('is-success', state === 'success');
    projectDataRow.classList.toggle('is-failed', state === 'failed');
    projectDataProgress.value = percent;
    projectDataPercent.textContent = `${percent}%`;
    projectDataStatus.textContent = state === 'success'
      ? 'Uploaded'
      : state === 'failed'
        ? 'Upload failed'
        : state === 'uploading'
          ? 'Uploading…'
          : 'Waiting';
    projectDataRetry.hidden = state !== 'failed';
    projectDataRow.querySelector('.commit-file-error')?.remove();
    if (error) {
      const detail = document.createElement('small');
      detail.className = 'commit-file-error';
      detail.textContent = error;
      projectDataRow.querySelector('.commit-file-info').appendChild(detail);
    }
  };

  const renderButtons = () => {
    startUploadButton.disabled = isUploading || isCommitting;
    confirmButton.hidden = !uploadStageStarted;
    confirmButton.disabled = isUploading || isCommitting || !uploadItems.every(item =>
      !item.checkbox.checked || item.state === 'success'
    );
    confirmButton.textContent = isCommitting ? 'Committing…' : 'Commit selected uploads';
    uploadItems.forEach(item => {
      item.checkbox.disabled = isUploading || isCommitting;
      item.retry.disabled = !uploadStageStarted || isUploading || isCommitting || !item.checkbox.checked;
    });
    projectDataRetry.disabled = isUploading || isCommitting;
    cancelButton.disabled = isUploading || isCommitting;
    tokenInput.disabled = uploadStageStarted || isCommitting;
  };

  const setItemState = (item, state, percent = 0, error = '') => {
    item.state = state;
    item.row.classList.toggle('is-success', state === 'success');
    item.row.classList.toggle('is-failed', state === 'failed');
    item.progress.value = percent;
    item.percent.textContent = `${percent}%`;
    item.status.textContent = state === 'success'
      ? (item.checkbox.checked ? 'Uploaded' : 'Uploaded · excluded')
      : state === 'failed'
        ? 'Upload failed'
        : state === 'uploading'
          ? 'Uploading…'
          : state === 'skipped'
            ? 'Not uploaded'
            : 'Waiting';
    item.retry.hidden = false;
    item.error.textContent = error;
    item.error.hidden = !error;
  };

  const createUploadItem = (path, file) => {
    const row = document.createElement('article');
    row.className = 'commit-file-row';
    const info = document.createElement('div');
    info.className = 'commit-file-info';

    const heading = document.createElement('div');
    heading.className = 'commit-file-heading';
    const filename = document.createElement('strong');
    filename.textContent = path.split('/').pop();
    const state = document.createElement('span');
    state.className = 'commit-file-state';
    state.textContent = 'Waiting';
    heading.append(filename, state);

    const pathLabel = document.createElement('small');
    pathLabel.textContent = `${path} · ${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    const controls = document.createElement('div');
    controls.className = 'commit-file-controls';
    const includeLabel = document.createElement('label');
    includeLabel.className = 'commit-include';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.setAttribute('aria-label', `Include ${path} in the commit`);
    const includeText = document.createElement('span');
    includeText.textContent = 'Include in commit';
    includeLabel.append(checkbox, includeText);

    const retry = document.createElement('button');
    retry.className = 'button button-secondary button-small commit-retry';
    retry.type = 'button';
    retry.textContent = '↻';
    retry.title = `Retry upload of ${path}`;
    retry.setAttribute('aria-label', `Retry upload of ${path}`);
    retry.hidden = false;
    controls.append(includeLabel, retry);

    const progressLine = document.createElement('div');
    progressLine.className = 'commit-progress-line';
    const progress = document.createElement('progress');
    progress.max = 100;
    progress.value = 0;
    progress.setAttribute('aria-label', `Upload progress for ${path}`);
    const percent = document.createElement('span');
    percent.className = 'commit-progress-percent';
    percent.textContent = '0%';
    const spacer = document.createElement('span');
    progressLine.append(progress, percent, spacer);

    const error = document.createElement('small');
    error.className = 'commit-file-error';
    error.hidden = true;
    info.append(heading, pathLabel, controls, progressLine, error);
    row.appendChild(info);
    fileList.appendChild(row);

    const item = { path, file, row, checkbox, retry, progress, percent, status: state, error, state: 'pending', sha: '' };
    checkbox.addEventListener('change', () => {
      if (item.state === 'success') {
        item.status.textContent = checkbox.checked ? 'Uploaded' : 'Uploaded · excluded';
      } else if (item.state === 'failed') {
        item.status.textContent = checkbox.checked ? 'Upload failed' : 'Failed · excluded';
      } else if (item.state === 'skipped' && checkbox.checked) {
        setItemState(item, 'pending');
      }
      projectBlobSha = '';
      setProjectDataState('waiting', 0);
      renderButtons();
    });
    retry.addEventListener('click', () => uploadItem(item));
    return item;
  };

  const uploadItem = async (item, isQueued = false) => {
    if ((isUploading && !isQueued) || isCommitting || !token || !item.checkbox.checked) {
      return;
    }
    if (!isQueued) {
      isUploading = true;
    }
    setItemState(item, 'uploading');
    statusMessage.textContent = `Preparing ${item.path}…`;
    renderButtons();
    try {
      const content = await fileToBase64(item.file);
      const result = await createBlobWithProgress(token, content, 'base64', percent => {
        item.progress.value = percent;
        item.percent.textContent = `${percent}%`;
      });
      item.sha = result.sha;
      uploadedBlobs.set(item.path, result.sha);
      setItemState(item, 'success', 100);
    } catch (error) {
      item.sha = '';
      uploadedBlobs.delete(item.path);
      setItemState(item, 'failed', item.progress.value, error.message);
    } finally {
      if (!isQueued) {
        isUploading = false;
      }
      statusMessage.textContent = uploadItems.some(upload => upload.state === 'failed' && upload.checkbox.checked)
        ? 'Some uploads failed. Retry them, or uncheck them to exclude them from this commit.'
        : 'Upload finished. Review which files to include, then commit.';
      renderButtons();
    }
  };

  const uploadSelectedFiles = async () => {
    if (!activeChanges || isUploading || isCommitting) {
      return;
    }
    if (!tokenInput.value.trim()) {
      errorMessage.textContent = 'Enter a GitHub token to upload and commit these changes.';
      errorMessage.hidden = false;
      tokenInput.focus();
      return;
    }
    token = tokenInput.value.trim();
    errorMessage.hidden = true;
    if (uploadItems.length === 0) {
      await finishCommit();
      return;
    }

    uploadStageStarted = true;
    isUploading = true;
    renderButtons();

    for (const item of uploadItems) {
      if (!item.checkbox.checked) {
        setItemState(item, 'skipped');
        continue;
      }
      await uploadItem(item, true);
    }
    isUploading = false;
    startUploadButton.hidden = true;
    statusMessage.textContent = uploadItems.some(item => item.state === 'failed' && item.checkbox.checked)
      ? 'Some uploads failed. Retry them, or uncheck them to exclude them from this commit.'
      : 'Upload finished. Review which files to include, then commit.';
    renderButtons();
  };

  const getSelectedProjects = () => {
    const selectedPaths = new Set(uploadItems
      .filter(item => item.checkbox.checked && item.state === 'success')
      .map(item => item.path));
    const stagedPaths = new Set(uploadItems.map(item => item.path));
    return { selectedPaths, projects: filterProjectsForSelectedUploads(activeChanges.projects, stagedPaths, selectedPaths) };
  };

  const finishCommit = async () => {
    if (!activeChanges || isUploading || isCommitting ||
        uploadItems.some(item => item.checkbox.checked && item.state !== 'success')) {
      return;
    }
    const { selectedPaths, projects } = getSelectedProjects();
    const stagedPaths = new Set(uploadItems.map(item => item.path));
    const selectedUploads = new Map(uploadItems
      .filter(item => selectedPaths.has(item.path))
      .map(item => [item.path, item.sha]));
    const data = `${JSON.stringify(projects, null, 2)}\n`;
    if (data !== projectBlobContent) {
      projectBlobContent = data;
      projectBlobSha = '';
      setProjectDataState('waiting', 0);
    }

    isCommitting = true;
    errorMessage.hidden = true;
    statusMessage.textContent = 'Preparing project data…';
    setProjectDataState(projectBlobSha ? 'success' : 'uploading', projectBlobSha ? 100 : 0);
    renderButtons();
    try {
      validateProjects(projects);
      if (!projectBlobSha) {
        const projectBlob = await createBlobWithProgress(token, projectBlobContent, 'utf-8', percent => {
          projectDataProgress.value = percent;
          projectDataPercent.textContent = `${percent}%`;
        });
        projectBlobSha = projectBlob.sha;
        setProjectDataState('success', 100);
      }
      statusMessage.textContent = 'Creating the GitHub commit…';
      const commitSha = await commitPortfolioChanges({
        projects,
        selectedPaths,
        uploadedBlobs: selectedUploads,
        deletedFiles: activeChanges.deletedFiles,
        projectBlobSha,
        token,
        message: activeChanges.message
      });
      const result = {
        projects,
        committedUploadPaths: [...selectedPaths],
        pendingUploadPaths: [...stagedPaths].filter(path => !selectedPaths.has(path))
      };
      tokenInput.value = '';
      dialog.close();
      onSuccess(commitSha, activeChanges, result);
      activeChanges = null;
      uploadItems = [];
      uploadedBlobs = new Map();
      token = '';
    } catch (error) {
      console.error('Could not commit portfolio changes:', error);
      if (!projectBlobSha) {
        if (error.message.includes('POST /git/blobs failed')) {
          setProjectDataState('failed', projectDataProgress.value, error.message);
        } else {
          setProjectDataState('waiting', 0);
        }
      }
      errorMessage.textContent = `${error.message} GitHub could not confirm the update. Check the branch before retrying.`;
      errorMessage.hidden = false;
      statusMessage.textContent = 'The commit did not finish. You can retry without re-uploading completed files.';
    } finally {
      isCommitting = false;
      renderButtons();
    }
  };

  projectDataRetry.addEventListener('click', finishCommit);
  startUploadButton.addEventListener('click', uploadSelectedFiles);
  confirmButton.addEventListener('click', finishCommit);
  openButton.addEventListener('click', () => {
    activeChanges = getChanges();
    uploadItems = [];
    uploadedBlobs = new Map();
    token = '';
    uploadStageStarted = false;
    projectBlobSha = '';
    projectBlobContent = '';
    fileList.replaceChildren();
    activeChanges.uploads.forEach((file, path) => {
      uploadItems.push(createUploadItem(path, file));
    });
    if (uploadItems.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'No new media files to upload. Existing project media will not be uploaded again.';
      fileList.appendChild(emptyState);
    }
    const deletionList = activeChanges.deletedFiles || [];
    deletionList.forEach(path => {
      const row = document.createElement('div');
      row.className = 'commit-file-row commit-file-deletion';
      row.textContent = `Remove ${path}`;
      fileList.appendChild(row);
    });
    summary.textContent = uploadItems.length
      ? `${activeChanges.summary} ${uploadItems.length} file(s) are ready to upload.`
      : activeChanges.summary;
    startUploadButton.hidden = false;
    startUploadButton.textContent = uploadItems.length ? 'Upload files' : 'Commit changes';
    tokenInput.disabled = false;
    projectDataStatus.textContent = 'Waiting';
    statusMessage.textContent = uploadItems.length
      ? 'Choose which files to include, enter your token, then start uploading.'
      : 'Enter your token and commit the project data. No new media files need uploading.';
    errorMessage.hidden = true;
    errorMessage.textContent = '';
    tokenInput.value = '';
    projectBlobSha = '';
    projectBlobContent = '';
    setProjectDataState('waiting', 0);
    dialog.showModal();
    tokenInput.focus();
    renderButtons();
  });

  cancelButton.addEventListener('click', () => {
    if (isUploading || isCommitting) {
      return;
    }
    tokenInput.value = '';
    dialog.close();
  });
  dialog.addEventListener('cancel', event => {
    if (isUploading || isCommitting) {
      event.preventDefault();
    }
  });
  dialog.addEventListener('close', () => {
    tokenInput.value = '';
    if (!isCommitting) {
      activeChanges = null;
      uploadItems = [];
      uploadedBlobs = new Map();
      token = '';
    }
  });
}

window.AdminCommon = {
  GITHUB_BRANCH,
  loadProjectCatalog,
  loadPhotoFiles,
  projectAssetPaths,
  slugifyProjectTitle(title) {
    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'new-project';
  },
  setupCommitDialog
};
