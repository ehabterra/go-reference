import { useState } from 'react';

interface Props {
  code: string;
  title?: string;
}

type Out = { text: string; kind: 'ok' | 'err' | '' };

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
      <textarea
        className="dp-pg__editor"
        spellCheck={false}
        value={src}
        onChange={(e) => setSrc(e.target.value)}
        rows={Math.min(26, src.split('\n').length + 1)}
      />
      {out.text && (
        <div className={`dp-pg__out ${out.kind === 'err' ? 'dp-pg__out--err' : out.kind === 'ok' ? 'dp-pg__out--ok' : ''}`}>
          {out.text}
        </div>
      )}
    </div>
  );
}
