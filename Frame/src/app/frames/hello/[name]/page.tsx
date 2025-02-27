"use client";

import { Metadata } from "next";
import dynamic from "next/dynamic";
import { Providers } from "~/app/providers";

const Demo = dynamic(() => import("~/components/Demo"), {
  ssr: false,
});

export const metadata: Metadata = {
  title: "Hello",
  description: "Say hello to someone",
};

interface PageProps {
  params: {
    name: string;
  };
}

export default function Page({ params }: PageProps) {
  const { name } = params.name;

  return (
    <Providers>
      <Demo title={`Hello, ${name}`} />
    </Providers>
  );
}
