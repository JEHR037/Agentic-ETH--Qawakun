"use client";

import { SessionProvider } from 'next-auth/react';
import { PrivyProvider } from '@privy-io/react-auth';
import type { Session } from "next-auth";

interface ProvidersProps {
  children: React.ReactNode;
  session: Session | null;
}

export function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session}>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
        config={{
          loginMethods: ['email', 'wallet'],
          appearance: {
            theme: 'dark',
            accentColor: '#676FFF',
            showWalletLoginFirst: true,
          },
        }}
      >
        {children}
      </PrivyProvider>
    </SessionProvider>
  );
}
