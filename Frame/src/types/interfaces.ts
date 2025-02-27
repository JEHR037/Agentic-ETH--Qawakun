export interface ProposalData {
  type: string;
  description: string;
  flexibility: number;
  contact: string;
}

export interface GameboyInterfaceProps {
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
}

export interface Proposal {
  wallet: string;
  fid?: number;
  proposal_type: string;
  description: string;
  message_history: string[];
  contact: string;
  flexibility: number;
  timestamp: string;
  status: number;
}

export interface ContractProposal {
  id: string;
  proposer: string;
  proposal_type: number;
  description: string;
  conversation: string;
  timestamp: string;
  approval_count: string;
  rejection_count: string;
  status: number;
} 