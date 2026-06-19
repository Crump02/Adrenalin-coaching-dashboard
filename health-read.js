export default async (req) => {
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('health-data');
    const latest = await store.get('latest', { type: 'json' });

    if (!latest) {
      return new Response(JSON.stringify({ exists: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ exists: true, data: latest }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: '/api/health-read'
};
