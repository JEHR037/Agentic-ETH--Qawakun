"use client";

import dynamic from "next/dynamic";
import { Providers } from "~/app/providers";

const Demo = dynamic(() => import("~/components/Demo"), {
  ssr: false,
});

interface ClientPageProps {
  name: string;
  session: any; // Cambia 'any' por el tipo correcto de sesión si lo tienes
}

export default function ClientPage({ name, session }: ClientPageProps) {
  return (
    <Providers session={session}>
      <Demo title={`Hello, ${name}`} />
    </Providers>
  );
} 