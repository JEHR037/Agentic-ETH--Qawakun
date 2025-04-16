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
      <div tw="h-full w-full flex flex-col justify-center items-center relative bg-gradient-to-r from-[#1a1a1a] to-[#222222]">
        <h1 tw="text-6xl text-[#FFDD8D] font-bold drop-shadow-lg">Lumen Frame</h1>
        <p tw="text-2xl text-[#A9D9E9] mt-4">Explore and rebuild the future</p>
        <div tw="absolute bottom-10 left-1/2 transform -translate-x-1/2">
          <img src="/icon.png" alt="Lumen Frame Icon" tw="w-16 h-16 border-4 border-[#FFDD8D] rounded-full shadow-lg animate-pulse" />
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
