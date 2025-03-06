export async function getAuthToken() {
  try {
    // Forzar el uso de IPv4 en la URL
    const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8080';
    
    console.log(`Intentando obtener token desde ${backendUrl}/login`);
    
    const response = await fetch(`${backendUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: process.env.API_USER,
        password: process.env.API_PASSWORD,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error de autenticación: ${response.status}`);
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
} 