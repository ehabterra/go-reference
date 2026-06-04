import type { APIRoute } from 'astro';

// Server-side proxy to the official Go Playground compile endpoint.
// As an Astro on-demand route it runs under `astro dev` (local) AND deploys
// as a Vercel serverless function — so the playground "Run" works everywhere.
export const prerender = false;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let code = '';
  try {
    const body = await request.json();
    code = typeof body?.code === 'string' ? body.code : '';
  } catch {
    return json({ errors: 'Invalid request body.' }, 400);
  }

  if (!code.trim()) return json({ errors: 'No code to run.' }, 400);
  if (code.length > 64_000) return json({ errors: 'Program too large.' }, 413);

  try {
    const form = new URLSearchParams({ version: '2', body: code, withVet: 'true' });
    const res = await fetch('https://go.dev/_/compile?backend=', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    if (!res.ok) return json({ errors: `Go Playground returned ${res.status}.` }, 502);

    const data: any = await res.json();
    if (data.Errors) return json({ errors: data.Errors });

    const output = (data.Events || []).map((e: any) => e?.Message ?? '').join('');
    return json({ output, vetErrors: data.VetErrors || '' });
  } catch {
    return json({ errors: 'Failed to reach the Go Playground.' }, 500);
  }
};
