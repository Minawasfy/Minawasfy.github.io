window.portfolioProjectsPromise = fetch('Data/projects.json', { cache: 'no-store' }).then(response => {
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

window.fetchPortfolioImageUrls = async function () {
  const projects = await window.portfolioProjectsPromise;
  const imageNames = new Set(projects.flatMap(project => project.images));
  const picturePath = encodeURI('Gallery Resources/Pictures');
  return new Map(
    [...imageNames].map(name => [
      name,
      new URL(`${picturePath}/${encodeURIComponent(name)}`, document.baseURI).href
    ])
  );
};
