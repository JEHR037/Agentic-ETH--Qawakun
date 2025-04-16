"use client";

import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { Input } from "../components/ui/input"
import { useSession } from "next-auth/react";
import sdk, {
  type Context,
} from "@farcaster/frame-sdk";
import { Button } from "~/components/ui/Button";
import { usePrivy, useWallets } from '@privy-io/react-auth';
import ProposalsView from './ProposalsView';
import { Proposal } from "~/types/interfaces";
import { useRouter } from "next/navigation";
import staticGameOptions from '~/data/gameOptions.json';

interface GameOption {
  code: string;
  name: string;
}

interface GameInteraction {
  id: number;
  options: GameOption[];
}

interface GameLanguage {
  code: string;
  name: string;
  interactions: GameInteraction[];
}

interface GameOptions {
  languages: GameLanguage[];
}

export default function Demo({ title }: { title?: string } = { title: "Lumen" }) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [message, setMessage] = useState("");
  const [apiResponse, setApiResponse] = useState("Choose language");
  const [isFirstInteraction, setIsFirstInteraction] = useState(true);
  const [messageCount, setMessageCount] = useState(0);
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [isClaimLoading, setIsClaimLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('es');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFreeChat, setIsFreeChat] = useState(false);
  const [freeChatMessages, setFreeChatMessages] = useState(0);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalData, setProposalData] = useState({
    type: '',
    description: '',
    flexibility: 5,
    contact: ''
  });
  const [hasActiveProposal, setHasActiveProposal] = useState(false);
  const [showProposalsView, setShowProposalsView] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: session } = useSession();
  const { authenticated, login, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();
  
  const author = session?.user?.fid || wallets?.[0]?.address || "anonymous";
  const isAuthenticated = !!session || authenticated;

  // Cambiamos el tipo any por la interfaz definida
  const [gameOptions, setGameOptions] = useState<GameOptions>(staticGameOptions as GameOptions);
  
  // Podemos usar este estado para mostrar un indicador de carga mientras se obtienen las opciones
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

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
    if (!isAuthenticated) return;

    try {
      const response = await fetch('/api/nft-claim', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'wallet': author.toString()
        }
      });
      
      if (!response.ok) {
        console.warn('Error response from server:', await response.text());
        return;
      }

      const data = await response.json();
      
      if (data.has_claimed) {
        setHasClaimed(true);
        setApiResponse("Come back later!");
      }
    } catch (err) {
      console.warn('Error checking claim:', err);
    }
  }, [isAuthenticated, author]);

  useEffect(() => {
    if (isAuthenticated) {
      checkClaim();
    }
  }, [isAuthenticated, checkClaim]);

  const checkExistingProposal = useCallback(async () => {
    if (!isAuthenticated || !author || author === 'anonymous') return;

    try {
      const response = await fetch(`/api/proposal?wallet=${author}`);
      
      if (!response.ok) return;

      const proposals = await response.json();
      const hasActiveProposal = Array.isArray(proposals) && 
        proposals.some((p: Proposal) => 
          p.wallet === author && 
          p.status > 0 && 
          p.status <= 4
        );
      
      setHasActiveProposal(hasActiveProposal);
      
      if (hasActiveProposal) {
        setApiResponse("You have already submitted a proposal. Please wait for our team to contact you.");
        if (isFreeChat) {
          setIsFreeChat(false);
        }
      }
    } catch (err) {
      console.warn('Error checking existing proposal:', err);
    }
  }, [isAuthenticated, author, isFreeChat]);

  useEffect(() => {
    if (isAuthenticated) {
      checkExistingProposal();
    }
  }, [isAuthenticated, checkExistingProposal]);

  useEffect(() => {
    if (isFreeChat && isAuthenticated) {
      checkExistingProposal();
    }
  }, [isFreeChat, isAuthenticated, checkExistingProposal]);

  const handleSendMessage = async () => {
    if ((hasClaimed && !isFreeChat) || !author || author === 'anonymous') return;
    
    try {
      const response = await fetch("/api/interactive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            content: message || 'es',
            author: author
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
      
      // Incrementar el contador apropiado según el modo
      if (isFreeChat) {
        setFreeChatMessages(prev => prev + 1);
      } else {
        setMessageCount(prev => prev + 1);
        setMessageHistory(prev => [...prev, message]);
      }
      
      setIsFirstInteraction(false);
    } catch (err) {
      console.warn('Error sending message:', err);
      setApiResponse("Error processing request");
    }
  };

  const handleNFTClaim = async () => {
    if (!isAuthenticated || messageCount < 6 || isClaimLoading) return;

    if (author === 'anonymous') {
      setApiResponse("Please connect your wallet first");
      return;
    }

    try {
      setIsClaimLoading(true);
      setApiResponse("Minting your NFT... This may take a minute.");

      const claimData = {
        fid: session?.user?.fid || 0,
        wallet: author,
        message_count: messageCount,
        message_history: messageHistory.filter(msg => msg),
        timestamp: new Date().toISOString(),
      };

      const response = await fetch("/api/nft-claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(claimData),
      });

      const responseText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        setApiResponse("Error claiming NFT: " + e);
        return;
      }

      if (!response.ok) {
        setApiResponse(errorData.message || errorData.error || "Error claiming NFT");
        return;
      }

      setHasClaimed(true);
      setShowSuccessModal(true);
      setApiResponse("Congratulations! You have obtained your Lumen Nft. Take care of it and stay connected to the Ankanet!");
      handleReset();
    } catch (error) {
      setApiResponse("Error claiming NFT. Please try again."+error);
    } finally {
      setIsClaimLoading(false);
    }
  };

  const handleReset = () => {
    setIsFirstInteraction(true);
    if (hasClaimed) {
      setApiResponse("Come back later!");
    } else if (!session) {
      setApiResponse("Please sign in to continue");
    } else {
      setApiResponse("Choose language");
    }
    setMessage("");
  };

  const handleChangeWorld = async () => {
    if (!isAuthenticated || !author || author === 'anonymous') return;

    try {
      // Verificar propuestas existentes antes de cambiar a free chat
      const response = await fetch(`/api/proposal?wallet=${author}`);
      
      if (!response.ok) {
        console.warn('Error checking proposals:', await response.text());
        return;
      }

      const proposals = await response.json();
      const hasActive = Array.isArray(proposals) && 
        proposals.some((p: Proposal) => p.status === 1 || p.status === 2);

      if (hasActive) {
        setApiResponse("You have an active proposal. Please wait for our team to contact you.");
        setHasActiveProposal(true);
        return;
      }

      setIsFreeChat(true);
      setIsFirstInteraction(false);
      setApiResponse("You are now in free chat mode. Feel free to explore and propose changes!");
    } catch (err) {
      console.warn('Error checking proposals:', err);
      setApiResponse("Error checking proposal status. Please try again.");
    }
  };

  const authorString = typeof author === 'number' ? author.toString() : author;

  useEffect(() => {
    if (user?.wallet?.address) {
      console.log('Tu wallet address:', user.wallet.address);
      // Guardar la dirección en localStorage
      localStorage.setItem('userWalletAddress', user.wallet.address);
    }
  }, [user]);

  const handleProposalSubmit = async () => {
    console.log("Proposal submit clicked", proposalData);
    
    if (!author || author === 'anonymous') {
      console.warn('User not authenticated');
      setApiResponse("You need to authenticate first.");
      return;
    }

    setIsSubmitting(true);
    setApiResponse("Sending your proposal...");
    
    try {
      const timestamp = new Date().toISOString();
      
      const response = await fetch("/api/proposal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallet: author,
          fid: session?.user?.fid || 0,
          proposal_type: proposalData.type,
          description: proposalData.description,
          flexibility: proposalData.flexibility,
          contact: proposalData.contact,
          message_history: messageHistory,
          timestamp,
          status: 1
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.warn('Error submitting proposal:', error);
        setApiResponse("Error submitting proposal. Please try again.");
        return;
      }

      setProposalData({
        type: '',
        description: '',
        flexibility: 5,
        contact: ''
      });
      
      // Cerrar el modal y mostrar mensaje de éxito
      setShowProposalModal(false);
      setApiResponse("🎉 Congratulations! Your proposal has been submitted successfully!");
      
      setHasActiveProposal(true);


      setTimeout(() => {
        router.push('/');
      }, 2000);

    } catch (err) {
      console.error('Error submitting proposal:', err);
      setApiResponse("Error submitting proposal. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // En el fetchGameOptions, aseguramos que los datos cumplen con nuestra interfaz
  const fetchGameOptions = useCallback(async () => {
    try {
      setIsLoadingOptions(true);
      
      const response = await fetch('/api/game-options');
      
      if (!response.ok) {
        console.warn('Error fetching game options from API, using static options:', await response.text());
        return;
      }
      
      const data = await response.json();
      
      // Verificamos la estructura de datos con nuestra interfaz
      if (data && data.languages && Array.isArray(data.languages) && data.languages.length > 0) {
        console.log('Using dynamic game options from Redis');
        setGameOptions(data as GameOptions);
      } else {
        console.warn('Invalid data structure from API, using static options');
      }
    } catch (error) {
      console.error('Error fetching game options, using static fallback:', error);
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  // Cargar las opciones de juego cuando el componente se monta
  useEffect(() => {
    fetchGameOptions();
  }, [fetchGameOptions]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  // Podemos mostrar un indicador de carga mientras se obtienen las opciones
  if (isLoadingOptions && gameOptions.languages.length === 0) {
    return <div>Loading game options...</div>;
  }

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
        <div className="w-[400px] mx-auto py-2 px-2">
          <h1 className="text-2xl font-bold text-center mb-4 text-white">{title}</h1>

          <div className="relative">
            <button
              onClick={() => setShowProposalsView(!showProposalsView)}
              className={`absolute -left-12 top-8 w-10 h-10
                         bg-[#1a1812]/50 hover:bg-[#1a1812]/70
                         border border-[#f8c20b]/30 rounded-lg
                         flex items-center justify-center
                         transition-all duration-200
                         group
                         ${!hasClaimed && 'opacity-50 cursor-not-allowed'}`}
              disabled={!hasClaimed}
              title={!hasClaimed ? "You need to claim your NFT first" : "View proposals"}
            >
              <div className="transform transition-transform group-hover:scale-110">
                <span className="text-[#f8c20b] text-xl">🗳️</span>
              </div>
            </button>

            {showProposalsView ? (
              <ProposalsView hasClaimed={hasClaimed} />
            ) : (
              <GameboyInterface 
                message={message}
                setMessage={setMessage}
                onSend={handleSendMessage}
                onReset={handleReset}
                apiResponse={apiResponse}
                setApiResponse={setApiResponse}
                isFirstInteraction={isFirstInteraction}
                setIsFirstInteraction={setIsFirstInteraction}
                isAuthenticated={isAuthenticated}
                disabled={hasClaimed || hasActiveProposal}
                hasClaimed={hasClaimed}
                setMessageCount={setMessageCount}
                setMessageHistory={setMessageHistory}
                author={authorString}
                messageCount={messageCount}
                selectedLanguage={selectedLanguage}
                setSelectedLanguage={setSelectedLanguage}
                isFreeChat={isFreeChat}
                setIsFreeChat={setIsFreeChat}
                freeChatMessages={freeChatMessages}
                setFreeChatMessages={setFreeChatMessages}
                isMenuOpen={isMenuOpen}
                setIsMenuOpen={setIsMenuOpen}
                setShowCreditsModal={setShowCreditsModal}
                setShowProposalModal={setShowProposalModal}
                onChangeWorld={handleChangeWorld}
                logout={logout}
                gameOptions={gameOptions}
              />
            )}
          </div>

          {!isAuthenticated && !hasClaimed && (
            <div className="mt-4">
              <Button
                onClick={login}
                className="w-full bg-gradient-to-r from-[#1a1812] to-[#8b7435]
                          hover:from-[#1a1812]/90 hover:to-[#8b7435]/90
                          text-[#f8d54b] font-medium
                          transition-all duration-200
                          border border-[#f8d54b]/20
                          shadow-lg shadow-[#f8d54b]/5"
              >
                Connect
              </Button>
            </div>
          )}

          {messageCount >= 7 && !hasClaimed && (
            <Button
              onClick={handleNFTClaim}
              className="w-full mt-4 bg-gradient-to-r from-[#f8d54b] to-[#8b7435]
                       hover:from-[#f8d54b]/80 hover:to-[#8b7435]/80
                       text-[#1a1812] font-bold py-3 rounded-lg
                       transition-all duration-200
                       shadow-lg shadow-[#f8d54b]/20
                       border border-[#f8d54b]/10
                       disabled:opacity-50 disabled:cursor-not-allowed
                       relative"
              disabled={!isAuthenticated || messageCount < 6 || isClaimLoading}
            >
              {isClaimLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1a1812] mr-2"></div>
                  Minting...
                </div>
              ) : (
                messageCount < 6 
                  ? `Chat more (${messageCount}/6)` 
                  : "CLAIM YOUR CUSTOM NFT"
              )}
            </Button>
          )}

          {/* Botón para Make a Proposal */}
          {isFreeChat && freeChatMessages >= 4 && (
            <Button
              onClick={() => setShowProposalModal(true)}
              disabled={!hasClaimed}
              className={`w-full mt-4 bg-gradient-to-r from-[#f8d54b] to-[#8b7435]
                         hover:from-[#f8d54b]/80 hover:to-[#8b7435]/80
                         text-[#040404] font-medium py-2 rounded-lg
                         transition-all duration-200
                         shadow-lg shadow-[#f8c20b]/20
                         relative
                         ${!hasClaimed && 'opacity-50 cursor-not-allowed'}`}
              title={!hasClaimed ? "You need to claim your NFT first" : "Make a proposal"}
            >
              {!hasClaimed ? "CLAIM NFT TO MAKE PROPOSALS" : "MAKE A PROPOSAL"}
            </Button>
          )}
        </div>
      </div>

      {/* Modal de éxito */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gradient-to-b from-[#5d490d] to-[#040404] p-6 rounded-3xl 
                        shadow-2xl border border-[#f8c20b] max-w-sm w-full text-center">
            <h2 className="text-2xl font-bold text-[#f8c20b] mb-4">
              ¡Congratulations!
            </h2>
            <p className="text-[#f8c20b]/90 mb-6">
              You have successfully claimed your Lumen NFT! 
              Take care of it and stay connected to the Ankanet.
            </p>
            <Button
              onClick={() => setShowSuccessModal(false)}
              className="bg-[#f8c20b] text-[#040404] px-8 py-2 rounded-lg
                       hover:bg-[#f8c20b]/90 transition-colors"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Créditos */}
      {showCreditsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gradient-to-b from-[#5d490d] to-[#040404] p-6 rounded-3xl 
                         shadow-2xl border border-[#f8c20b] max-w-sm w-full">
            <h2 className="text-2xl font-bold text-[#f8c20b] mb-4 text-center">
              Credits
            </h2>
            <div className="text-[#f8c20b]/90 space-y-4 mb-6 select-none">
              <p>Created by the LUM TEAM</p>
              <p>Special thanks to:</p>
              <ul className="list-disc list-inside pl-4">
                <li>The Farcaster Community</li>
                <li>Base Network</li>
                <li>All our early supporters</li>
              </ul>
            </div>
            <div className="flex justify-center">
              <Button
                onClick={() => setShowCreditsModal(false)}
                className="bg-[#f8c20b] text-[#040404] px-8 py-2 rounded-lg
                          hover:bg-[#f8c20b]/90 transition-colors
                          shadow-md hover:shadow-lg transform hover:-translate-y-0.5
                          font-medium border border-[#f8c20b]/30"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Propuesta */}
      {showProposalModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1812] border border-[#f8c20b]/30 rounded-xl max-w-md w-full p-6 shadow-lg relative">
            <h2 className="text-2xl font-bold text-[#f8c20b] mb-4 text-center">
              Submit Proposal
            </h2>
            <div className="text-[#f8c20b]/90 space-y-6 mb-6">
              <p className="text-sm">
                Shape the future of Ankanet! Your proposals will be reviewed by the Metasuyo team 
                and may be implemented through community voting. Your conversation history with the AI 
                will be included to provide context for your suggestions.
              </p>

              <div className="space-y-2">
                <label className="block text-sm font-medium">Proposal Type</label>
                <select
                  value={proposalData.type}
                  onChange={(e) => setProposalData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full bg-[#040404]/80 text-[#f8c20b] border-[#545454]
                           focus:border-[#f8c20b] rounded-lg px-3 py-2"
                >
                  <option value="">Select a type...</option>
                  <option value="WORLD">World Building</option>
                  <option value="CHARACTERS">Characters</option>
                  <option value="LAWS">Events</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">Description</label>
                <textarea
                  value={proposalData.description}
                  onChange={(e) => setProposalData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-[#040404]/80 text-[#f8c20b] border-[#545454]
                           placeholder:text-[#7c7c7c] focus:border-[#f8c20b]
                           rounded-lg px-3 py-2 min-h-[100px]"
                  placeholder="Describe your proposal in detail..."
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Flexibility Level (1-10)
                  <span className="text-[#f8c20b]/60 text-xs ml-2">
                    How flexible are you with modifications to your proposal?
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={proposalData.flexibility}
                  onChange={(e) => setProposalData(prev => ({ ...prev, flexibility: Number(e.target.value) }))}
                  className="w-full"
                />
                <div className="text-center text-sm">{proposalData.flexibility}</div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">Contact Information</label>
                <input
                  type="text"
                  value={proposalData.contact}
                  onChange={(e) => setProposalData(prev => ({ ...prev, contact: e.target.value }))}
                  className="w-full bg-[#040404]/80 text-[#f8c20b] border-[#545454]
                           placeholder:text-[#7c7c7c] focus:border-[#f8c20b]
                           rounded-lg px-3 py-2"
                  placeholder="How can we contact you? (Farcaster, X, Telegram, Discord...)"
                />
              </div>

              <div className="text-xs text-[#f8c20b]/60">
                Note: Your proposal will be reviewed along with your AI conversation history 
                to better understand the context and motivation behind your suggestions. 
                This helps us ensure that proposals align with the worlds narrative and mechanics.
              </div>
            </div>

            <div className="flex justify-between gap-4">
              <Button
                onClick={() => {
                  setShowProposalModal(false);
                  setProposalData({ type: '', description: '', flexibility: 5, contact: '' });
                }}
                className="flex-1 bg-[#1a1812] text-[#f8c20b] px-4 py-2 rounded-lg
                          hover:bg-[#1a1812]/90 transition-colors
                          border border-[#f8c20b]/30"
              >
                Cancel
              </Button>
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("Submit button clicked");
                  handleProposalSubmit();
                }}
                disabled={!proposalData.type || !proposalData.description || isSubmitting}
                className="flex-1 bg-[#f8c20b] text-[#040404] px-4 py-2 rounded-lg
                          hover:bg-[#f8c20b]/90 transition-colors
                          disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#040404] border-t-transparent rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </div>
                ) : (
                  'Submit'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TypewriterText({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const charactersPerPage = 180; // Ajustar según necesidad
  
  // Dividir el texto en páginas
  const pages = useMemo(() => {
    const result = [];
    for (let i = 0; i < text.length; i += charactersPerPage) {
      result.push(text.substring(i, i + charactersPerPage));
    }
    return result;
  }, [text]);

  // Texto a mostrar en la página actual
  const currentPageText = useMemo(() => 
    pages[currentPage] || '', 
  [pages, currentPage]);

  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
    setCurrentPage(0);
  }, [text]);

  useEffect(() => {
    if (currentIndex < currentPageText.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + currentPageText[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 30); // ajustar velocidad según necesidad

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, currentPageText]);

  const goToNextPage = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(prev => prev + 1);
      setCurrentIndex(0);
      setDisplayedText('');
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
      setCurrentIndex(0);
      setDisplayedText('');
    }
  };

  return (
    <div className="flex flex-col h-full justify-between">
      <div className="inline-block text-[#8ac0d9] whitespace-pre-wrap break-words pt-5">
        {displayedText}
        {currentIndex < currentPageText.length && (
          <span className="animate-pulse">▮</span>
        )}
      </div>
      
      {pages.length > 1 && (
        <div className="mt-4 flex justify-between items-center">
          <button 
            onClick={goToPrevPage} 
            disabled={currentPage === 0}
            className={`px-3 py-1 rounded-sm text-xs font-medium transition-all
                      ${currentPage === 0 
                        ? 'text-[#8ac0d9]/30 cursor-not-allowed' 
                        : 'text-[#8ac0d9] bg-[#232c39]/80 hover:bg-[#232c39] border border-[#8ac0d9]/30'}`}
          >
            ← Anterior
          </button>
          
          <span className="text-xs text-[#8ac0d9]/70">
            {currentPage + 1} / {pages.length}
          </span>
          
          <button 
            onClick={goToNextPage} 
            disabled={currentPage >= pages.length - 1 || currentIndex < currentPageText.length}
            className={`px-3 py-1 rounded-sm text-xs font-medium transition-all
                      ${(currentPage >= pages.length - 1 || currentIndex < currentPageText.length)
                        ? 'text-[#8ac0d9]/30 cursor-not-allowed' 
                        : 'text-[#8ac0d9] bg-[#232c39]/80 hover:bg-[#232c39] border border-[#8ac0d9]/30'}`}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

function LanguageSelector({ onSelect }: { onSelect: (lang: string) => void }) {
  return (
    <div className="flex flex-col gap-4 max-w-[250px] mx-auto my-auto">
      <button 
        onClick={() => onSelect('es')}
        className="px-6 py-3 bg-[#232c39]/80 hover:bg-[#232c39] 
                 text-[#8ac0d9] font-medium rounded-sm 
                 border border-[#8ac0d9]/30 
                 transition-all duration-200
                 shadow-md hover:shadow-lg hover:-translate-y-1
                 flex items-center justify-center"
      >
        <span>Español</span>
      </button>
      
      <button 
        onClick={() => onSelect('en')}
        className="px-6 py-3 bg-[#232c39]/80 hover:bg-[#232c39] 
                 text-[#8ac0d9] font-medium rounded-sm 
                 border border-[#8ac0d9]/30
                 transition-all duration-200
                 shadow-md hover:shadow-lg hover:-translate-y-1
                 flex items-center justify-center"
      >
        <span>English</span>
      </button>
    </div>
  );
}

function GameboyInterface({
  message, 
  setMessage, 
  onSend,
  onReset,
  apiResponse,
  setApiResponse,
  isFirstInteraction,
  setIsFirstInteraction,
  isAuthenticated,
  disabled,
  hasClaimed,
  setMessageCount,
  setMessageHistory,
  author,
  messageCount,
  selectedLanguage,
  setSelectedLanguage,
  isFreeChat,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setIsFreeChat: _,
  freeChatMessages,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setFreeChatMessages: __,
  isMenuOpen,
  setIsMenuOpen,
  setShowCreditsModal,
  setShowProposalModal,
  onChangeWorld,
  logout,
  gameOptions,
}: {
  message: string;
  setMessage: (value: string) => void;
  onSend: () => void;
  onReset: () => void;
  apiResponse: string;
  setApiResponse: (value: string) => void;
  isFirstInteraction: boolean;
  setIsFirstInteraction: (value: boolean) => void;
  isAuthenticated: boolean;
  disabled: boolean;
  hasClaimed: boolean;
  setMessageCount: (value: (prev: number) => number) => void;
  setMessageHistory: (value: (prev: string[]) => string[]) => void;
  author: string;
  messageCount: number;
  selectedLanguage: string;
  setSelectedLanguage: (value: string) => void;
  isFreeChat: boolean;
  setIsFreeChat: (value: boolean) => void;
  freeChatMessages: number;
  setFreeChatMessages: (value: number) => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (value: boolean) => void;
  setShowCreditsModal: (value: boolean) => void;
  setShowProposalModal: (value: boolean) => void;
  onChangeWorld: () => void;
  logout: () => void;
  gameOptions: GameOptions;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = [
    '/carrousel/1.png',
    '/carrousel/2.png',
    '/carrousel/3.png',
    '/carrousel/4.png',
    '/carrousel/5.png',
    '/carrousel/6.png',
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
      {/* Botón independiente de logout para usuarios sin NFT pero autenticados */}
      {isAuthenticated && !hasClaimed && (
        <div className="absolute right-0 top-0 z-50">
          <button
            onClick={logout}
            className="absolute top-8 -right-12 w-10 h-10
                     bg-[#232c39]/90 hover:bg-[#232c39]
                     border border-[#f85149]/40 rounded-sm
                     flex items-center justify-center
                     transition-all duration-200
                     text-[#f85149] group"
            title="Logout"
          >
            <span className="transform transition-transform group-hover:scale-110">🚪</span>
          </button>
        </div>
      )}

      {/* Menú para usuarios con NFT */}
      {hasClaimed && (
        <div className="absolute right-0 top-0 z-50">
          <MenuButton 
            isOpen={isMenuOpen} 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            className="absolute top-8 -right-12 w-10 h-10"
          />
          
          <Menu 
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            isAuthenticated={isAuthenticated}
            onChangeWorld={onChangeWorld}
            freeChatMessages={freeChatMessages}
            onShowCredits={() => setShowCreditsModal(true)}
            onShowProposal={() => setShowProposalModal(true)}
            className="mt-32 -right-12"
            onLogout={logout}
          />
        </div>
      )}

      <div ref={containerRef} className={`
        bg-gradient-to-b from-[#232c39] to-[#455464]
        p-6 rounded-xl border-[6px] border-[#5a3a3b]
        w-[330px] mx-auto
        ${!isAuthenticated || (disabled && !isFreeChat) ? 'opacity-50 pointer-events-none' : ''}
        relative select-none shadow-xl
        before:absolute before:inset-0 before:bg-gradient-to-tr 
        before:from-[#5a3a3b]/30 before:to-[#232c39]/40 
        before:rounded-lg before:mix-blend-overlay
        overflow-visible
      `}>
        {/* Cámara y sensores simplificados */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#232c39] border border-[#8d7481]/50 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-[#8ac0d9]/30 animate-pulse"></div>
          </div>
        </div>

        <div className="relative">
          {/* Pantalla con menos efectos */}
          <div className={`
            relative h-[430px] mb-4 rounded-lg overflow-hidden
            bg-[#232c39] border border-[#8d7481]
            shadow-inner shadow-[#455464]
            -mx-2
          `}>
            {/* Efectos de cristal simplificados */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none z-10"></div>
            <div className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent,transparent_10px,rgba(138,192,217,0.02)_10px,rgba(138,192,217,0.02)_11px)] pointer-events-none opacity-30 z-10"></div>
            
            {/* Marca de daño simplificada */}
            <div className="absolute top-0 right-0 w-[15%] h-[10%] bg-gradient-to-b from-[#8d7481]/5 to-transparent pointer-events-none z-10 clip-path-diagonal"></div>

            {/* Contenido de la pantalla */}
            <div className="absolute inset-0 z-20">
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
                <div className="w-full h-full flex flex-col justify-center">
                  {isFirstInteraction ? (
                    isAuthenticated && !disabled ? (
                      <LanguageSelector 
                        onSelect={async (lang) => {
                          if (!author || author === 'anonymous') {
                            setApiResponse("Please connect your wallet first");
                            return;
                          }
                          setSelectedLanguage(lang);
                          try {
                            const response = await fetch("/api/interactive", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                data: {
                                  content: lang,
                                  author: author
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
                            setMessageCount(prev => prev + 1);
                            setMessageHistory(prev => [...prev, lang]);
                            setIsFirstInteraction(false);
                          } catch (err) {
                            console.warn('Error sending message:', err);
                            setApiResponse("Error processing request");
                          }
                        }}
                      />
                    ) : (
                      <span className="animate-pulse text-2xl font-bold block text-center
                                     transition-all duration-1000 
                                     text-[#f8c20b] hover:text-[#f8c20b]/80
                                     select-none">
                        {!isAuthenticated ? "Please sign in to continue" :
                         hasClaimed ? "Come back later!" :
                         "Choose language"}
                      </span>
                    )
                  ) : (
                    <div className="font-mono text-[#8ac0d9] text-center h-full flex flex-col">
                      <TypewriterText text={apiResponse} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Panel de control simplificado */}
          <div className="space-y-3">
            <div className="flex items-start gap-4 bg-[#232c39]/90 p-3 rounded-md border border-[#8d7481]
                          backdrop-blur-md shadow-inner">
              {/* Botón de Reset */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1">
                <button
                  onClick={onReset}
                  className="w-11 h-11 rounded-sm bg-[#232c39] shadow-md
                           border border-[#8ac0d9]/40 group relative
                           hover:bg-[#232c39]/80 active:shadow-inner
                           transition-all duration-200"
                  aria-label="Reset"
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 flex items-center justify-center">
                      <div className="w-4 h-1 bg-[#8ac0d9] group-hover:rotate-90 transition-transform"></div>
                    </div>
                  </div>
                </button>
                <span className="text-[#d9c6c7] text-[10px] font-mono">RESET</span>
              </div>

              <div className="flex-1 space-y-2">
                {/* Input simplificado */}
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    !isAuthenticated ? "" :
                    disabled ? "" :
                    isFirstInteraction ? "Enter language..." : 
                    "Write your message..."
                  }
                  className="w-full bg-[#232c39] text-[#8ac0d9] border border-[#8ac0d9]/30
                           placeholder:text-[#8a97b6]/50 focus:border-[#8ac0d9]
                           rounded-sm px-3 py-2 text-sm shadow-inner"
                />
                
                {/* Botón simplificado */}
                <Button 
                  onClick={onSend} 
                  disabled={!message}
                  className="w-full bg-[#232c39] hover:bg-[#232c39]/90
                           text-[#8ac0d9] py-2 rounded-sm 
                           border border-[#8ac0d9]/40
                           disabled:opacity-50 disabled:border-[#8d7481]/30
                           transition-all duration-200"
                >
                  Send
                </Button>
              </div>
            </div>

            {/* Opciones de interacción */}
            {!isFirstInteraction && messageCount > 0 && messageCount < 7 && !disabled && (
              <div className="bg-[#232c39]/90 p-3 rounded-md border border-[#8d7481] shadow-inner">
                <InteractionOptions 
                  onSelect={(option) => {
                    setMessage(option);
                    onSend();
                  }}
                  messageCount={messageCount}
                  selectedLanguage={selectedLanguage}
                  gameOptions={gameOptions}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InteractionOptions({ 
  onSelect, 
  messageCount, 
  selectedLanguage,
  gameOptions
}: { 
  onSelect: (option: string) => void;
  messageCount: number;
  selectedLanguage: string;
  gameOptions: GameOptions;
}) {
  const language = gameOptions.languages.find(lang => lang.code === selectedLanguage);
  const currentOptions = language?.interactions?.[messageCount - 1]?.options || [];

  return (
    <div className="grid grid-cols-3 gap-3 w-full select-none">
      {currentOptions.map((option) => (
        <button
          key={option.code}
          onClick={() => onSelect(option.name)}
          className="w-full px-3 py-2 rounded-sm
                   bg-[#232c39]/80 text-[#8ac0d9]
                   hover:bg-[#232c39] hover:-translate-y-1
                   border border-[#8ac0d9]/30
                   text-[11px] font-medium leading-tight
                   min-h-[3rem] transition-all duration-200
                   flex items-center justify-center"
        >
          <span className="text-center">
            {option.name}
          </span>
        </button>
      ))}
    </div>
  );
}

function MenuButton({ isOpen, onClick, className = "" }: { 
  isOpen: boolean; 
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        z-50
        rounded-sm
        bg-[#232c39]/90 
        hover:bg-[#232c39]
        border border-[#8ac0d9]/30
        flex flex-col items-center justify-center
        gap-1.5 p-2.5
        transition-all duration-200
        ${isOpen ? 'bg-[#232c39]' : ''}
        ${className}
      `}
    >
      <div className={`w-full h-[2px] bg-[#8ac0d9] transition-all duration-200 ${isOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
      <div className={`w-full h-[2px] bg-[#8ac0d9] transition-all duration-200 ${isOpen ? 'opacity-0' : ''}`} />
      <div className={`w-full h-[2px] bg-[#8ac0d9] transition-all duration-200 ${isOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
    </button>
  );
}

function Menu({ 
  isOpen, 
  onClose, 
  isAuthenticated, 
  onChangeWorld,
  freeChatMessages,
  onShowCredits,
  onShowProposal,
  className = "",
  onLogout
}: { 
  isOpen: boolean; 
  onClose: () => void;
  isAuthenticated: boolean;
  onChangeWorld: () => void;
  freeChatMessages: number;
  onShowCredits: () => void;
  onShowProposal: () => void;
  className?: string;
  onLogout: () => void;
}) {
  return (
    <div className={`
      absolute top-0 right-0 z-40
      w-48 bg-[#232c39]/95 rounded-sm
      border border-[#8ac0d9]/30
      transform transition-all duration-200
      ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      overflow-hidden
      select-none
      pointer-events-auto
      shadow-md shadow-[#232c39]/50
      ${className}
    `}>
      <div className="p-2 space-y-1">
        <button
          onClick={() => {
            onShowCredits();
            onClose();
          }}
          className="w-full text-left px-3 py-2 text-[#8ac0d9] hover:bg-[#455464]/50 rounded-sm text-sm select-none
                   border-l-2 border-transparent hover:border-[#8ac0d9]/40 transition-colors
                   flex items-center gap-2 group"
        >
          <span className="text-[#8ac0d9] group-hover:text-[#8ac0d9] transition-colors">✧</span>
          <span>Credits</span>
        </button>
        
        {isAuthenticated && (
          <>
            <button
              onClick={() => {
                onChangeWorld();
                onClose();
              }}
              className="w-full text-left px-3 py-2 text-[#8ac0d9] hover:bg-[#455464]/50 rounded-sm text-sm select-none
                       border-l-2 border-transparent hover:border-[#8ac0d9]/40 transition-colors
                       flex items-center gap-2 group"
            >
              <span className="text-[#8ac0d9] group-hover:text-[#8ac0d9] transition-colors">💭</span>
              <span>Explore more</span>
            </button>

            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full text-left px-3 py-2 text-[#f85149] hover:bg-[#455464]/50 rounded-sm text-sm select-none
                       border-l-2 border-transparent hover:border-[#f85149]/40 transition-colors
                       flex items-center gap-2 group"
            >
              <span className="text-[#f85149] group-hover:text-[#f85149] transition-colors">🚪</span>
              <span>Logout</span>
            </button>
          </>
        )}

        {freeChatMessages >= 4 && (
          <button
            onClick={() => {
              onShowProposal();
              onClose();
            }}
            className="w-full text-left px-3 py-2 text-[#8ac0d9] hover:bg-[#455464]/50 rounded-sm text-sm select-none
                     border-l-2 border-transparent hover:border-[#8ac0d9]/40 transition-colors"
          >
            Send Proposal
          </button>
        )}
      </div>
    </div>
  );
}
