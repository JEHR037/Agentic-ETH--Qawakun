// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract ProposalVoting is Ownable, ReentrancyGuard, Pausable {
    // Enums
    enum ProposalType { WORLD, CHARACTERS, LAWS }
    enum ProposalStatus { PENDING, ACTIVE, EXECUTED, REJECTED }

    // Estructuras
    struct Proposal {
        uint256 id;
        address proposer;
        ProposalType proposalType;
        string description;
        string conversation;    // Historial de conversación
        uint256 timestamp;
        uint256 approvalCount;
        uint256 rejectionCount;
        ProposalStatus status;
        bool exists;
    }

    struct Vote {
        bool hasVoted;
        bool support;
        uint256 timestamp;
    }

    // Variables de estado
    uint256 private _proposalCount;
    mapping(uint256 => Proposal) private _proposals;
    mapping(uint256 => mapping(address => Vote)) private _votes;
    mapping(uint256 => uint256[]) private _monthlyProposals; // mes -> [propuestas]
    mapping(uint256 => uint256[]) private _winningProposals; // mes -> [propuestas ganadoras]
    
    uint256 public constant VOTING_PERIOD = 30 days;
    uint256 public constant MIN_VOTING_POWER = 1; // Mínimo poder de voto requerido

    // Eventos
    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        ProposalType proposalType,
        string description,
        string conversation,
        uint256 timestamp
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 timestamp
    );

    event ProposalExecuted(
        uint256 indexed proposalId,
        uint256 approvalCount,
        uint256 rejectionCount,
        uint256 timestamp
    );

    event MonthlyWinnerSelected(
        uint256 indexed year,
        uint256 indexed month,
        uint256 indexed proposalId,
        uint256 approvalCount
    );

    event ProposalStatusChanged(
        uint256 indexed proposalId,
        ProposalStatus newStatus,
        uint256 timestamp
    );

    // Constructor
    constructor() Ownable(msg.sender) {
        _proposalCount = 0;
    }

    // Funciones principales
    function indexProposal(
        address _proposer,
        ProposalType _proposalType,
        string memory _description,
        string memory _conversation,
        uint256 _timestamp
    ) external onlyOwner whenNotPaused returns (uint256) {
        require(bytes(_description).length > 0, "Empty description");
        require(bytes(_conversation).length > 0, "Empty conversation");
        
        _proposalCount++;
        uint256 proposalId = _proposalCount;
        
        _proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: _proposer,
            proposalType: _proposalType,
            description: _description,
            conversation: _conversation,
            timestamp: _timestamp,
            approvalCount: 0,
            rejectionCount: 0,
            status: ProposalStatus.ACTIVE,
            exists: true
        });

        // Agregar a las propuestas del mes actual
        uint256 currentMonth = getCurrentMonth();
        _monthlyProposals[currentMonth].push(proposalId);

        emit ProposalCreated(
            proposalId,
            _proposer,
            _proposalType,
            _description,
            _conversation,
            _timestamp
        );

        return proposalId;
    }

    function vote(uint256 _proposalId, bool _support) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        require(_proposals[_proposalId].exists, "Proposal doesn't exist");
        require(_proposals[_proposalId].status == ProposalStatus.ACTIVE, "Proposal not active");
        require(!_votes[_proposalId][msg.sender].hasVoted, "Already voted");
        require(
            block.timestamp <= _proposals[_proposalId].timestamp + VOTING_PERIOD,
            "Voting period ended"
        );

        _votes[_proposalId][msg.sender] = Vote({
            hasVoted: true,
            support: _support,
            timestamp: block.timestamp
        });

        if (_support) {
            _proposals[_proposalId].approvalCount++;
        } else {
            _proposals[_proposalId].rejectionCount++;
        }

        emit VoteCast(_proposalId, msg.sender, _support, block.timestamp);
    }

    function executeMonthlySelection() 
        external 
        onlyOwner 
        whenNotPaused 
    {
        uint256 previousMonth = getPreviousMonth();
        uint256[] storage monthProposals = _monthlyProposals[previousMonth];
        require(monthProposals.length > 0, "No proposals for previous month");

        uint256 winningProposalId;
        uint256 highestApproval = 0;

        // Encontrar la propuesta ganadora
        for (uint256 i = 0; i < monthProposals.length; i++) {
            uint256 proposalId = monthProposals[i];
            Proposal storage proposal = _proposals[proposalId];
            
            if (proposal.status == ProposalStatus.ACTIVE && 
                proposal.approvalCount > highestApproval) {
                highestApproval = proposal.approvalCount;
                winningProposalId = proposalId;
            }
        }

        require(winningProposalId > 0, "No valid winning proposal");

        // Actualizar la propuesta ganadora
        _proposals[winningProposalId].status = ProposalStatus.EXECUTED;
        _winningProposals[previousMonth].push(winningProposalId);

        // Marcar todas las demás propuestas como inactivas
        for (uint256 i = 0; i < monthProposals.length; i++) {
            uint256 proposalId = monthProposals[i];
            if (proposalId != winningProposalId && 
                _proposals[proposalId].status == ProposalStatus.ACTIVE) {
                _proposals[proposalId].status = ProposalStatus.REJECTED;
                emit ProposalStatusChanged(
                    proposalId,
                    ProposalStatus.REJECTED,
                    block.timestamp
                );
            }
        }

        emit MonthlyWinnerSelected(
            getYear(),
            getMonth(),
            winningProposalId,
            highestApproval
        );

        emit ProposalExecuted(
            winningProposalId,
            _proposals[winningProposalId].approvalCount,
            _proposals[winningProposalId].rejectionCount,
            block.timestamp
        );
    }

    function getCurrentMonth() public view returns (uint256) {
        return getYear() * 12 + getMonth();
    }

    function getPreviousMonth() public view returns (uint256) {
        uint256 currentMonth = getCurrentMonth();
        return currentMonth > 0 ? currentMonth - 1 : 0;
    }

    function getMonth() public view returns (uint256) {
        return (block.timestamp / 30 days) % 12 + 1;
    }

    function getYear() public view returns (uint256) {
        return (block.timestamp / 365 days) + 1970;
    }

    // Funciones administrativas
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Función para obtener todas las propuestas activas
    function getActiveProposals() external view returns (uint256[] memory) {
        uint256 currentMonth = getCurrentMonth();
        return _monthlyProposals[currentMonth];
    }

    // Getters públicos
    function getProposalCount() external view returns (uint256) {
        return _proposalCount;
    }

    function getProposal(uint256 _proposalId) external view returns (Proposal memory) {
        require(_proposals[_proposalId].exists, "Proposal doesn't exist");
        return _proposals[_proposalId];
    }

    function getVote(uint256 _proposalId, address _voter) external view returns (Vote memory) {
        return _votes[_proposalId][_voter];
    }

    function getMonthlyProposals(uint256 _month) external view returns (uint256[] memory) {
        return _monthlyProposals[_month];
    }

    function getWinningProposals(uint256 _month) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return _winningProposals[_month];
    }
} 