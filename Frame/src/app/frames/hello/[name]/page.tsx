import { Metadata } from "next";
import ClientPage from "./client-page";

export const metadata: Metadata = {
  title: "Hello",
  description: "Say hello to someone",
};

// Usar los tipos exactos que Next.js espera
type Props = {
  params: {
    name: string;
  };
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function Page(props: Props) {
  const { name } = props.params;

  return <ClientPage name={name} />;
}
