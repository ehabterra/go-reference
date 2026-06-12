/* Lazily render Mermaid diagrams only on pages that contain them. */
let mermaidImport = null;

async function renderMermaid() {
  const nodes = document.querySelectorAll('pre.mermaid');
  if (!nodes.length) return;
  // keep the source so a theme toggle can re-render from scratch
  nodes.forEach((n) => {
    if (!n.dataset.src) n.dataset.src = n.textContent;
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
    if (n.dataset.src) {
      n.removeAttribute('data-processed');
      n.textContent = n.dataset.src;
    }
  });
  renderMermaid();
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderMermaid);
else renderMermaid();
