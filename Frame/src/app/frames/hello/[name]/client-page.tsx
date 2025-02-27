"use client";

import dynamic from "next/dynamic";
import { Providers } from "~/app/providers";

const Demo = dynamic(() => import("~/components/Demo"), {
  ssr: false,
});

export default function ClientPage({ name }: { name: string }) {
  return (
    <Providers>
      <Demo title={`Hello, ${name}`} />
    </Providers>
  );
} 