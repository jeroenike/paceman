export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });

  const accessToken = authHeader.replace('Bearer ', '');
  const perPage = req.query.per_page || 5;

  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const activities = await response.json();

    const runs = activities
      .filter(a => a.type === 'Run' || a.sport_type === 'Run')
      .map(a => ({
        id: a.id,
        name: a.name,
        date: a.start_date_local?.split('T')[0],
        distance: (a.distance / 1000).toFixed(2),
        duration: a.moving_time,
        avgPace: a.moving_time && a.distance ? formatPace(a.moving_time / (a.distance / 1000)) : null,
        avgHR: a.average_heartrate ? Math.round(a.average_heartrate) : null,
        maxHR: a.max_heartrate ? Math.round(a.max_heartrate) : null,
        cadence: a.average_cadence ? Math.round(a.average_cadence * 2) : null,
        elevGain: Math.round(a.total_elevation_gain),
        sufferScore: a.suffer_score,
        perceivedExertion: a.perceived_exertion,
        type: classifySession(a),
      }));

    res.status(200).json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function formatPace(secsPerKm) {
  const mins = Math.floor(secsPerKm / 60);
  const secs = Math.round(secsPerKm % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function classifySession(a) {
  const name = (a.name || '').toLowerCase();
  if (name.includes('interval') || name.includes('track')) return 'run_interval';
  if (name.includes('threshold') || name.includes('tempo')) return 'run_threshold';
  if (name.includes('long') || (a.distance > 14000)) return 'run_long';
  if (a.average_heartrate && a.average_heartrate < 145) return 'run_easy';
  return 'run_threshold';
}
