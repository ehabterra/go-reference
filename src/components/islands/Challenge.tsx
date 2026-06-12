import { useEffect, useState } from 'react';
import EditorImport from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-go';
import { isSolved, markSolved } from '../../lib/challenge-store';
import { touchStreak } from '../../lib/streak-store';
import { pushState, chalItem, streakItem } from '../../lib/state-sync';

// "Fix the bug": broken Go the reader edits until its real output (via the
// same /api/run proxy the Playground uses) matches `expected`. Solving is
// remembered (dp-chal), synced across devices, and counts toward the streak.

// Same CJS unwrap as Playground.tsx.
const Editor = ((EditorImport as any)?.default ?? EditorImport) as typeof EditorImport;

interface Props {
  id: string; // unique across the site — used for the solved record
  title?: string;
  brief: string;
  code: string;
  expected: string;
  hint?: string;
  solution?: string;
}

const highlight = (code: string) => Prism.highlight(code, Prism.languages.go, 'go');
const editorStyle = { fontFamily: 'var(--font-mono)', fontSize: '.86rem', lineHeight: 1.55 };
const normalize = (s: string) => s.replace(/\r\n/g, '\n').trimEnd();

export default function Challenge({ id, title = 'bug.go', brief, code, expected, hint, solution }: Props) {
  const initial = code.trim() + '\n';
  const [src, setSrc] = useState(initial);
  const [out, setOut] = useState('');
  const [status, setStatus] = useState<'idle' | 'pass' | 'fail' | 'err'>('idle');
  const [running, setRunning] = useState(false);
  const [fails, setFails] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [solved, setSolved] = useState(false);
  // SSR/hydration gate, same reasoning as Playground.tsx.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setSolved(isSolved(id));
  }, [id]);

  function recordSolved() {
    const rec = markSolved(id);
    const streak = touchStreak();
    pushState([chalItem(id, rec), streakItem(streak)]);
    setSolved(true);
  }

  async function check() {
    setRunning(true);
    setStatus('idle');
    setOut('Compiling and running on the Go Playground…');
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: src }),
      });
      const data = await res.json();
      if (data.errors) {
        setStatus('err');
        setOut(data.errors);
        setFails((f) => f + 1);
      } else if (normalize(data.output || '') === normalize(expected)) {
        setStatus('pass');
        setOut(normalize(data.output || ''));
        recordSolved();
      } else {
        setStatus('fail');
        setOut(data.output || '(program produced no output)');
        setFails((f) => f + 1);
      }
    } catch {
      setStatus('err');
      setOut('Could not reach the runner. Check your connection and try again.');
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    setSrc(initial);
    setStatus('idle');
    setOut('');
  }

  return (
    <div className={`dp-pg dp-chal${solved ? ' is-solved' : ''}`}>
      <div className="dp-pg__bar">
        <span className="dp-pg__title">🐞 {title} — fix the bug</span>
        <div className="dp-pg__actions">
          {solved && <span className="dp-chal__solved">Solved ✓</span>}
          {hint && (
            <button className="dp-btn dp-btn--sm dp-btn--ghost" onClick={() => setShowHint((s) => !s)}>
              {showHint ? 'Hide hint' : 'Hint'}
            </button>
          )}
          <button className="dp-btn dp-btn--sm dp-btn--ghost" onClick={reset}>Reset</button>
          {solution && fails >= 2 && status !== 'pass' && (
            <button className="dp-btn dp-btn--sm dp-btn--ghost" onClick={() => setSrc(solution.trim() + '\n')}>
              Show solution
            </button>
          )}
          <button className="dp-btn dp-btn--sm dp-btn--primary" onClick={check} disabled={running}>
            {running ? 'Checking…' : 'Run & check ▸'}
          </button>
        </div>
      </div>
      <p className="dp-chal__brief">{brief}</p>
      <div className="dp-chal__expected">
        <span>Expected output</span>
        <pre>{expected}</pre>
      </div>
      {mounted ? (
        <Editor
          value={src}
          onValueChange={setSrc}
          highlight={highlight}
          padding={16}
          tabSize={4}
          insertSpaces={false}
          textareaId={`chal-${id}`}
          className="dp-pg__editor language-go"
          textareaClassName="dp-pg__ta"
          preClassName="dp-pg__pre"
          style={editorStyle}
        />
      ) : (
        <pre
          className="dp-pg__editor dp-pg__pre language-go"
          style={{ ...editorStyle, margin: 0, padding: 16 }}
          suppressHydrationWarning
        >
          {src}
        </pre>
      )}
      {showHint && hint && <div className="dp-chal__hint">💡 {hint}</div>}
      {status === 'pass' && <div className="dp-chal__pass">✓ Fixed — output matches. Nice debugging!</div>}
      {out && status !== 'pass' && (
        <div className={`dp-pg__out ${status === 'err' ? 'dp-pg__out--err' : ''}`}>{out}</div>
      )}
      {status === 'fail' && (
        <div className="dp-chal__nomatch">Runs, but the output doesn’t match the expected output yet.</div>
      )}
    </div>
  );
}
