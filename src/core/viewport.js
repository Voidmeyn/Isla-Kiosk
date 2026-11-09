export function initViewport() {
  const width = 1080;
  const height = 1920;
  const root = document.documentElement;

  const apply = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scale = Math.min(viewportWidth / width, viewportHeight / height);
    const x = Math.round((viewportWidth - width * scale) / 2);
    const y = Math.round((viewportHeight - height * scale) / 2);

    root.style.fontSize = '10px';
    root.style.setProperty('--stage-w', `${width}px`);
    root.style.setProperty('--stage-h', `${height}px`);
    root.style.setProperty('--stage-s', String(scale));
    root.style.setProperty('--stage-x', `${x}px`);
    root.style.setProperty('--stage-y', `${y}px`);
    root.classList.add('view-kiosk', 'is-portrait');
    root.classList.toggle('is-letterboxed', x > 4 || y > 4);
  };

  apply();
  window.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('resize', apply);
}
