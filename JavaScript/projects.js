const portfolioAssetVersion = '20261123-masonry';

window.portfolioAssetVersion = portfolioAssetVersion;
window.portfolioProjectsPromise = fetch(`Data/projects.json?v=${portfolioAssetVersion}`, { cache: 'no-store' }).then(response => {
  if (!response.ok) {
    throw new Error(`Could not load projects (${response.status}).`);
  }
  return response.json();
}).then(projects => {
  if (!Array.isArray(projects)) {
    throw new Error('Project data must be a list.');
  }
  return projects;
});

window.sortPortfolioProjectsByUpdate = function (projects) {
  return projects
    .map((project, index) => ({
      project,
      index,
      timestamp: project.updatedAt
        ? Date.parse(project.updatedAt)
        : project.date
          ? Date.parse(`${project.date}T00:00:00Z`)
          : 0
    }))
    .sort((left, right) => {
      const leftTime = Number.isNaN(left.timestamp) ? 0 : left.timestamp;
      const rightTime = Number.isNaN(right.timestamp) ? 0 : right.timestamp;
      return rightTime - leftTime || left.index - right.index;
    })
    .map(entry => entry.project);
};

window.fetchPortfolioImageUrls = async function () {
  const projects = await window.portfolioProjectsPromise;
  const imageNames = new Set(projects.flatMap(project => project.images));
  const encodePath = path => path.split('/').map(segment => encodeURIComponent(segment)).join('/');
  return new Map(
    [...imageNames].map(name => [
      name,
      new URL(encodePath(`Gallery Resources/Pictures/${name}`), document.baseURI).href
    ])
  );
};
