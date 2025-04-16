import { ImageResponse } from "next/og";

export const alt = "Lumen Frame";
export const size = {
  width: 600,
  height: 400,
};

export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div tw="h-full w-full flex flex-col justify-center items-center relative bg-gradient-to-r from-gray-800 to-gray-900 p-6">
        <h1 tw="text-6xl text-yellow-300 font-bold drop-shadow-lg mb-4">Lumen Frame</h1>
        <p tw="text-2xl text-white">Explore and rebuild the future</p>
      </div>
    ),
    {
      ...size,
    }
  );
}
