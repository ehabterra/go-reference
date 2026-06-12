import { useEffect, useRef, useState } from 'react';
import { userEmail, visitorHash } from '../../lib/visitor';

interface Props {
  page: string;
}

// Likes need the shared email identity (one like per person). Entering and
// changing the email happens in ONE place — the header sync dialog — which
// this button opens via the dp:ask-email event; dp:email announces changes.
// Only a browser-computed fingerprint of the address is ever sent.
export default function LikeButton({ page }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [pop, setPop] = useState(false);
  const [busy, setBusy] = useState(false);
  // set when the visitor clicks Like before having an email: once the dialog
  // reports one (dp:email), the like they asked for goes through.
  const pendingLike = useRef(false);

  async function fetchState(email: string) {
    try {
      const qs = new URLSearchParams({ page });
      if (email) qs.set('visitor', await visitorHash(email));
      const res = await fetch(`/api/likes?${qs}`);
      const d = res.ok ? await res.json() : null;
      if (d && typeof d.count === 'number') {
        setCount(d.count);
        setLiked(!!d.liked);
      }
    } catch {}
  }

  useEffect(() => {
    fetchState(userEmail());
    const onEmail = (e: Event) => {
      const email = (e as CustomEvent).detail?.email ?? userEmail();
      if (email && pendingLike.current) {
        pendingLike.current = false;
        send(email, true);
      } else {
        fetchState(email);
      }
    };
    window.addEventListener('dp:email', onEmail);
    return () => window.removeEventListener('dp:email', onEmail);
  }, [page]);

  async function send(email: string, nextLiked: boolean) {
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
        body: JSON.stringify({ page, visitor: await visitorHash(email), liked: nextLiked }),
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
    const email = userEmail();
    if (!email) {
      pendingLike.current = true;
      window.dispatchEvent(new CustomEvent('dp:ask-email', { detail: { reason: 'like' } }));
      return;
    }
    send(email, !liked);
  }

  return (
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
  );
}
