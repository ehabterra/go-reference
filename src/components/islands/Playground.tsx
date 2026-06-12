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
  // predict-the-output mode: ask for a (optional, typed) prediction before
  // the first run reveals the real output — active recall for free.
  predict?: boolean;
}

type Out = { text: string; kind: 'ok' | 'err' | '' };

const highlight = (code: string) => Prism.highlight(code, Prism.languages.go, 'go');

const editorStyle = { fontFamily: 'var(--font-mono)', fontSize: '.86rem', lineHeight: 1.55 };

// Comparison is forgiving about trailing whitespace, strict about content.
const normalize = (s: string) =>
  s.replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trimEnd();

export default function Playground({ code, title = 'main.go', predict = false }: Props) {
  const initial = code.trim() + '\n';
  const [src, setSrc] = useState(initial);
  const [out, setOut] = useState<Out>({ text: '', kind: '' });
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [predicted, setPredicted] = useState('');
  const [revealed, setRevealed] = useState(!predict);
  const [verdict, setVerdict] = useState<'hit' | 'miss' | null>(null);
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
      if (data.errors) {
        setOut({ text: data.errors, kind: 'err' });
      } else {
        setOut({ text: data.output || '(program produced no output)', kind: 'ok' });
        if (predict && !revealed && predicted.trim()) {
          setVerdict(normalize(predicted) === normalize(data.output || '') ? 'hit' : 'miss');
        }
      }
      setRevealed(true);
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
    setPredicted('');
    setVerdict(null);
    setRevealed(!predict);
  }

  const predicting = predict && !revealed;

  return (
    <div className="dp-pg">
      <div className="dp-pg__bar">
        <span className="dp-pg__title">
          {predicting ? <>🤔 {title} — predict, then run</> : <>▶ {title} — editable &amp; runnable</>}
        </span>
        <div className="dp-pg__actions">
          <button className="dp-btn dp-btn--sm dp-btn--ghost" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
          <button className="dp-btn dp-btn--sm dp-btn--ghost" onClick={reset}>Reset</button>
          <button className="dp-btn dp-btn--sm dp-btn--primary" onClick={run} disabled={running}>
            {running ? 'Running…' : predicting ? 'Reveal & run ▸' : 'Run ▸'}
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
        // Plain-text children (NOT dangerouslySetInnerHTML): the browser
        // normalizes a <pre>'s innerHTML when parsing the SSR markup, so a
        // dangerouslySetInnerHTML string no longer matches on hydration. A
        // text node round-trips cleanly; suppressHydrationWarning covers any
        // residual whitespace normalization until the editor mounts.
        <pre
          className="dp-pg__editor dp-pg__pre language-go"
          style={{ ...editorStyle, margin: 0, padding: 16 }}
          suppressHydrationWarning
        >
          {src}
        </pre>
      )}
      {predicting && (
        <div className="dp-predict">
          <p className="dp-predict__q">
            🤔 <strong>What will this print?</strong> Commit to a prediction before revealing —
            type it below for an automatic check, or just decide in your head.
          </p>
          <textarea
            className="dp-predict__ta"
            rows={3}
            placeholder="your predicted output (optional)…"
            value={predicted}
            onChange={(e) => setPredicted(e.target.value)}
            spellCheck={false}
          />
        </div>
      )}
      {out.text && (
        <div className={`dp-pg__out ${out.kind === 'err' ? 'dp-pg__out--err' : out.kind === 'ok' ? 'dp-pg__out--ok' : ''}`}>
          {out.text}
        </div>
      )}
      {verdict === 'hit' && (
        <div className="dp-predict__verdict dp-predict__verdict--hit">🎯 Exactly what you predicted.</div>
      )}
      {verdict === 'miss' && (
        <div className="dp-predict__verdict dp-predict__verdict--miss">
          <strong>Not quite.</strong> You predicted:
          <pre>{predicted}</pre>
          The gap between your guess and the real output above is the lesson — trace where they diverge.
        </div>
      )}
    </div>
  );
}
