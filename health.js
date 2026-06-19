export default async (req) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();

    // Health Auto Export v2 sends metrics as an array
    const metrics = body?.data?.metrics || body?.metrics || [];

    // Extract the values we care about
    let hrv = null;
    let restingHR = null;
    let sleepHours = null;
    let activeEnergy = null;

    metrics.forEach(metric => {
      const name = metric.name?.toLowerCase() || '';
      const data = metric.data || [];
      const latest = data[data.length - 1];

      if (!latest) return;

      if (name.includes('heart_rate_variability') || name.includes('hrv')) {
        hrv = Math.round(parseFloat(latest.qty || latest.value || 0));
      }
      if (name.includes('resting_heart_rate') || name === 'resting heart rate') {
        restingHR = Math.round(parseFloat(latest.qty || latest.value || 0));
      }
      if (name.includes('sleep') && (name.includes('analysis') || name.includes('duration'))) {
        // Sleep comes in hours or minutes depending on format
        const raw = parseFloat(latest.qty || latest.value || 0);
        sleepHours = raw > 24 ? parseFloat((raw / 60).toFixed(1)) : parseFloat(raw.toFixed(1));
      }
      if (name.includes('active_energy') || name.includes('active energy')) {
        activeEnergy = Math.round(parseFloat(latest.qty || latest.value || 0));
      }
    });

    // Calculate readiness score
    // Sleep: 0-100 (8hrs = 100)
    // HRV: 0-100 (100ms = 100, scaled)
    // Resting HR: inverted (lower = better, 50bpm = 100, 80bpm = 0)
    const sleepScore = sleepHours ? Math.min((sleepHours / 8) * 100, 100) : 50;
    const hrvScore = hrv ? Math.min((hrv / 90) * 100, 100) : 50;
    const hrScore = restingHR ? Math.max(0, Math.min(100, ((80 - restingHR) / 30) * 100)) : 50;

    const readinessScore = Math.round(sleepScore * 0.35 + hrvScore * 0.45 + hrScore * 0.20);

    const result = {
      timestamp: new Date().toISOString(),
      date: new Date().toDateString(),
      hrv,
      restingHR,
      sleepHours,
      activeEnergy,
      readinessScore,
      raw: metrics.map(m => ({ name: m.name, count: m.data?.length }))
    };

    console.log('Health data received:', JSON.stringify(result));

    // Store in Netlify Blobs
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('health-data');
    await store.setJSON('latest', result);
    await store.setJSON(`log-${Date.now()}`, result);

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Health function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: '/api/health'
};
