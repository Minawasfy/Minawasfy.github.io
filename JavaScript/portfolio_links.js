(() => {
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const platforms = {
    artstation: {
      label: 'ArtStation',
      paths: [
        {
          d: 'M0 17.72L2.34 21.70L2.91 22.17L3.56 22.45L17.58 22.50L14.81 17.72Z',
          fill: '#00B0F2',
          stroke: 'none'
        },
        {
          d: 'M7.41 4.88L2.02 14.25L12.80 14.25Z',
          fill: '#00B0F2',
          stroke: 'none'
        },
        {
          d: 'M9.42 1.45L21.56 22.45L23.86 18.47L23.95 18.09L23.91 17.16L23.58 16.41L15.80 2.86L15.05 1.92L14.20 1.50Z',
          fill: '#00B0F2',
          stroke: 'none'
        }
      ]
    },
    sketchfab: {
      label: 'Sketchfab',
      paths: [
        { d: 'm12 2.75 8 4.5v9.5l-8 4.5-8-4.5v-9.5l8-4.5Z' },
        { d: 'm4 7.25 8 4.5 8-4.5M12 11.75v9.5M8 5l8 4' }
      ]
    },
    itchio: {
      label: 'itch.io',
      paths: [
        { d: 'M7.5 7h9a4 4 0 0 1 3.8 2.8l1 3.3a3 3 0 0 1-4.8 3.2l-1.6-1.3H9.1l-1.6 1.3a3 3 0 0 1-4.8-3.2l1-3.3A4 4 0 0 1 7.5 7Z' },
        { d: 'M8 10v4M6 12h4M16.5 11.5h.01M18.5 13.5h.01' }
      ]
    },
    other: {
      label: 'Other website',
      paths: [
        { d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z' },
        { d: 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18' }
      ]
    }
  };

  function platformFor(link) {
    if (Object.prototype.hasOwnProperty.call(platforms, link?.platform)) {
      return link.platform;
    }
    const label = String(link?.label || '').trim().toLowerCase().replace(/[\s.]/g, '');
    if (label === 'artstation') {
      return 'artstation';
    }
    if (label === 'sketchfab') {
      return 'sketchfab';
    }
    if (label === 'itchio') {
      return 'itchio';
    }
    return 'other';
  }

  function labelFor(platform) {
    return platforms[Object.prototype.hasOwnProperty.call(platforms, platform) ? platform : 'other'].label;
  }

  function createIcon(platform) {
    const selectedPlatform = platformFor({ platform });
    const icon = document.createElementNS(svgNamespace, 'svg');
    icon.setAttribute('class', 'portfolio-link-icon project-link-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.7');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');

    platforms[selectedPlatform].paths.forEach(attributes => {
      const path = document.createElementNS(svgNamespace, 'path');
      Object.entries(attributes).forEach(([name, value]) => path.setAttribute(name, value));
      icon.appendChild(path);
    });
    return icon;
  }

  window.PortfolioLinkUtils = { platforms, platformFor, labelFor, createIcon };
})();
