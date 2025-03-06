import { NextRequest } from 'next/server';

export async function isAdmin(req: NextRequest) {
  try {
    // Obtener la wallet del usuario (desde cookie, header, sesión, etc.)
    const userWallet = req.headers.get('x-user-wallet') || '';
    
    // Comparar con la wallet de administrador configurada
    const adminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET || '';
    
    if (!adminWallet) {
      console.error('NEXT_PUBLIC_ADMIN_WALLET no está configurado');
      return { isAdmin: false, wallet: 'ADMIN_WALLET_NOT_CONFIGURED' };
    }
    
    if (!userWallet) {
      return { isAdmin: false, wallet: 'NO_WALLET_PROVIDED' };
    }
    
    // Verificar si la wallet del usuario coincide con la del administrador
    const isAdminUser = adminWallet.toLowerCase() === userWallet.toLowerCase();
    
    return { isAdmin: isAdminUser, wallet: userWallet };
  } catch (error) {
    console.error('Error verificando admin:', error);
    return { isAdmin: false, wallet: 'ERROR_CHECKING_WALLET' };
  }
}

// Función para obtener el token de autenticación
export async function getAuthToken(): Promise<string> {
    // Por ahora, podemos usar un token mock o el token de Privy
    // Esto debería adaptarse según tu sistema de autenticación
    return 'mock_token'; // Reemplazar con la lógica real de token
} 