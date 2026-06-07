import { useState } from 'react';
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

// Prism is a pure function of its input → server and client render identical
// markup, so the hydrated island matches the SSR HTML (no hydration mismatch).
const highlight = (code: string) => Prism.highlight(code, Prism.languages.go, 'go');

export default function Playground({ code, title = 'main.go' }: Props) {
  const initial = code.trim() + '\n';
  const [src, setSrc] = useState(initial);
  const [out, setOut] = useState<Out>({ text: '', kind: '' });
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

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
        style={{ fontFamily: 'var(--font-mono)', fontSize: '.86rem', lineHeight: 1.55 }}
      />
      {out.text && (
        <div className={`dp-pg__out ${out.kind === 'err' ? 'dp-pg__out--err' : out.kind === 'ok' ? 'dp-pg__out--ok' : ''}`}>
          {out.text}
        </div>
      )}
    </div>
  );
}
