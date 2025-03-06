"use client";
import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from "~/components/ui/Button";

interface Proposal {
  wallet: string;
  proposal_type: string;
  description: string;
  message_history: string[];
  contact: string;
  flexibility: number;
  timestamp: string;
  status: number;
  votes?: number;
  voters?: string[];
}


export default function ProposalsView() {
  const { user, authenticated, login } = usePrivy();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para la votación
  const [isVoting, setIsVoting] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/proposal');
      if (!response.ok) throw new Error('Failed to load proposals');
      const data = await response.json();
      
      // Ordenar propuestas: primero las que están en votación (status 3)
      const sortedProposals = data.sort((a: Proposal, b: Proposal) => {
        if (a.status === 3 && b.status !== 3) return -1;
        if (a.status !== 3 && b.status === 3) return 1;
        // Si ambas tienen el mismo status, ordenar por timestamp (más recientes primero)
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      
      setProposals(sortedProposals);
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };
  
  const handleVote = async (proposal: Proposal) => {
    // Limpiar mensajes anteriores
    setVoteSuccess(null);
    setVoteError(null);
    
    // Verificar si el usuario está autenticado
    if (!authenticated || !user?.wallet?.address) {
      setVoteError('Por favor conecta tu wallet para votar');
      login();
      return;
    }
    
    // Verificar si el usuario ya ha votado esta propuesta
    if (proposal.voters?.includes(user.wallet.address)) {
      setVoteError('Ya has votado por esta propuesta');
      return;
    }
    
    try {
      setIsVoting(true);
      
      const response = await fetch('/api/proposal/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          proposalWallet: proposal.wallet,
          voterWallet: user.wallet.address
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Error al procesar el voto');
      }
      
      // Mostrar mensaje de éxito
      setVoteSuccess('¡Voto registrado! Iniciando proceso de minteo de NFT...');
      
      // Similar a Demo.tsx, esperar para dar tiempo al proceso de minteo
      // El minteo puede tardar hasta 3 segundos (3000ms)
      setTimeout(async () => {
        try {
          // Recargar propuestas para actualizar los contadores
          await loadProposals();
          
          // Actualizar mensaje
          setVoteSuccess('¡NFT minteado exitosamente! Gracias por tu voto.');
          
          // Cerrar el modal después de un tiempo adicional para que el usuario vea el mensaje
          setTimeout(() => {
            setSelectedProposal(null);
            setVoteSuccess(null);
          }, 3000);
        } catch (error) {
          console.error('Error al recargar propuestas:', error);
          // No mostrar este error al usuario ya que el voto fue exitoso
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error al votar:', error);
      setVoteError(error instanceof Error ? error.message : 'Error al procesar el voto');
    } finally {
      setIsVoting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f8c20b]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4">
        {error}
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="text-center p-10">
        <p className="text-[#f8c20b]/80 text-xl">No proposals found in voting phase</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-[#f8c20b] text-2xl font-bold mb-8">Proposals in Voting</h1>
      
      {/* Grid de propuestas - mejorado para responsive */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {proposals.map((proposal) => (
          <div
            key={proposal.wallet}
            className="bg-[#1a1812]/30 rounded-lg p-6 border border-[#f8c20b]/10 hover:border-[#f8c20b]/30 transition-all h-full flex flex-col"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-[#f8c20b] text-lg font-semibold">
                {proposal.proposal_type}
              </h3>
              <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(proposal.status)}`}>
                {getStatusText(proposal.status)}
              </span>
            </div>
            <p className="text-[#f8c20b]/80 mb-6 line-clamp-3 flex-grow">
              {proposal.description}
            </p>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-auto pt-4 border-t border-[#f8c20b]/10">
              <span className="text-sm text-[#f8c20b]/60">
                {new Date(proposal.timestamp).toLocaleDateString()}
              </span>
              <Button 
                onClick={() => setSelectedProposal(proposal)}
                className="bg-[#f8c20b]/20 hover:bg-[#f8c20b]/30 text-[#f8c20b] border border-[#f8c20b]/30 px-5 py-2 w-full sm:w-auto"
              >
                View Details
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal - Optimizado para todos los tamaños de pantalla */}
      {selectedProposal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[9999] overflow-hidden">
          <div 
            className="bg-[#1a1812] rounded-xl border border-[#f8c20b]/20 w-full max-w-5xl max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: '0 0 30px rgba(248, 194, 11, 0.1)' }}
          >
            {/* Header - Fixed para que siempre sea visible */}
            <div className="sticky top-0 bg-[#1a1812] py-6 px-6 lg:px-8 border-b border-[#f8c20b]/10 z-[9999] flex justify-between items-center">
              <h2 className="text-[#f8c20b] text-xl md:text-2xl font-bold truncate pr-4">
                {selectedProposal.proposal_type}
              </h2>
              <button
                onClick={() => setSelectedProposal(null)}
                className="bg-[#1a1812] hover:bg-[#1a1812]/80 text-[#f8c20b] rounded-full w-10 h-10 flex items-center justify-center text-xl transition-colors border border-[#f8c20b]/20 flex-shrink-0"
              >
                ✕
              </button>
            </div>
            
            {/* Status bar */}
            <div className="bg-[#1a1812]/80 px-6 lg:px-8 py-3 border-b border-[#f8c20b]/10">
              <div className="flex flex-wrap items-center gap-4">
                <span className={`px-4 py-1 rounded-full text-sm ${getStatusColor(selectedProposal.status)}`}>
                  {getStatusText(selectedProposal.status)}
                </span>
                <span className="text-[#f8c20b]/60 text-sm">
                  Submitted by {truncateAddress(selectedProposal.wallet)}
                </span>
              </div>
            </div>

            {/* Content - Con padding responsivo */}
            <div className="p-6 lg:p-8 space-y-8">
              {/* Description Section */}
              <section>
                <h3 className="text-[#f8c20b] text-xl font-semibold mb-4">Description</h3>
                <div className="bg-[#1a1812]/50 p-4 md:p-6 rounded-lg border border-[#f8c20b]/10">
                  <p className="text-[#f8c20b]/80 text-base md:text-lg leading-relaxed whitespace-pre-wrap">
                    {selectedProposal.description}
                  </p>
                </div>
              </section>

              {/* Message History Section */}
              <section>
                <h3 className="text-[#f8c20b] text-xl font-semibold mb-4">Message History</h3>
                <div className="space-y-4">
                  {selectedProposal.message_history && selectedProposal.message_history.length > 0 ? (
                    selectedProposal.message_history.map((message, index) => (
                      <div 
                        key={index} 
                        className="bg-[#1a1812]/50 p-4 md:p-6 rounded-lg border border-[#f8c20b]/10"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[#f8c20b]/40 text-sm">Message {index + 1}</span>
                          <div className="flex-1 h-px bg-[#f8c20b]/10"></div>
                        </div>
                        <p className="text-[#f8c20b]/80 leading-relaxed whitespace-pre-wrap">
                          {message}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[#f8c20b]/60 italic">No message history available</p>
                  )}
                </div>
              </section>

              {/* Details Section - Layout mejorado para móviles */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div>
                  <h3 className="text-[#f8c20b] text-xl font-semibold mb-4">Contact Information</h3>
                  <div className="bg-[#1a1812]/50 p-4 md:p-6 rounded-lg border border-[#f8c20b]/10">
                    <p className="text-[#f8c20b]/80">
                      {selectedProposal.contact || 'No contact information provided'}
                    </p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-[#f8c20b] text-xl font-semibold mb-4">Flexibility Score</h3>
                  <div className="bg-[#1a1812]/50 p-4 md:p-6 rounded-lg border border-[#f8c20b]/10">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-3 bg-[#1a1812] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#f8c20b] transition-all duration-500"
                            style={{ width: `${(selectedProposal.flexibility || 0) * 10}%` }}
                          />
                        </div>
                        <span className="text-[#f8c20b] font-semibold text-lg min-w-[3ch]">
                          {selectedProposal.flexibility}/10
                        </span>
                      </div>
                      <p className="text-[#f8c20b]/60 text-sm">
                        Flexibility score indicates how adaptable this proposal is to changes
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Metadata Section */}
              <section className="border-t border-[#f8c20b]/10 pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <h4 className="text-[#f8c20b]/60 text-sm mb-1">Submitted On</h4>
                    <p className="text-[#f8c20b]/80">
                      {new Date(selectedProposal.timestamp).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-[#f8c20b]/60 text-sm mb-1">Wallet Address</h4>
                    <p className="text-[#f8c20b]/80 font-mono">
                      {truncateAddress(selectedProposal.wallet)}
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {/* Mostrar mensajes de error o éxito */}
            {(voteSuccess || voteError) && (
              <div className={`mx-6 lg:mx-8 my-4 p-4 rounded-lg ${
                voteSuccess ? 'bg-green-900/50 text-green-200' : 'bg-red-900/50 text-red-200'
              }`}>
                {voteSuccess || voteError}
              </div>
            )}

            {/* Footer con botones de acción - adaptado para móviles */}
            <div className="sticky bottom-0 bg-[#1a1812] px-6 lg:px-8 py-4 border-t border-[#f8c20b]/10 flex flex-col sm:flex-row justify-end items-center gap-3 sm:gap-4">
              <Button
                onClick={() => setSelectedProposal(null)}
                className="bg-transparent border border-[#f8c20b]/30 text-[#f8c20b] hover:bg-[#f8c20b]/10 w-full sm:w-auto order-2 sm:order-1"
                disabled={isVoting}
              >
                Close
              </Button>
              <Button
                onClick={() => handleVote(selectedProposal)}
                disabled={isVoting || !authenticated}
                className="bg-[#f8c20b] text-black hover:bg-[#f8c20b]/90 w-full sm:w-auto order-1 sm:order-2 relative"
              >
                {isVoting ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2"></div>
                    Procesando...
                  </div>
                ) : authenticated ? (
                  'Votar por esta propuesta'
                ) : (
                  'Conectar para votar'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusText(status: number): string {
  switch (status) {
    case 1: return 'New';
    case 2: return 'In Review';
    case 3: return 'In Voting';
    case 4: return 'Rejected';
    case 5: return 'Winner';
    default: return 'Unknown';
  }
}

function getStatusColor(status: number): string {
  switch (status) {
    case 1: return 'bg-blue-900/50 text-blue-300';
    case 2: return 'bg-yellow-900/50 text-yellow-300';
    case 3: return 'bg-purple-900/50 text-purple-300';
    case 4: return 'bg-red-900/50 text-red-300';
    case 5: return 'bg-green-900/50 text-green-300';
    default: return 'bg-gray-900/50 text-gray-300';
  }
}

function truncateAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
} 