const BACKEND_URL = 'http://localhost:8080';

export async function getAuthToken() {
  try {
    const response = await fetch('/api/auth/token', {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to get auth token');
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    throw error;
  }
} 