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
    throw new Error(result?.message || `GitHub returned HTTP ${response.status}.`);
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

async function createBlob(token, content, encoding) {
  return githubRequest('/git/blobs', {
    token,
    method: 'POST',
    body: { content, encoding }
  });
}

async function commitPortfolioChanges({ projects, uploads, deletedFiles, token, message }) {
  validateProjects(projects);
  const ref = await githubRequest(`/git/ref/heads/${GITHUB_BRANCH}`, { token });
  const parentSha = ref.object.sha;
  const parentCommit = await githubRequest(`/git/commits/${parentSha}`, { token });
  const projectBlob = await createBlob(token, `${JSON.stringify(projects, null, 2)}\n`, 'utf-8');
  const treeEntries = [{
    path: PROJECTS_PATH,
    mode: '100644',
    type: 'blob',
    sha: projectBlob.sha
  }];

  const uploadedFiles = await Promise.all(
    [...uploads.entries()].map(async ([path, file]) => {
      const blob = await createBlob(token, await fileToBase64(file), 'base64');
      return {
        path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha
      };
    })
  );
  treeEntries.push(...uploadedFiles);

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
  const cancelButton = document.getElementById('cancel-commit');
  const tokenInput = document.getElementById('github-token');
  const summary = document.getElementById('commit-summary');
  const errorMessage = document.getElementById('commit-error');

  openButton.addEventListener('click', () => {
    const changes = getChanges();
    summary.textContent = changes.summary;
    errorMessage.hidden = true;
    errorMessage.textContent = '';
    tokenInput.value = '';
    dialog.showModal();
    tokenInput.focus();
  });

  cancelButton.addEventListener('click', () => {
    tokenInput.value = '';
    dialog.close();
  });
  dialog.addEventListener('close', () => {
    tokenInput.value = '';
  });

  confirmButton.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token) {
      errorMessage.textContent = 'Enter a GitHub token to confirm this commit.';
      errorMessage.hidden = false;
      tokenInput.focus();
      return;
    }

    confirmButton.disabled = true;
    confirmButton.textContent = 'Committing…';
    errorMessage.hidden = true;
    try {
      const changes = getChanges();
      const commitSha = await commitPortfolioChanges({ ...changes, token });
      tokenInput.value = '';
      dialog.close();
      onSuccess(commitSha, changes);
    } catch (error) {
      console.error('Could not commit portfolio changes:', error);
      tokenInput.value = '';
      errorMessage.textContent = `${error.message} GitHub could not confirm the update. Check the branch before retrying.`;
      errorMessage.hidden = false;
      tokenInput.focus();
    } finally {
      confirmButton.disabled = false;
      confirmButton.textContent = 'Confirm commit';
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
