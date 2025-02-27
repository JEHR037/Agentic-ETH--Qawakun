import { Metadata } from "next";
import { Providers } from "./providers";
import { getSession } from "~/auth";
import "~/app/globals.css";

export const metadata: Metadata = {
  title: "Qawakun",
  description: "Qawakun - Collaborative World Building",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  
  return (
    <html lang="en">
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
