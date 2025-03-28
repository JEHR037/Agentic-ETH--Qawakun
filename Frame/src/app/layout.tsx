import type { Metadata } from "next";
import { getSession } from "~/auth"
import "~/app/globals.css";
import { Providers } from "~/app/providers";

export const metadata: Metadata = {
  title: "Lumen Frame",
  description: "A Lumen Frame interactive experience",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://lum.metasuyo.com",
    siteName: "Lumen Frame",
    title: "Lumen Frame - Interactive Experience",
    description: "Engage with the Lumen Frame interactive experience and claim your personalized NFT. A new narrative adventure.",
    images: [
      {
        url: "/container11.jpg",
        width: 1200,
        height: 630,
        alt: "Lumen Frame",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lumen Frame",
    description: "Explore the Lumen Frame experience and get your soul NFT",
    images: ["/container11.jpg"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession()
  
  return (
    <html lang="en">
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
