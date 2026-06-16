const API_BASE = import.meta.env.VITE_API_URL; // Jangan hardcode localhost

export const getSessionData = async () => {
  const res = await fetch(`${API_BASE}/api/session-data`);
  if (!res.ok) throw new Error('Failed fetch session');
  return res.json();
}

export const getMainData = async () => {
  const res = await fetch(`${API_BASE}/api`);
  if (!res.ok) throw new Error('Failed fetch main');
  return res.json();
}
