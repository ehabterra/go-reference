import { useState, useRef } from 'react';

interface Props {
  code: string;
  title?: string;
}

type Out = { text: string; kind: 'ok' | 'err' | '' };

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// A small, dependency-free Go syntax highlighter. Tokenizes the RAW source
// left-to-right (comments & strings win first, so keywords inside them aren't
// re-colored), escaping each piece as it's emitted.
const GO_TOKENS = new RegExp(
  [
    '(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)', // 1 comment
    '(`[^`]*`|"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\')', // 2 string/char/raw
    '\\b(break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var)\\b', // 3 keyword
    '\\b(true|false|nil|iota)\\b', // 4 constant
    '\\b(string|bool|byte|rune|error|any|u?int(?:8|16|32|64)?|uintptr|float32|float64|complex64|complex128)\\b', // 5 type
    '\\b(0x[0-9a-fA-F]+|\\d[\\d_]*(?:\\.[\\d_]+)?(?:e[+-]?\\d+)?)\\b', // 6 number
  ].join('|'),
  'g',
);

function highlightGo(code: string): string {
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  GO_TOKENS.lastIndex = 0;
  while ((m = GO_TOKENS.exec(code))) {
    out += escapeHtml(code.slice(last, m.index));
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : m[4] ? 'cn' : m[5] ? 't' : 'n';
    out += `<span class="hl-${cls}">${escapeHtml(m[0])}</span>`;
    last = GO_TOKENS.lastIndex;
  }
  out += escapeHtml(code.slice(last));
  return out;
}

export default function Playground({ code, title = 'main.go' }: Props) {
  const initial = code.trim() + '\n';
  const [src, setSrc] = useState(initial);
  const [out, setOut] = useState<Out>({ text: '', kind: '' });
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

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

  // Tab inserts a tab instead of moving focus, so indentation works.
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const ta = e.currentTarget;
    const s = ta.selectionStart;
    const en = ta.selectionEnd;
    const next = src.slice(0, s) + '\t' + src.slice(en);
    setSrc(next);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = s + 1;
    });
  }

  // Keep the highlight layer scroll-synced with the textarea (for long lines).
  const hlRef = useRef<HTMLPreElement>(null);
  function onScroll() {
    const ta = taRef.current, hl = hlRef.current;
    if (ta && hl) { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; }
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
      <div className="dp-pg__editwrap">
        <pre className="dp-pg__hl" aria-hidden="true" ref={hlRef}>
          <code dangerouslySetInnerHTML={{ __html: highlightGo(src) + '\n' }} />
        </pre>
        <textarea
          className="dp-pg__editor"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          value={src}
          ref={taRef}
          onChange={(e) => setSrc(e.target.value)}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
        />
      </div>
      {out.text && (
        <div className={`dp-pg__out ${out.kind === 'err' ? 'dp-pg__out--err' : out.kind === 'ok' ? 'dp-pg__out--ok' : ''}`}>
          {out.text}
        </div>
      )}
    </div>
  );
}
