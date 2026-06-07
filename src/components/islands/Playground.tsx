import { useState, useEffect } from 'react';
import EditorImport from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-go';

// react-simple-code-editor ships CJS; under Astro's SSR the default import can
// resolve to the module object, so unwrap a nested .default if present.
const Editor = ((EditorImport as any)?.default ?? EditorImport) as typeof EditorImport;

interface Props {
  code: string;
  title?: string;
}

type Out = { text: string; kind: 'ok' | 'err' | '' };

const highlight = (code: string) => Prism.highlight(code, Prism.languages.go, 'go');

// Plain, deterministic escaping for the pre-hydration placeholder so the SSR
// HTML and the first client render are byte-identical (no hydration mismatch).
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const editorStyle = { fontFamily: 'var(--font-mono)', fontSize: '.86rem', lineHeight: 1.55 };

export default function Playground({ code, title = 'main.go' }: Props) {
  const initial = code.trim() + '\n';
  const [src, setSrc] = useState(initial);
  const [out, setOut] = useState<Out>({ text: '', kind: '' });
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  // The highlighted <Editor> renders different markup on server vs client
  // (Prism token output isn't stable across the two environments), so we keep
  // it out of SSR entirely: render a plain placeholder until mounted, then the
  // real editor. SSR === first client render → hydration is clean.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function run() {
    setRunning(true);
    setOut({ text: 'Compiling and running on the Go Playground…', kind: '' });
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: src }),
      });
      const data = await res.json();
      if (data.errors) setOut({ text: data.errors, kind: 'err' });
      else setOut({ text: data.output || '(program produced no output)', kind: 'ok' });
    } catch {
      setOut({ text: 'Could not reach the runner. Check your connection and try again.', kind: 'err' });
    } finally {
      setRunning(false);
    }
  }

  function copy() {
    navigator.clipboard?.writeText(src);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function reset() {
    setSrc(initial);
    setOut({ text: '', kind: '' });
  }

  return (
    <div className="dp-pg">
      <div className="dp-pg__bar">
        <span className="dp-pg__title">▶ {title} — editable &amp; runnable</span>
        <div className="dp-pg__actions">
          <button className="dp-btn dp-btn--sm dp-btn--ghost" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
          <button className="dp-btn dp-btn--sm dp-btn--ghost" onClick={reset}>Reset</button>
          <button className="dp-btn dp-btn--sm dp-btn--primary" onClick={run} disabled={running}>
            {running ? 'Running…' : 'Run ▸'}
          </button>
        </div>
      </div>
      {mounted ? (
        <Editor
          value={src}
          onValueChange={setSrc}
          highlight={highlight}
          padding={16}
          tabSize={4}
          insertSpaces={false}
          textareaId={`pg-${title.replace(/\W+/g, '-')}`}
          className="dp-pg__editor language-go"
          textareaClassName="dp-pg__ta"
          preClassName="dp-pg__pre"
          style={editorStyle}
        />
      ) : (
        <pre
          className="dp-pg__editor dp-pg__pre language-go"
          style={{ ...editorStyle, margin: 0, padding: 16 }}
          dangerouslySetInnerHTML={{ __html: escapeHtml(src) }}
        />
      )}
      {out.text && (
        <div className={`dp-pg__out ${out.kind === 'err' ? 'dp-pg__out--err' : out.kind === 'ok' ? 'dp-pg__out--ok' : ''}`}>
          {out.text}
        </div>
      )}
    </div>
  );
}
