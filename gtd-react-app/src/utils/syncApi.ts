const API = '/api/markdown';

export async function fetchMarkdown(): Promise<string | null> {
  try {
    const res = await fetch(API, { cache: 'no-store' });
    if (!res.ok) return null;
    const { markdown } = await res.json();
    return typeof markdown === 'string' ? markdown : null;
  } catch {
    return null;
  }
}

export async function pushMarkdown(markdown: string): Promise<boolean> {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
