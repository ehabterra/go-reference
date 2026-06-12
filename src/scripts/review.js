/* The /review/ session: spaced-repetition recall over learned pages' quizzes.
   Reuses the page-quiz styling (.dp-q / .dp-opt) but runs one question at a
   time, interleaved across pages, then reschedules each page by result. */
import { loadReview, saveReview, seed, dueSlugs, nextDue, applyResult } from '../lib/review-store';
import { touchStreak } from '../lib/streak-store';
import { pushState, reviewItems, streakItem } from '../lib/state-sync';

const MAX_QUESTIONS = 12; // ≈ a five-minute session
const PER_PAGE = 2;

function loadLearned() {
  try {
    return new Set(JSON.parse(localStorage.getItem('dp-progress') || '[]'));
  } catch {
    return new Set();
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function boot() {
  const bankEl = document.getElementById('dp-review-bank');
  const emptyEl = document.querySelector('[data-dp-review-empty]');
  const sessionEl = document.querySelector('[data-dp-review-session]');
  const doneEl = document.querySelector('[data-dp-review-done]');
  if (!bankEl || !emptyEl || !sessionEl || !doneEl) return;

  let bank = [];
  try { bank = JSON.parse(bankEl.textContent || '[]'); } catch {}
  const byId = new Map(bank.map((p) => [p.id, p]));

  const learned = loadLearned();
  const candidates = [...learned].filter((s) => byId.has(s));
  const review = loadReview();
  if (seed(review, candidates)) saveReview(review);
  const due = dueSlugs(review, candidates).sort((a, b) => review[a].d - review[b].d);

  if (!due.length) {
    emptyEl.hidden = false;
    if (!candidates.length) {
      emptyEl.querySelector('[data-dp-review-nolearned]').hidden = false;
    } else {
      const next = nextDue(review, candidates);
      if (next) {
        const wrap = emptyEl.querySelector('[data-dp-review-nextwrap]');
        wrap.hidden = false;
        wrap.querySelector('[data-dp-review-next]').textContent = new Date(next).toLocaleString(
          document.documentElement.lang === 'ar' ? 'ar' : undefined,
          { weekday: 'long', month: 'short', day: 'numeric' }
        );
      }
    }
    return;
  }

  // Build the session: a couple of questions from each due page (oldest due
  // first), capped, then interleaved so pages alternate.
  const session = [];
  for (const slug of due) {
    if (session.length >= MAX_QUESTIONS) break;
    const page = byId.get(slug);
    const picked = shuffle([...page.quiz]).slice(0, PER_PAGE);
    for (const q of picked) {
      if (session.length >= MAX_QUESTIONS) break;
      session.push({ slug, page, q });
    }
  }
  shuffle(session);

  const progressEl = sessionEl.querySelector('[data-dp-review-progress]');
  const srcEl = sessionEl.querySelector('[data-dp-review-src]');
  const qEl = sessionEl.querySelector('[data-dp-review-q]');
  const nextBtn = sessionEl.querySelector('[data-dp-review-nextbtn]');

  const pageCorrect = {}; // slug -> stays true only if every asked question was right
  let index = 0;
  let totalRight = 0;

  function finish() {
    const slugsAsked = [...new Set(session.map((item) => item.slug))];
    for (const slug of slugsAsked) applyResult(review, slug, pageCorrect[slug] !== false);
    saveReview(review);
    sessionEl.hidden = true;
    doneEl.hidden = false;
    doneEl.querySelector('[data-dp-review-score]').textContent = `${totalRight} / ${session.length}`;
    // a finished review is a learning action — it keeps the streak alive
    const streak = touchStreak();
    pushState([...reviewItems(review, slugsAsked), streakItem(streak)]);
    if (streak.c >= 2) {
      const line = doneEl.querySelector('[data-dp-review-streak]');
      if (line) {
        line.hidden = false;
        line.querySelector('[data-dp-review-streak-n]').textContent = String(streak.c);
      }
    }
  }

  function show() {
    const { slug, page, q } = session[index];
    progressEl.textContent = `${index + 1} / ${session.length}`;
    srcEl.textContent = `${page.track} · ${page.title}`;
    srcEl.href = page.url;
    nextBtn.hidden = true;

    qEl.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'dp-q';
    const prompt = document.createElement('p');
    prompt.className = 'dp-q__prompt';
    prompt.textContent = q.q;
    box.appendChild(prompt);
    let answered = false;
    for (const opt of q.options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dp-opt';
      btn.textContent = opt.text;
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        if (opt.correct) {
          btn.classList.add('is-correct');
          totalRight++;
        } else {
          btn.classList.add('is-wrong');
          pageCorrect[slug] = false;
          const right = [...box.querySelectorAll('.dp-opt')][q.options.findIndex((o) => o.correct)];
          if (right) right.classList.add('is-correct');
        }
        box.querySelectorAll('.dp-opt').forEach((b) => { b.disabled = true; });
        if (q.explain) {
          const ex = document.createElement('p');
          ex.className = 'dp-q__explain';
          ex.textContent = q.explain;
          ex.style.display = 'block';
          box.appendChild(ex);
        }
        nextBtn.hidden = false;
        nextBtn.focus();
      });
      box.appendChild(btn);
    }
    qEl.appendChild(box);
  }

  nextBtn.addEventListener('click', () => {
    index++;
    if (index >= session.length) finish();
    else show();
  });

  sessionEl.hidden = false;
  show();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
