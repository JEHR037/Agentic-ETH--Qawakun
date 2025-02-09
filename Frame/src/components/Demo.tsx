"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { Input } from "../components/ui/input"
import { signIn, signOut, getCsrfToken } from "next-auth/react";
import sdk, {
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";
import { Button } from "~/components/ui/Button";
import { useSession } from "next-auth/react";
import { useAccount, useConnect, useDisconnect } from 'wagmi';

export default function Demo({ title }: { title?: string } = { title: "Qawakun" }) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [message, setMessage] = useState("");
  const [apiResponse, setApiResponse] = useState("Choose language");
  const [isFirstInteraction, setIsFirstInteraction] = useState(true);
  const [messageCount, setMessageCount] = useState(0);
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [hasClaimed, setHasClaimed] = useState(false);
  
  const { data: session } = useSession();
  const { address, isConnected } = useAccount();
  
  const author = session?.user?.fid || address || "anonymous";

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      setContext(context);
      sdk.actions.ready({});
    };

    if (sdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded]);

  const checkClaim = useCallback(async () => {
    if (!address) return;

    try {
      const response = await fetch('/api/nft-claim', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'wallet': address
        }
      });
      
      if (!response.ok) return;

      const data = await response.json();
      
      if (data.has_claimed) {
        setHasClaimed(true);
        setApiResponse("Come back later!");
      }
    } catch (error) {
      return;
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      checkClaim();
    }
  }, [address, checkClaim]);

  useEffect(() => {
    if (isConnected && address) {
      checkClaim();
    }
  }, [isConnected, address, checkClaim]);

  const handleSendMessage = async () => {
    if (hasClaimed) return;
    
    try {
      const response = await fetch("/api/interactive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            content: message,
            author: author || 'anonymous',
          }
        }),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        setApiResponse(responseData.message || "Error processing request");
        return;
      }

      const displayMessage = responseData.message || "Message received";

      setApiResponse(displayMessage);
      setMessage(""); 
      setIsFirstInteraction(false);
      setMessageCount(prev => prev + 1);
      setMessageHistory(prev => [...prev, message]);
    } catch (error) {
      setApiResponse("Error processing request");
    }
  };

  const handleNFTClaim = async () => {
    if (!isAuthenticated || messageCount < 6) return;

    try {
      const response = await fetch("/api/nft-claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fid: session?.user?.fid || 0,
          wallet: address || '',
          message_count: messageCount,
          message_history: messageHistory,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error claiming NFT:", errorData);
        setApiResponse(errorData.message || "Error claiming NFT");
        return;
      }

      const data = await response.json();
      if (data.error) {
        setApiResponse(data.error);
        return;
      }
      
      setHasClaimed(true);
      setApiResponse("Congratulations! You have obtained your Qawakun. Take care of it and stay connected to the Ankanet!");
      handleReset();
    } catch (error) {
      console.error("Error claiming NFT:", error);
      setApiResponse("Error claiming NFT. Please try again.");
    }
  };

  const handleReset = () => {
    setIsFirstInteraction(true);
    if (hasClaimed) {
      setApiResponse("Come back later!");
    } else if (!isAuthenticated) {
      setApiResponse("Please sign in to continue");
    } else {
      setApiResponse("Choose language");
    }
    setMessage("");
  };

  const handleClose = useCallback(() => {
    if (window.parent) {
      window.parent.postMessage({ type: 'frame:close' }, '*');
    }
  }, []);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  const isAuthenticated = !!session || isConnected;

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url("/container11.jpg")' }}
    >
      <div style={{ 
        paddingTop: context?.client.safeAreaInsets?.top ?? 0, 
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}>
        <div className="w-[300px] mx-auto py-2 px-2">
          <h1 className="text-2xl font-bold text-center mb-4 text-white">{title}</h1>

          <GameboyInterface 
            message={message}
            setMessage={setMessage}
            onSend={handleSendMessage}
            onReset={handleReset}
            apiResponse={apiResponse}
            isFirstInteraction={isFirstInteraction}
            isAuthenticated={isAuthenticated}
            disabled={hasClaimed}
            hasClaimed={hasClaimed}
          />

          {!isAuthenticated && !hasClaimed && (
            <div className="mt-4 space-y-2">
              <SignIn />
              <WalletConnect />
            </div>
          )}

          {messageCount >= 6 && !hasClaimed && (
            <Button
              onClick={handleNFTClaim}
              className="w-full mt-4 bg-gradient-to-r from-[#f8d54b] to-[#8b7435]
                       hover:from-[#f8d54b]/80 hover:to-[#8b7435]/80
                       text-[#1a1812] font-bold py-3 rounded-lg
                       transition-all duration-200
                       shadow-lg shadow-[#f8d54b]/20
                       border border-[#f8d54b]/10
                       disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!isAuthenticated || messageCount < 6}
            >
              {messageCount < 6 
                ? `Chat more (${messageCount}/6)` 
                : "CLAIM YOUR CUSTOM NFT"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TypewriterText({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap break-words">
      {text || ''}
    </div>
  );
}

function GameboyInterface({ 
  message, 
  setMessage, 
  onSend,
  onReset,
  apiResponse,
  isFirstInteraction,
  isAuthenticated,
  disabled,
  hasClaimed,
}: {
  message: string;
  setMessage: (value: string) => void;
  onSend: () => void;
  onReset: () => void;
  apiResponse: string;
  isFirstInteraction: boolean;
  isAuthenticated: boolean;
  disabled: boolean;
  hasClaimed: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = [
    '/carrousel/1.jpg',
    '/carrousel/2.jpg',
    '/carrousel/3.jpg',
    '/carrousel/4.jpg',
    '/carrousel/5.jpg',
    // Añade aquí todas las imágenes que tengas en la carpeta
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => 
        prevIndex === images.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000); // Cambia la imagen cada 5 segundos

    return () => clearInterval(interval);
  }, [images.length]);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0';
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <div className="relative">
      {(!isAuthenticated || disabled) && (
        <div className="absolute -left-3 -top-3 w-8 h-8 z-50">
          <div className="relative">
            {/* Onda exterior */}
            <div className="absolute inset-0 animate-ping">
              <div className="w-full h-full bg-[#f8c20b]/10 rounded-full"></div>
            </div>
            {/* Onda media */}
            <div className="absolute inset-1 animate-pulse">
              <div className="w-full h-full bg-[#f8c20b]/20 rounded-full"></div>
            </div>
            {/* Punto central */}
            <div className="absolute inset-2">
              <div className="w-full h-full bg-[#f8c20b] rounded-full shadow-lg shadow-[#f8c20b]/30"></div>
            </div>
          </div>
        </div>
      )}

      <div ref={containerRef} className={`
        bg-gradient-to-b from-[#5d490d] to-[#040404]
        p-6 rounded-3xl shadow-2xl 
        border border-[#7c7c7c]
        w-[290px] mx-auto
        ${!isAuthenticated || disabled ? 'opacity-50 pointer-events-none' : ''}
      `}>
        <div className="relative">
          <div className={`
            relative h-[360px] mb-6 rounded-2xl overflow-hidden
            bg-[#040404]
            border-2 border-[#545454]
            before:absolute before:inset-0 
            before:bg-gradient-to-br 
            before:from-[#f8c20b]/10 before:to-transparent
            before:pointer-events-none
            -mx-4
          `}>
            <div className="absolute inset-0 z-0">
              {images.map((img, index) => (
                <div
                  key={img}
                  className={`
                    absolute inset-0 transition-opacity duration-1000
                    bg-cover bg-center bg-no-repeat
                    ${currentImageIndex === index ? 'opacity-20' : 'opacity-0'}
                  `}
                  style={{ backgroundImage: `url(${img})` }}
                />
              ))}
            </div>

            <div className="absolute inset-0 opacity-5 z-10">
              <div className="w-full h-full" 
                   style={{
                     backgroundImage: 'radial-gradient(#f8c20b 1px, transparent 1px)',
                     backgroundSize: '20px 20px'
                   }}
              />
            </div>

            <div className="absolute top-3 left-3 flex space-x-2 z-20">
              <div className="relative w-4 h-4">
                <div className="absolute inset-0 animate-ping">
                  <div className={`w-full h-full ${!isAuthenticated || disabled ? 'bg-[#f8c20b]/10' : 'bg-[#2da44e]/10'} rounded-full`}></div>
                </div>
                <div className="absolute inset-1">
                  <div className={`w-full h-full ${!isAuthenticated || disabled ? 'bg-[#f8c20b]/20' : 'bg-[#2da44e]/20'} rounded-full animate-pulse`}></div>
                </div>
                <div className="absolute inset-1.5">
                  <div className={`w-full h-full ${!isAuthenticated || disabled ? 'bg-[#f8c20b]' : 'bg-[#2da44e]'} rounded-full shadow-lg ${!isAuthenticated || disabled ? 'shadow-[#f8c20b]/30' : 'shadow-[#2da44e]/30'}`}></div>
                </div>
              </div>

              <div className="relative w-4 h-4 delay-75">
                <div className="absolute inset-0 animate-ping">
                  <div className={`w-full h-full ${!isAuthenticated || disabled ? 'bg-[#f8c20b]/10' : 'bg-[#2da44e]/10'} rounded-full`}></div>
                </div>
                <div className="absolute inset-1">
                  <div className={`w-full h-full ${!isAuthenticated || disabled ? 'bg-[#f8c20b]/20' : 'bg-[#2da44e]/20'} rounded-full animate-pulse`}></div>
                </div>
                <div className="absolute inset-1.5">
                  <div className={`w-full h-full ${!isAuthenticated || disabled ? 'bg-[#f8c20b]' : 'bg-[#2da44e]'} rounded-full shadow-lg ${!isAuthenticated || disabled ? 'shadow-[#f8c20b]/30' : 'shadow-[#2da44e]/30'}`}></div>
                </div>
              </div>

              <div className="relative w-4 h-4 delay-150">
                <div className="absolute inset-0 animate-ping">
                  <div className={`w-full h-full ${!isAuthenticated || disabled ? 'bg-[#f8c20b]/10' : 'bg-[#2da44e]/10'} rounded-full`}></div>
                </div>
                <div className="absolute inset-1">
                  <div className={`w-full h-full ${!isAuthenticated || disabled ? 'bg-[#f8c20b]/20' : 'bg-[#2da44e]/20'} rounded-full animate-pulse`}></div>
                </div>
                <div className="absolute inset-1.5">
                  <div className={`w-full h-full ${!isAuthenticated || disabled ? 'bg-[#f8c20b]' : 'bg-[#2da44e]'} rounded-full shadow-lg ${!isAuthenticated || disabled ? 'shadow-[#f8c20b]/30' : 'shadow-[#2da44e]/30'}`}></div>
                </div>
              </div>
            </div>

            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-30">
              <div className="absolute top-0 left-4 w-[1px] h-full bg-gradient-to-b from-transparent via-[#f8c20b]/20 to-transparent"></div>
              <div className="absolute top-0 right-4 w-[1px] h-full bg-gradient-to-b from-transparent via-[#f8c20b]/20 to-transparent"></div>
            </div>

            <div className="relative z-40 h-full flex items-center justify-center p-4">
              <div className="w-full max-h-full overflow-hidden">
                {isFirstInteraction ? (
                  <span className="animate-pulse text-2xl font-bold block text-center
                                 transition-all duration-1000 
                                 text-[#f8c20b] hover:text-[#f8c20b]/80">
                    {!isAuthenticated ? "Please sign in to continue" :
                     hasClaimed ? "Come back later!" :
                     "Choose language"}
                  </span>
                ) : (
                  <div className="font-mono text-[#f8c20b] text-center">
                    <TypewriterText text={apiResponse || ''} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4 bg-[#040404]/50 p-3 rounded-xl border border-[#545454]">
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={onReset}
                className="w-12 h-12 rounded-full 
                         bg-gradient-to-br from-[#f8c20b] to-[#5d490d]
                         shadow-lg shadow-[#f8c20b]/30
                         hover:from-[#f8c20b]/90 hover:to-[#5d490d]/90
                         active:shadow-inner
                         transition-all duration-200
                         border border-[#f8c20b]/30
                         relative
                         after:content-[''] after:absolute after:inset-1
                         after:rounded-full after:bg-gradient-to-br
                         after:from-[#f8c20b]/20 after:to-transparent"
                aria-label="Reset"
              />
              <span className="text-[#7c7c7c] text-[10px] font-mono mt-1">RESET</span>
            </div>

            <div className="flex-1 space-y-3">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  !isAuthenticated ? "" :
                  disabled ? "" :
                  isFirstInteraction ? "Enter language..." : 
                  "Write your message..."
                }
                className="w-full bg-[#040404]/80 text-[#f8c20b] border-[#545454]
                         placeholder:text-[#7c7c7c] focus:border-[#f8c20b]
                         rounded-lg px-3 py-2 text-sm"
              />
              <Button 
                onClick={onSend} 
                disabled={!message}
                className="w-full bg-gradient-to-r from-[#5d490d] to-[#f8c20b]
                         hover:from-[#5d490d]/90 hover:to-[#f8c20b]/90
                         disabled:from-[#545454] disabled:to-[#7c7c7c]
                         text-[#040404] font-medium py-2 rounded-lg
                         transition-all duration-200
                         shadow-lg shadow-[#f8c20b]/20"
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignIn() {
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { data: session, status } = useSession()

  const getNonce = useCallback(async () => {
    const nonce = await getCsrfToken();
    if (!nonce) throw new Error("Unable to generate nonce");
    return nonce;
  }, []);

  const handleSignIn = useCallback(async () => {
    try {
      setSigningIn(true);
      const nonce = await getNonce();
      const result = await sdk.actions.signIn({ nonce });

      await signIn("credentials", {
        message: result.message,
        signature: result.signature,
        redirect: false,
      });
    } catch (e) {
      // Manejo silencioso del error
    } finally {
      setSigningIn(false);
    }
  }, [getNonce]);

  const handleSignOut = useCallback(async () => {
    try {
      setSigningOut(true);
      await signOut({ redirect: false });
    } finally {
      setSigningOut(false);
    }
  }, []);

  return (
    <Button
      onClick={status !== "authenticated" ? handleSignIn : handleSignOut}
      disabled={signingIn || signingOut}
      className="w-full bg-gradient-to-r from-[#8b7435] to-[#f8d54b]
                hover:from-[#8b7435]/90 hover:to-[#f8d54b]/90
                text-[#1a1812] font-medium
                transition-all duration-200
                shadow-lg shadow-[#f8d54b]/15"
    >
      {status !== "authenticated" ? "Sign In with Farcaster" : "Sign Out"}
    </Button>
  );
}

function WalletConnect() {
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { isConnected } = useAccount();

  return (
    <Button
      onClick={() => isConnected ? disconnect() : connect({ connector: connectors[0] })}
      className="w-full bg-gradient-to-r from-[#1a1812] to-[#8b7435]
                hover:from-[#1a1812]/90 hover:to-[#8b7435]/90
                text-[#f8d54b] font-medium
                transition-all duration-200
                border border-[#f8d54b]/20
                shadow-lg shadow-[#f8d54b]/5"
    >
      {isConnected ? "Disconnect Wallet" : "Connect Wallet"}
    </Button>
  );
}
