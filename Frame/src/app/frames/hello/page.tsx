import { Metadata } from "next";
import ClientPage from "./client-page";
import { getSession } from "~/auth";

const appUrl = process.env.NEXT_PUBLIC_URL;

const frame = {
  version: "next",
  imageUrl: `${appUrl}/frames/hello/opengraph-image`,
  button: {
    title: "Launch Frame",
    action: {
      type: "launch_frame",
      name: "Farcaster Qawakun",
      url: `${appUrl}/frames/hello/`,
      splashImageUrl: `${appUrl}/splash.jpg`,
      splashBackgroundColor: "#f7f7f7",
    },
  },
};

export const metadata: Metadata = {
  title: "Hello",
  description: "Say hello to the world",
  openGraph: {
    title: "Hello, world!",
    description: "A simple hello world frame",
  },
  other: {
    "fc:frame": JSON.stringify(frame),
  },
};

export default async function Page({ params }: { params: { name: string } }) {
  const { name } = params;
  const session = await getSession();

  return <ClientPage name={name} session={session} />;
}
