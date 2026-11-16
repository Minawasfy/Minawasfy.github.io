const projectList = document.getElementById('project-list');
const projectCount = document.getElementById('project-count');
const commitButton = document.getElementById('commit-button');
const notice = document.getElementById('admin-notice');
let originalProjects = [];
let draftProjects = [];

function cloneProjects(projects) {
  return JSON.parse(JSON.stringify(projects));
}

function removedFiles(before, after) {
  const remainingFiles = new Set(after.flatMap(window.AdminCommon.projectAssetPaths));
  return [...new Set(before.flatMap(window.AdminCommon.projectAssetPaths))]
    .filter(path => !remainingFiles.has(path));
}

function projectDateLabel(date) {
  if (!date) {
    return 'Date not specified';
  }
  return new Date(`${date}T00:00:00`).toLocaleDateString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function renderProjects() {
  projectList.replaceChildren();
  projectCount.textContent = `${draftProjects.length} ${draftProjects.length === 1 ? 'project' : 'projects'}`;
  commitButton.hidden = JSON.stringify(originalProjects) === JSON.stringify(draftProjects);

  if (draftProjects.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No projects yet. Add a project to start your gallery.';
    projectList.appendChild(empty);
    return;
  }

  draftProjects.forEach(project => {
    const row = document.createElement('article');
    row.className = 'project-row';

    const details = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'project-row-title';
    const titleLink = document.createElement('a');
    titleLink.href = `edit.html?project=${encodeURIComponent(project.id)}`;
    titleLink.textContent = project.title;
    title.appendChild(titleLink);

    const metadata = document.createElement('p');
    metadata.className = 'project-row-meta';
    const date = document.createElement('span');
    date.textContent = projectDateLabel(project.date);
    const images = document.createElement('span');
    images.textContent = `${project.images.length} ${project.images.length === 1 ? 'picture' : 'pictures'}`;
    const models = document.createElement('span');
    const modelCount = project.models?.length || 0;
    models.textContent = `${modelCount} ${modelCount === 1 ? '3D model' : '3D models'}`;
    const clips = document.createElement('span');
    const clipCount = project.clips?.length || 0;
    clips.textContent = `${clipCount} ${clipCount === 1 ? 'video/GIF' : 'videos/GIFs'}`;
    metadata.append(date, images, models, clips);
    details.append(title, metadata);

    const actions = document.createElement('div');
    actions.className = 'project-row-actions';

    const edit = document.createElement('a');
    edit.className = 'button button-secondary button-small';
    edit.href = `edit.html?project=${encodeURIComponent(project.id)}`;
    edit.textContent = 'Edit';

    const remove = document.createElement('button');
    remove.className = 'button button-delete button-small';
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      if (!window.confirm(`Remove "${project.title}" and stage its unused media files for deletion?`)) {
        return;
      }
      draftProjects = draftProjects.filter(item => item.id !== project.id);
      renderProjects();
    });

    actions.append(edit, remove);
    row.append(details, actions);
    projectList.appendChild(row);
  });
}

function showNotice(message, isError = false) {
  notice.textContent = message;
  notice.classList.toggle('notice-error', isError);
  notice.hidden = false;
}

window.AdminCommon.setupCommitDialog(
  () => {
    const deletedFiles = removedFiles(originalProjects, draftProjects);
    return {
      projects: draftProjects,
      uploads: new Map(),
      deletedFiles,
      message: 'Update portfolio projects',
      summary: `Commit these ${originalProjects.length - draftProjects.length} project deletion(s) and ${deletedFiles.length} unused media file deletion(s) to main?`
    };
  },
  (commitSha) => {
    originalProjects = cloneProjects(draftProjects);
    renderProjects();
    showNotice(`Changes were committed successfully (${commitSha.slice(0, 7)}). GitHub Pages will publish shortly.`);
  }
);

async function loadDashboard() {
  try {
    originalProjects = (await window.AdminCommon.loadProjectCatalog())
      .map(project => ({ ...project, models: project.models || [], clips: project.clips || [] }));
    draftProjects = cloneProjects(originalProjects);
    renderProjects();
  } catch (error) {
    console.error('Could not load gallery admin data:', error);
    projectList.replaceChildren();
    showNotice(`${error.message} Check the GitHub repository and try again.`, true);
    projectCount.textContent = 'Could not load projects';
  }
}

loadDashboard();
