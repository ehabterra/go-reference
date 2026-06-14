/* Lazily render Mermaid diagrams only on pages that contain them. */
let mermaidImport = null;

async function renderMermaid() {
  const nodes = document.querySelectorAll('pre.mermaid');
  if (!nodes.length) return;
  // Keep the source so a theme toggle can re-render from scratch. NB: must NOT
  // be `data-src` — Prism's file-highlight plugin (bundled with the playground)
  // treats any `<pre data-src>` as a file URL to fetch, which fails noisily
  // ("File does not exist or is empty") on the diagram text.
  nodes.forEach((n) => {
    if (!n.dataset.mermaidSrc) n.dataset.mermaidSrc = n.textContent;
  });
  const { default: mermaid } = await (mermaidImport ??= import('mermaid'));
  const light = document.documentElement.dataset.theme === 'light';
  mermaid.initialize({
    startOnLoad: false,
    theme: light ? 'neutral' : 'dark',
    securityLevel: 'loose',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    themeVariables: light
      ? { primaryBorderColor: '#0792b4', lineColor: '#0792b4', fontSize: '15px' }
      : {
          primaryColor: '#1a2230',
          primaryTextColor: '#e7ecf3',
          primaryBorderColor: '#00add8',
          lineColor: '#5dc9e2',
          fontSize: '15px',
        },
  });
  await mermaid.run({ nodes });
}

// theme toggled: restore each diagram's source and render in the new palette
window.addEventListener('dp:theme', () => {
  const nodes = document.querySelectorAll('pre.mermaid');
  if (!nodes.length) return;
  nodes.forEach((n) => {
    if (n.dataset.mermaidSrc) {
      n.removeAttribute('data-processed');
      n.textContent = n.dataset.mermaidSrc;
    }
  });
  renderMermaid();
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderMermaid);
else renderMermaid();
