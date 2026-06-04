/* Lazily render Mermaid diagrams only on pages that contain them. */
async function renderMermaid() {
  const nodes = document.querySelectorAll('pre.mermaid');
  if (!nodes.length) return;
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    themeVariables: {
      primaryColor: '#1a2230',
      primaryTextColor: '#e7ecf3',
      primaryBorderColor: '#00add8',
      lineColor: '#5dc9e2',
      fontSize: '15px',
    },
  });
  await mermaid.run({ nodes });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderMermaid);
else renderMermaid();
