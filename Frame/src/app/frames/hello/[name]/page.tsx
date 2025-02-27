import { Metadata } from "next";
import ClientPage from "./client-page";

export const metadata: Metadata = {
  title: "Hello",
  description: "Say hello to someone",
};

// @ts-ignore - Ignorar errores de tipo en este componente
export default function Page({ params }: any) {
  const { name } = params;

  return <ClientPage name={name} />;
}
