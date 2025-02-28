"use client";
import { useEffect, useState } from 'react';
import { Button } from "~/components/ui/Button";

interface Proposal {
  wallet: string;
  proposal_type: string;
  description: string;
  flexibility: number;
  status: number;
  timestamp: string;
}

export default function ProposalsView() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProposals = async () => {
      try {
        const response = await fetch('/api/proposal');
        if (!response.ok) return;
        const data = await response.json();
        setProposals(data.filter((p: Proposal) => p.status === 3));
      } catch (err) {
        console.error('Error fetching proposals:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProposals();
  }, []);

  return (
    <div className="min-h-screen w-full bg-cover bg-center bg-no-repeat"
         style={{ backgroundImage: 'url("/container11.jpg")' }}>
      <div className="w-[400px] mx-auto py-2 px-2">
        <div className="bg-gradient-to-b from-[#5d490d] to-[#040404] p-6 rounded-3xl shadow-2xl 
                      border border-[#7c7c7c] relative">
          <h2 className="text-2xl font-bold text-center mb-6 text-[#f8c20b]">
            Active Proposals
          </h2>

          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f8c20b]"></div>
            </div>
          ) : proposals.length === 0 ? (
            <p className="text-center text-[#f8c20b]/80 p-8">
              No proposals available for voting at this time.
            </p>
          ) : (
            <div className="space-y-4">
              {proposals.map((proposal) => (
                <div key={`${proposal.wallet}-${proposal.timestamp}`}
                     className="bg-[#1a1812]/50 p-4 rounded-lg border border-[#f8c20b]/30">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[#f8c20b] font-medium">
                      {proposal.proposal_type}
                    </span>
                    <span className="text-[#f8c20b]/60 text-sm">
                      {new Date(proposal.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[#f8c20b]/90 mb-4">
                    {proposal.description}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-[#f8c20b]/60 text-sm">
                      Flexibility: {proposal.flexibility}/10
                    </span>
                    <div className="space-x-2">
                      <Button
                        onClick={() => {/* TODO: Implementar votación */}}
                        className="bg-[#2da44e] text-white px-4 py-1 rounded
                                 hover:bg-[#2da44e]/90 transition-colors"
                      >
                        Approve
                      </Button>
                      <Button
                        onClick={() => {/* TODO: Implementar votación */}}
                        className="bg-[#cf222e] text-white px-4 py-1 rounded
                                 hover:bg-[#cf222e]/90 transition-colors"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 