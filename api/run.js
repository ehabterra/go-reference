// Vercel serverless function: proxy to the official Go Playground compile API.
// Lives outside Astro (root /api) so it works with a static Astro build and no adapter.
// POST { code: string } -> { output } | { errors }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ errors: 'Method not allowed.' });
    return;
  }

  let code = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    code = typeof body.code === 'string' ? body.code : '';
  } catch {
    res.status(400).json({ errors: 'Invalid request body.' });
    return;
  }

  if (!code.trim()) {
    res.status(400).json({ errors: 'No code to run.' });
    return;
  }
  if (code.length > 64000) {
    res.status(413).json({ errors: 'Program too large.' });
    return;
  }

  try {
    const form = new URLSearchParams({ version: '2', body: code, withVet: 'true' });
    const r = await fetch('https://go.dev/_/compile?backend=', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    if (!r.ok) {
      res.status(502).json({ errors: `Go Playground returned ${r.status}.` });
      return;
    }

    const data = await r.json();
    if (data.Errors) {
      res.status(200).json({ errors: data.Errors });
      return;
    }

    const output = (data.Events || []).map((e) => (e && e.Message) || '').join('');
    res.status(200).json({ output, vetErrors: data.VetErrors || '' });
  } catch {
    res.status(500).json({ errors: 'Failed to reach the Go Playground.' });
  }
}
