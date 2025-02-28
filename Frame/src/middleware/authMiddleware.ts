import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const ADMIN_WALLETS = process.env.NEXT_PUBLIC_ADMIN_WALLETS?.split(',') || [];

export function useAdminProtection() {
  const { user, ready } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready) {
      const userWallet = user?.wallet?.address?.toLowerCase();
      const isAdmin = userWallet && ADMIN_WALLETS.map(w => w.toLowerCase()).includes(userWallet);

      if (!isAdmin) {
        router.push('/');
      }
    }
  }, [ready, user, router]);

  return { isAdmin: ready && user?.wallet?.address && ADMIN_WALLETS.map(w => w.toLowerCase()).includes(user.wallet.address.toLowerCase()) };
} 