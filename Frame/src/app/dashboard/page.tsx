'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '../utils/clientAuth';
import { useAdminProtection } from '~/middleware/authMiddleware';

interface Proposal {
  wallet: string;
  proposal_type: string;
  description: string;
  message_history: string[];
  contact: string;
  flexibility: number;
  timestamp: string;
  status: number;
  votes: number;
  voters: string[];
}

type TabType = 'review' | 'voting' | 'winners';

export default function DashboardPage() {
  const { isAdmin } = useAdminProtection();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('review');
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const { ready, authenticated, user } = usePrivy();
  const router = useRouter();

  const loadProposals = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/proposal');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load proposals');
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format: expected array');
      }

      setProposals(data);
    } catch (error) {
      console.error('Error loading proposals:', error);
      setError(error instanceof Error ? error.message : 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/');
    } else if (ready && authenticated) {
      loadProposals();
    }
  }, [ready, authenticated]);

  useEffect(() => {
    if (user?.wallet?.address) {
      console.log('Tu wallet address:', user.wallet.address);
    }
  }, [user]);

  const handleReject = async (proposal: Proposal) => {
    try {
      const response = await fetch(`/api/proposal/${proposal.wallet}/4`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      if (!response.ok) throw new Error('Failed to reject proposal');
      
      await loadProposals();
      setSelectedProposal(null);
    } catch (err) {
      console.error('Error rejecting proposal:', err);
      setError('Failed to reject proposal');
    }
  };

  const handleDelete = async (proposal: Proposal) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/proposal', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          wallet: proposal.wallet
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete proposal');
      }

      await loadProposals(); // Recargar propuestas después de eliminar
      setSelectedProposal(null);
      setSuccess('Proposal successfully deleted');
    } catch (error) {
      console.error('Error deleting proposal:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete proposal');
    } finally {
      setLoading(false);
    }
  };

  const handleElevate = async (proposal: Proposal) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      // Actualizar el estado en Redis
      const updateResponse = await fetch('/api/proposal', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          wallet: proposal.wallet,
          status: 3,  // Cambiar a estado de votación
          votes: 0,   // Inicializar contador de votos
          voters: []  // Inicializar lista de votantes
        })
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update proposal status');
      }

      await loadProposals();
      setSelectedProposal(null);
      setSuccess('Proposal successfully moved to voting phase');
    } catch (error) {
      console.error('Error updating proposal:', error);
      setError(error instanceof Error ? error.message : 'Failed to update proposal');
    } finally {
      setLoading(false);
    }
  };

  const filteredProposals = proposals.filter(proposal => {
    switch (activeTab) {
      case 'review': 
        // Propuestas en revisión (status 1 o 2)
        return proposal.status === 1 || proposal.status === 2;
      case 'voting': 
        // Propuestas en votación (status 3)
        return proposal.status === 3;
      case 'winners': 
        // Propuestas ganadoras (status 5)
        return proposal.status === 5;
      default: 
        return false;
    }
  });

  if (!ready || loading) {
    return (
      <div className="min-h-screen w-full flex justify-center items-center bg-cover bg-center bg-no-repeat"
           style={{ backgroundImage: 'url("/container11.jpg")' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f8c20b]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen w-full flex justify-center items-center bg-cover bg-center bg-no-repeat"
           style={{ backgroundImage: 'url("/container11.jpg")' }}>
        <div className="bg-gradient-to-b from-[#5d490d] to-[#040404] p-6 rounded-3xl shadow-2xl 
                    border border-[#7c7c7c] text-center">
          <p className="text-[#f8c20b] mb-4">You don't have permission to access this page.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-[#f8c20b] text-black px-6 py-2 rounded-lg hover:bg-[#f8c20b]/80
                     transition-colors font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-cover bg-center bg-no-repeat py-8"
         style={{ backgroundImage: 'url("/container11.jpg")' }}>
      <div className="container mx-auto px-4">
        <div className="bg-gradient-to-b from-[#5d490d] to-[#040404] p-8 rounded-3xl 
                    shadow-2xl border border-[#7c7c7c]">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-center text-[#f8c20b]">
              Proposals Dashboard
            </h1>
            <span className="text-[#f8c20b]/60">
              {filteredProposals.length} proposal(s) found
            </span>
          </div>

          {/* Tabs */}
          <div className="flex justify-center mb-8 space-x-4">
            {(['review', 'voting', 'winners'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedProposal(null);
                }}
                className={`px-6 py-2 rounded-lg transition-colors
                  ${activeTab === tab 
                    ? 'bg-[#f8c20b] text-black font-medium' 
                    : 'bg-[#1a1812]/50 text-[#f8c20b] hover:bg-[#1a1812]/70'}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-500">
              {error}
              <button onClick={loadProposals} className="ml-4 underline hover:no-underline">
                Retry
              </button>
            </div>
          )}

          {success && (
            <div className="mb-8 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-500">
              {success}
            </div>
          )}

          <div className="space-y-4">
            {filteredProposals.length === 0 ? (
              <p className="text-center text-[#f8c20b]/80 p-8">
                No proposals found in {activeTab}.
              </p>
            ) : selectedProposal ? (
              <ProposalDetail
                proposal={selectedProposal}
                onBack={() => setSelectedProposal(null)}
                onReject={activeTab === 'review' ? handleReject : undefined}
                onElevate={activeTab === 'review' ? handleElevate : undefined}
                onDelete={activeTab === 'review' ? handleDelete : undefined}
              />
            ) : (
              filteredProposals.map((proposal) => (
                <div key={proposal.wallet} 
                     onClick={() => setSelectedProposal(proposal)}
                     className="bg-[#1a1812]/50 p-4 rounded-lg border border-[#f8c20b]/30
                              cursor-pointer hover:bg-[#1a1812]/70 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[#f8c20b] font-medium">
                      {proposal.proposal_type}
                    </span>
                    <span className="text-[#f8c20b]/60 text-sm">
                      {new Date(proposal.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[#f8c20b]/90 mb-4 line-clamp-2">
                    {proposal.description}
                  </p>
                  <div className="text-[#f8c20b]/60 text-sm">
                    Wallet: {proposal.wallet.slice(0, 6)}...{proposal.wallet.slice(-4)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(proposal.status)}`}>
                      {getStatusText(proposal.status)}
                    </span>
                    {proposal.status === 3 && (
                      <span className="text-[#f8c20b]/60 text-sm">
                        Votes: {proposal.votes || 0}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProposalDetail({ 
  proposal, 
  onBack,
  onReject,
  onElevate,
  onDelete 
}: { 
  proposal: Proposal;
  onBack: () => void;
  onReject?: (proposal: Proposal) => Promise<void>;
  onElevate?: (proposal: Proposal) => Promise<void>;
  onDelete?: (proposal: Proposal) => Promise<void>;
}) {
  return (
    <div className="bg-[#1a1812]/50 p-8 rounded-xl border border-[#f8c20b]/30
                    backdrop-blur-sm shadow-xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-[#f8c20b]/20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-[#f8c20b] hover:text-[#f8c20b]/80 transition-colors
                     flex items-center gap-2 text-lg"
          >
            <span>←</span>
            <span>Back</span>
          </button>
          <div className="h-6 w-px bg-[#f8c20b]/20" />
          <span className="text-[#f8c20b]/60">
            Proposal Details
          </span>
        </div>
        {(onReject || onElevate || onDelete) && (
          <div className="space-x-3">
            {onDelete && (
              <button
                onClick={() => onDelete(proposal)}
                className="px-5 py-2.5 bg-[#2d1212] text-red-400 rounded-lg
                         hover:bg-[#3d1818] transition-colors border border-red-900/30
                         font-medium"
              >
                Delete Proposal
              </button>
            )}
            {onReject && (
              <button
                onClick={() => onReject(proposal)}
                className="px-5 py-2.5 bg-[#2d1212] text-red-400 rounded-lg
                         hover:bg-[#3d1818] transition-colors border border-red-900/30
                         font-medium"
              >
                Reject Proposal
              </button>
            )}
            {onElevate && (
              <button
                onClick={() => onElevate(proposal)}
                className="px-5 py-2.5 bg-[#f8c20b] text-black rounded-lg
                         hover:bg-[#f8c20b]/90 transition-colors
                         font-medium shadow-lg shadow-[#f8c20b]/10"
              >
                Send to Voting
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-8">
        {/* Main Info */}
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-[#f8c20b] font-medium mb-2 text-sm uppercase tracking-wider">
                Proposal Type
              </h3>
              <p className="text-[#f8c20b] text-xl font-semibold">
                {proposal.proposal_type}
              </p>
            </div>
            <div>
              <h3 className="text-[#f8c20b] font-medium mb-2 text-sm uppercase tracking-wider">
                Status
              </h3>
              <span className={`px-3 py-1 rounded-full text-sm font-medium
                ${getStatusColor(proposal.status)}`}>
                {getStatusText(proposal.status)}
              </span>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="text-[#f8c20b] font-medium mb-2 text-sm uppercase tracking-wider">
                Wallet Address
              </h3>
              <p className="text-[#f8c20b]/90 font-mono">
                {proposal.wallet}
              </p>
            </div>
            <div>
              <h3 className="text-[#f8c20b] font-medium mb-2 text-sm uppercase tracking-wider">
                Submitted On
              </h3>
              <p className="text-[#f8c20b]/90">
                {new Date(proposal.timestamp).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-[#1a1812]/30 p-6 rounded-lg border border-[#f8c20b]/10">
          <h3 className="text-[#f8c20b] font-medium mb-3 text-sm uppercase tracking-wider">
            Description
          </h3>
          <p className="text-[#f8c20b]/90 leading-relaxed">
            {proposal.description}
          </p>
        </div>

        {/* Message History */}
        {proposal.message_history && proposal.message_history.length > 0 && (
          <div className="bg-[#1a1812]/30 p-6 rounded-lg border border-[#f8c20b]/10">
            <h3 className="text-[#f8c20b] font-medium mb-4 text-sm uppercase tracking-wider">
              Message History
            </h3>
            <div className="space-y-3">
              {proposal.message_history.map((message, index) => (
                <div key={index} 
                     className="p-3 bg-[#1a1812]/50 rounded-lg border border-[#f8c20b]/5">
                  <p className="text-[#f8c20b]/80">{message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Info */}
        <div className="grid grid-cols-2 gap-8 bg-[#1a1812]/30 p-6 rounded-lg border border-[#f8c20b]/10">
          <div>
            <h3 className="text-[#f8c20b] font-medium mb-2 text-sm uppercase tracking-wider">
              Contact Information
            </h3>
            <p className="text-[#f8c20b]/90">
              {proposal.contact || 'N/A'}
            </p>
          </div>
          <div>
            <h3 className="text-[#f8c20b] font-medium mb-2 text-sm uppercase tracking-wider">
              Flexibility Score
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-[#1a1812]/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#f8c20b]"
                  style={{ width: `${(proposal.flexibility || 0) * 10}%` }}
                />
              </div>
              <span className="text-[#f8c20b]/90 font-medium">
                {proposal.flexibility || 0}/10
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Función auxiliar para mostrar el estado en texto
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

// Función auxiliar para colores de estado
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