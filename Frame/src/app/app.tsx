"use client";

import { type AppType } from "next/app";
import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { PrivyProvider } from '@privy-io/react-auth';

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
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
        <Component {...pageProps} />
      </PrivyProvider>
    </SessionProvider>
  );
};

export default MyApp;
