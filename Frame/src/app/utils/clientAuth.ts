const user = process.env.APP_USER;
const password = process.env.APP_PASSWORD;

export async function getAuthToken() {
  try {
    const response = await fetch(`${process.env.BACKEND_URL}/login`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user: user, password: password })
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