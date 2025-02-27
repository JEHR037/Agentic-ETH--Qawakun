import { Metadata } from "next";
import ClientPage from "./client-page";

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
  const { name } = params;

  return <ClientPage name={name} />;
}
