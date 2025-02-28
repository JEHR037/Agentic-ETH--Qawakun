"use client";

import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { Input } from "../components/ui/input"
import { useSession } from "next-auth/react";
import sdk, {
  type Context,
} from "@farcaster/frame-sdk";
import { Button } from "~/components/ui/Button";
import { usePrivy, useWallets } from '@privy-io/react-auth';
import gameOptions from '~/data/gameOptions.json';
import ProposalsView from './ProposalsView';
import { Proposal } from "~/types/interfaces";

export default function Demo({ title }: { title?: string } = { title: "Qawakun" }) {
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
  
  const { data: session } = useSession();
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  
  const author = session?.user?.fid || wallets?.[0]?.address || "anonymous";
  const isAuthenticated = !!session || authenticated;

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
      setApiResponse("Congratulations! You have obtained your Qawakun. Take care of it and stay connected to the Ankanet!");
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

  // Asegurarnos de que author sea siempre string
  const authorString = typeof author === 'number' ? author.toString() : author;

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
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
              className="absolute -left-12 top-8 w-10 h-10
                         bg-[#1a1812]/50 hover:bg-[#1a1812]/70
                         border border-[#f8c20b]/30 rounded-lg
                         flex items-center justify-center
                         transition-all duration-200
                         group"
            >
              <div className="transform transition-transform group-hover:scale-110">
                <span className="text-[#f8c20b] text-xl">🗳️</span>
              </div>
            </button>

            {showProposalsView ? (
              <ProposalsView />
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
                showCreditsModal={showCreditsModal}
                setShowCreditsModal={setShowCreditsModal}
                showProposalModal={showProposalModal}
                setShowProposalModal={setShowProposalModal}
                hasActiveProposal={hasActiveProposal}
                setHasActiveProposal={setHasActiveProposal}
                onChangeWorld={handleChangeWorld}
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

          {messageCount >= 6 && !hasClaimed && (
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

          {/* Nuevo botón para Make a Proposal */}
          {isFreeChat && freeChatMessages >= 4 && (
            <Button
              onClick={() => setShowProposalModal(true)}
              className="w-full mt-4 bg-gradient-to-r from-[#f8d54b] to-[#8b7435]
                       hover:from-[#f8d54b]/80 hover:to-[#8b7435]/80
                       text-[#1a1812] font-bold py-3 rounded-lg
                       transition-all duration-200
                       shadow-lg shadow-[#f8d54b]/20
                       border border-[#f8d54b]/10
                       relative"
            >
              MAKE A PROPOSAL
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
              You have successfully claimed your Qawakun NFT! 
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
              <p>Created by the Qawakun Team</p>
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
                          hover:bg-[#f8c20b]/90 transition-colors"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Propuesta */}
      {showProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gradient-to-b from-[#5d490d] to-[#040404] p-6 rounded-3xl 
                         shadow-2xl border border-[#f8c20b] max-w-md w-full overflow-y-auto max-h-[90vh]">
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
                  <option value="LAWS">Laws of World</option>
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
                  placeholder="How can we contact you? (Discord, Twitter, etc.)"
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
                onClick={async () => {
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
                        timestamp: timestamp,
                        status: 1
                      }),
                    });

                    if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.error || 'Failed to submit proposal');
                    }

                    setShowProposalModal(false);
                    setProposalData({ type: '', description: '', flexibility: 5, contact: '' });
                    setApiResponse("Thank you for your proposal! We'll review it carefully.");
                  } catch (error) {
                    console.error('Error submitting proposal:', error);
                    setApiResponse("Error submitting proposal. Please try again.");
                  }
                }}
                className="flex-1 bg-[#f8c20b] text-[#040404] px-4 py-2 rounded-lg
                          hover:bg-[#f8c20b]/90 transition-colors"
                disabled={!proposalData.type || !proposalData.description || !proposalData.contact}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TypewriterText({ text }: { text: string }) {
  const [currentPage, setCurrentPage] = useState(0);
  const CHARS_PER_PAGE = 150; // Ajusta este número según lo que se vea mejor en la pantalla
  
  const pages = useMemo(() => {
    const words = text.split(' ');
    const pages = [];
    let currentPage = '';
    
    for (const word of words) {
      if ((currentPage + ' ' + word).length <= CHARS_PER_PAGE) {
        currentPage += (currentPage ? ' ' : '') + word;
      } else {
        pages.push(currentPage);
        currentPage = word;
      }
    }
    if (currentPage) {
      pages.push(currentPage);
    }
    return pages;
  }, [text]);

  const hasMultiplePages = pages.length > 1;

  return (
    <div className="flex flex-col items-center space-y-4 select-none">
      <div className="whitespace-pre-wrap break-words min-h-[200px] flex items-center justify-center select-none">
        {pages[currentPage] || ''}
      </div>
      
      {hasMultiplePages && (
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
            className={`
              relative px-4 py-2 rounded-lg
              ${currentPage === 0 
                ? 'bg-[#1a1812]/50 text-[#f8c20b]/50' 
                : 'bg-[#1a1812]/50 text-[#f8c20b] hover:bg-[#1a1812]/70'}
              transition-all duration-200
              border border-[#f8c20b]/30
              disabled:cursor-not-allowed
            `}
          >
            ◀
          </button>
          
          <span className="text-[#f8c20b] text-sm">
            {currentPage + 1} / {pages.length}
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(pages.length - 1, prev + 1))}
            disabled={currentPage === pages.length - 1}
            className={`
              relative px-4 py-2 rounded-lg
              ${currentPage === pages.length - 1 
                ? 'bg-[#1a1812]/50 text-[#f8c20b]/50' 
                : 'bg-[#1a1812]/50 text-[#f8c20b] hover:bg-[#1a1812]/70'}
              transition-all duration-200
              border border-[#f8c20b]/30
              disabled:cursor-not-allowed
            `}
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
}

function LanguageSelector({ onSelect }: { onSelect: (language: string) => void }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const languages = [
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' }
  ];

  // Manejar navegación con teclado
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : languages.length - 1));
      } else if (e.key === 'ArrowDown') {
        setSelectedIndex(prev => (prev < languages.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'Enter') {
        onSelect(languages[selectedIndex].code);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedIndex, languages, onSelect]);

  return (
    <div className="relative flex flex-col items-center">
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="w-full h-full opacity-10"
             style={{
               backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='1' height='1' fill='%23f8c20b'/%3E%3C/svg%3E")`,
               backgroundSize: '20px 20px'
             }}
        />
      </div>
      
      <div className="relative z-10 space-y-4 py-8">
        <h3 className="text-[#f8c20b] text-xl font-bold text-center mb-6">
          Select Your Language
        </h3>
        
        {languages.map((lang, index) => (
          <div
            key={lang.code}
            onClick={() => {
              setSelectedIndex(index);
              onSelect(lang.code);
            }}
            className={`
              relative cursor-pointer px-8 py-3
              transform transition-all duration-200
              ${selectedIndex === index ? 'scale-110' : 'scale-100'}
            `}
          >
            {/* Flecha indicadora */}
            {selectedIndex === index && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 text-[#f8c20b] animate-bounce">
                ▶
              </div>
            )}
            
            {/* Botón de idioma */}
            <div
              className={`
                relative px-6 py-2 rounded-lg
                ${selectedIndex === index 
                  ? 'bg-gradient-to-r from-[#f8c20b] to-[#5d490d] text-[#1a1812]' 
                  : 'bg-[#1a1812]/50 text-[#f8c20b]'}
                transition-all duration-200
                hover:shadow-lg hover:shadow-[#f8c20b]/20
                border border-[#f8c20b]/30
              `}
            >
              <span className="relative z-10 font-medium">
                {lang.name}
              </span>
              
              {/* Efecto de brillo */}
              {selectedIndex === index && (
                <div className="absolute inset-0 bg-gradient-to-r from-[#f8c20b]/0 via-[#f8c20b]/30 to-[#f8c20b]/0 animate-shine" />
              )}
            </div>
          </div>
        ))}
      </div>
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
  freeChatMessages,
  isMenuOpen,
  setIsMenuOpen,
  setShowCreditsModal,
  setShowProposalModal,
  onChangeWorld,
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
  showCreditsModal: boolean;
  setShowCreditsModal: (value: boolean) => void;
  showProposalModal: boolean;
  setShowProposalModal: (value: boolean) => void;
  hasActiveProposal: boolean;
  setHasActiveProposal: (value: boolean) => void;
  onChangeWorld: () => void;
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
          />
        </div>
      )}

      <div ref={containerRef} className={`
        bg-gradient-to-b from-[#5d490d] to-[#040404]
        p-6 rounded-3xl shadow-2xl 
        border border-[#7c7c7c]
        w-[290px] mx-auto
        ${!isAuthenticated || (disabled && !isFreeChat) ? 'opacity-50 pointer-events-none' : ''}
        relative
        select-none
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
                  <div className="font-mono text-[#f8c20b] text-center">
                    <TypewriterText text={apiResponse} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-6 bg-[#040404]/50 p-4 rounded-xl border border-[#545454]">
              <div className="flex-shrink-0 flex flex-col items-center gap-1">
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

            {!isFirstInteraction && messageCount > 0 && messageCount < 7 && !disabled && (
              <div className="bg-[#040404]/50 p-4 rounded-xl border border-[#545454]">
                <InteractionOptions 
                  onSelect={(option) => {
                    setMessage(option);
                    onSend();
                  }}
                  messageCount={messageCount}
                  selectedLanguage={selectedLanguage}
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
  selectedLanguage 
}: { 
  onSelect: (option: string) => void;
  messageCount: number;
  selectedLanguage: string;
}) {
  const language = gameOptions.languages.find(lang => lang.code === selectedLanguage);
  const currentOptions = language?.interactions[messageCount - 1]?.options || [];

  return (
    <div className="grid grid-cols-3 gap-3 w-full select-none">
      {currentOptions.map((option) => (
        <button
          key={option.code}
          onClick={() => onSelect(option.name)}
          className={`
            w-full
            relative px-3 py-2 rounded-lg
            bg-[#1a1812]/50 text-[#f8c20b]
            transition-all duration-200
            hover:bg-[#1a1812]/70
            hover:shadow-lg hover:shadow-[#f8c20b]/20
            border border-[#f8c20b]/30
            text-[11px] font-medium
            transform hover:scale-105
            flex items-center justify-center
            min-h-[3rem]
            leading-tight
          `}
        >
          <span className="relative z-10 text-center px-1">
            {option.name}
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-[#f8c20b]/0 via-[#f8c20b]/5 to-[#f8c20b]/0 rounded-lg" />
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
        rounded-lg
        bg-[#1a1812]/50 
        hover:bg-[#1a1812]/70
        border border-[#f8c20b]/30
        flex flex-col items-center justify-center
        gap-1.5 p-2.5
        transition-all duration-200
        ${isOpen ? 'bg-[#1a1812]/70' : ''}
        ${className}
      `}
    >
      <div className={`w-full h-[2px] bg-[#f8c20b] transition-all duration-200 ${isOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
      <div className={`w-full h-[2px] bg-[#f8c20b] transition-all duration-200 ${isOpen ? 'opacity-0' : ''}`} />
      <div className={`w-full h-[2px] bg-[#f8c20b] transition-all duration-200 ${isOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
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
  className = ""
}: { 
  isOpen: boolean; 
  onClose: () => void;
  isAuthenticated: boolean;
  onChangeWorld: () => void;
  freeChatMessages: number;
  onShowCredits: () => void;
  onShowProposal: () => void;
  className?: string;
}) {
  return (
    <div className={`
      absolute top-0 right-0 z-40
      w-48 bg-[#1a1812]/95 rounded-lg
      border border-[#f8c20b]/30
      transform transition-all duration-200
      ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      overflow-hidden
      select-none
      pointer-events-auto
      ${className}
    `}>
      <div className="p-2 space-y-1">
        <button
          onClick={() => {
            onShowCredits();
            onClose();
          }}
          className="w-full text-left px-3 py-2 text-[#f8c20b] hover:bg-[#f8c20b]/10 rounded-lg text-sm select-none"
        >
          Credits
        </button>
        
        {isAuthenticated && (
          <button
            onClick={() => {
              onChangeWorld();
              onClose();
            }}
            className="w-full text-left px-3 py-2 text-[#f8c20b] hover:bg-[#f8c20b]/10 rounded-lg text-sm select-none"
          >
            Change the World
          </button>
        )}

        {freeChatMessages >= 4 && (
          <button
            onClick={() => {
              onShowProposal();
              onClose();
            }}
            className="w-full text-left px-3 py-2 text-[#f8c20b] hover:bg-[#f8c20b]/10 rounded-lg text-sm select-none"
          >
            Send Proposal
          </button>
        )}
      </div>
    </div>
  );
}
