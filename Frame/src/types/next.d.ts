import { NextPage } from 'next';
import { AppProps } from 'next/app';

declare module 'next' {
  export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
    getLayout?: (page: React.ReactElement) => React.ReactNode;
  };
}

declare module 'next/app' {
  export type AppPropsWithLayout = AppProps & {
    Component: NextPage;
  };
}

// Sobrescribir los tipos de página para rutas dinámicas
declare module 'next/types' {
  export interface PageProps {
    params?: Record<string, string>;
    searchParams?: Record<string, string | string[] | undefined>;
  }
} 