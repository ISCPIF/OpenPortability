export async function fetchUserStats() {
    const response = await fetch('/api/stats', {
      headers: { 'Cache-Control': 'no-cache' }
    });
    return response.json();
  }
  
  export async function fetchGlobalStats() {
    const response = await fetch('/api/stats/total', {
      headers: { 'Cache-Control': 'no-cache' }
    });
    return response.json();
  }
  
  export async function updateUserStats() {
    const response = await fetch('/api/update/user_stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  }