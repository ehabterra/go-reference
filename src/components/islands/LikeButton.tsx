import { useEffect, useRef, useState } from 'react';

interface Props {
  page: string;
}

// Likes are keyed by email (asked once, kept in localStorage) so each person
// counts once — no login, mirroring how progress.js keeps state client-side.
// The server only ever stores a salted hash of it, never the address itself.
const EMAIL_KEY = 'dp-email';
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

function storedEmail(): string {
  try {
    return localStorage.getItem(EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

export default function LikeButton({ page }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [pop, setPop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [asking, setAsking] = useState(false);
  // 'like' = form opened by the first like (submit also likes);
  // 'edit' = form opened to fix the email (submit just re-syncs state).
  const [mode, setMode] = useState<'like' | 'edit'>('like');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function fetchState(forEmail: string) {
    const qs = new URLSearchParams({ page, ...(forEmail ? { email: forEmail } : {}) });
    fetch(`/api/likes?${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.count === 'number') {
          setCount(d.count);
          setLiked(!!d.liked);
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    const saved = storedEmail();
    setEmail(saved);
    fetchState(saved);
  }, [page]);

  useEffect(() => {
    if (asking) inputRef.current?.focus();
  }, [asking]);

  async function send(forEmail: string, nextLiked: boolean) {
    // Optimistic flip; the POST response reconciles the real numbers.
    setLiked(nextLiked);
    setCount((c) => (c === null ? c : Math.max(0, c + (nextLiked ? 1 : -1))));
    if (nextLiked) {
      setPop(true);
      setTimeout(() => setPop(false), 450);
    }
    setBusy(true);
    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ page, email: forEmail, liked: nextLiked }),
      });
      if (res.ok) {
        const d = await res.json();
        setCount(d.count);
        setLiked(!!d.liked);
      }
    } catch {
      // Keep the optimistic state; the next page load reconciles it.
    } finally {
      setBusy(false);
    }
  }

  function onLikeClick() {
    if (busy) return;
    if (!email) {
      setMode('like');
      setDraft('');
      setError('');
      setAsking((a) => !a);
      return;
    }
    send(email, !liked);
  }

  function onEditClick() {
    setMode('edit');
    setDraft(email);
    setError('');
    setAsking(true);
  }

  function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    const next = draft.trim().toLowerCase();
    if (!EMAIL_RE.test(next)) {
      setError('That doesn’t look like an email.');
      return;
    }
    try {
      localStorage.setItem(EMAIL_KEY, next);
    } catch {}
    setEmail(next);
    setError('');
    setAsking(false);
    if (mode === 'like') send(next, true);
    else fetchState(next);
  }

  return (
    <div className="dp-like-wrap">
      <button
        type="button"
        className={`dp-like${liked ? ' is-on' : ''}${pop ? ' is-pop' : ''}`}
        onClick={onLikeClick}
        aria-pressed={liked}
        title={liked ? 'Unlike this page' : 'Like this page'}
      >
        <span className="dp-like__heart" aria-hidden="true">
          {liked ? '♥' : '♡'}
        </span>
        <span>{liked ? 'Liked' : 'Like'}</span>
        {count !== null && <span className="dp-like__count">{count}</span>}
      </button>

      {asking && (
        <form className="dp-like-form" onSubmit={onSubmit}>
          <input
            ref={inputRef}
            type="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="you@example.com"
            aria-label="Your email"
            required
          />
          <button type="submit" className="dp-btn dp-btn--sm dp-btn--primary">
            {mode === 'like' ? 'Like ♥' : 'Save'}
          </button>
          <span className={`dp-like-form__note${error ? ' is-err' : ''}`}>
            {error || 'Asked once — only a hash is stored, just to count one like per person.'}
          </span>
        </form>
      )}

      {!asking && email && (
        <button type="button" className="dp-like-change" onClick={onEditClick}>
          Change email
        </button>
      )}
    </div>
  );
}
