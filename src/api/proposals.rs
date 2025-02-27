use actix_web::{web, HttpResponse, Responder, HttpRequest};
use serde::{Deserialize, Serialize};
use redis::AsyncCommands;
use chrono::{DateTime, Utc, Datelike};
use ethers::{
    prelude::*,
    providers::{Http, Provider},
    signers::{LocalWallet, MnemonicBuilder, coins_bip39::English},
    types::{U256, Address},
    abi::{Token, Tokenizable, InvalidOutputType},
};
use std::sync::Arc;
use crate::api::auth::verify_token;

// Generar los bindings para el contrato de propuestas
abigen!(
    ProposalContract,
    "./src/api/cdp/abi/proposal_contract_abi.json",
    derives(serde::Deserialize, serde::Serialize)
);

// Definir la estructura ContractProposalResponse antes de usarla
#[derive(Serialize, Deserialize, Debug)]
pub struct ContractProposalResponse {
    pub id: U256,
    pub proposer: Address,
    pub proposal_type: u8,
    pub description: String,
    pub conversation: String,
    pub timestamp: U256,
    pub approval_count: U256,
    pub rejection_count: U256,
    pub status: u8,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Proposal {
    pub wallet: String,
    pub fid: u64,
    pub proposal_type: String,  // WORLD, CHARACTERS, LAWS
    pub description: String,
    pub flexibility: i32,       // 1-10
    pub contact: String,
    pub message_history: Vec<String>,
    pub timestamp: String,      // ISO timestamp
    pub status: i32,           // 1: nueva, 2: en revisión, 3: en votación, 4: rechazada
}

// Implementar manualmente para ContractProposal
#[derive(Debug)]
struct ContractProposal {
    proposer: Address,
    proposal_type: u8,
    description: String,
    conversation: String,
    timestamp: U256,
}

// Solo implementar Tokenizable para ContractProposal
impl Tokenizable for ContractProposal {
    fn from_token(token: Token) -> Result<Self, InvalidOutputType> {
        if let Token::Tuple(tokens) = token {
            if tokens.len() != 5 {
                return Err(InvalidOutputType("Invalid tuple length".into()));
            }
            
            Ok(ContractProposal {
                proposer: Address::from_token(tokens[0].clone())
                    .map_err(|_| InvalidOutputType("Invalid address".into()))?,
                proposal_type: u8::from_token(tokens[1].clone())
                    .map_err(|_| InvalidOutputType("Invalid proposal type".into()))?,
                description: String::from_token(tokens[2].clone())
                    .map_err(|_| InvalidOutputType("Invalid description".into()))?,
                conversation: String::from_token(tokens[3].clone())
                    .map_err(|_| InvalidOutputType("Invalid conversation".into()))?,
                timestamp: U256::from_token(tokens[4].clone())
                    .map_err(|_| InvalidOutputType("Invalid timestamp".into()))?,
            })
        } else {
            Err(InvalidOutputType("Expected tuple".into()))
        }
    }

    fn into_token(self) -> Token {
        Token::Tuple(vec![
            self.proposer.into_token(),
            self.proposal_type.into_token(),
            self.description.into_token(),
            self.conversation.into_token(),
            self.timestamp.into_token(),
        ])
    }
}

pub struct ProposalManager {
    provider: Arc<Provider<Http>>,
    wallet: LocalWallet,
    contract: ProposalContract<SignerMiddleware<Arc<Provider<Http>>, LocalWallet>>,
}

impl ProposalManager {
    pub async fn new() -> anyhow::Result<Self> {
        dotenv::dotenv().ok();
        
        let rpc_url = std::env::var("BASE_SEPOLIA_RPC_URL")?;
        let mnemonic = std::env::var("MNEMONIC")?;
        let contract_address = std::env::var("PROPOSAL_CONTRACT_ADDRESS")?;

        let provider = Provider::<Http>::try_from(rpc_url)?;
        let chain_id = provider.get_chainid().await?;
        let provider = Arc::new(provider);

        let wallet = MnemonicBuilder::<English>::default()
            .phrase(mnemonic.as_str())
            .build()?
            .with_chain_id(chain_id.as_u64());

        let middleware = SignerMiddleware::new(
            provider.clone(),
            wallet.clone(),
        );

        let contract_address: Address = contract_address.parse()?;
        let contract = ProposalContract::new(
            contract_address,
            Arc::new(middleware),
        );

        Ok(Self {
            provider,
            wallet,
            contract,
        })
    }

    // Función para convertir Proposal a ContractProposal
    fn convert_to_contract_proposal(&self, proposal: &Proposal) -> anyhow::Result<ContractProposal> {
        // Convertir wallet a Address
        let proposer = proposal.wallet.parse::<Address>()?;

        // Convertir proposal_type a u8
        let proposal_type = match proposal.proposal_type.as_str() {
            "WORLD" => 0,
            "CHARACTERS" => 1,
            "LAWS" => 2,
            _ => return Err(anyhow::anyhow!("Invalid proposal type")),
        };

        // Convertir message_history a conversation
        let conversation = serde_json::json!({
            "messages": proposal.message_history,
            "contact": proposal.contact,
            "flexibility": proposal.flexibility,
        }).to_string();

        // Convertir timestamp a U256
        let timestamp = U256::from_dec_str(&proposal.timestamp.replace(|c: char| !c.is_ascii_digit(), ""))?;

        Ok(ContractProposal {
            proposer,
            proposal_type,
            description: proposal.description.clone(),
            conversation,
            timestamp,
        })
    }

    // Modificar la función de indexación para usar la conversión
    pub async fn index_proposal_from_backend(
        &self,
        proposal: &Proposal,
    ) -> anyhow::Result<TransactionReceipt> {
        let contract_proposal = self.convert_to_contract_proposal(proposal)?;

        self.index_proposal(
            contract_proposal.proposer,
            contract_proposal.proposal_type,
            contract_proposal.description,
            contract_proposal.conversation,
            contract_proposal.timestamp,
        ).await
    }

    // Función para convertir de contrato a backend
    fn convert_from_contract_proposal(&self, contract_proposal: ContractProposal) -> anyhow::Result<Proposal> {
        // Deserializar conversation
        let conversation_data: serde_json::Value = serde_json::from_str(&contract_proposal.conversation)?;
        
        Ok(Proposal {
            wallet: format!("{:?}", contract_proposal.proposer),
            fid: 0, // Este campo podría venir de otra fuente
            proposal_type: match contract_proposal.proposal_type {
                0 => "WORLD",
                1 => "CHARACTERS",
                2 => "LAWS",
                _ => return Err(anyhow::anyhow!("Invalid proposal type")),
            }.to_string(),
            description: contract_proposal.description,
            flexibility: conversation_data["flexibility"].as_i64().unwrap_or(5) as i32,
            contact: conversation_data["contact"].as_str().unwrap_or("").to_string(),
            message_history: conversation_data["messages"]
                .as_array()
                .map(|arr| arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect())
                .unwrap_or_default(),
            timestamp: contract_proposal.timestamp.to_string(),
            status: 1, // Este campo podría venir de otra fuente
        })
    }

    pub async fn index_proposal(
        &self,
        proposer: Address,
        proposal_type: u8,
        description: String,
        conversation: String,
        timestamp: U256,
    ) -> anyhow::Result<TransactionReceipt> {
        let tx = self.contract
            .method::<_, ()>(
                "indexProposal",
                (proposer, proposal_type, description, conversation, timestamp)
            )?;

        let pending_tx = tx.send().await?;
        let receipt = pending_tx.await?
            .ok_or_else(|| anyhow::anyhow!("Transaction failed"))?;

        Ok(receipt)
    }

    pub async fn vote_proposal(
        &self,
        proposal_id: U256,
        support: bool,
    ) -> anyhow::Result<TransactionReceipt> {
        let contract = &self.contract;
        let tx = contract.method::<_, ()>("vote", (proposal_id, support))?;
        let pending_tx = tx.send().await?;
        let receipt = pending_tx.await?
            .ok_or_else(|| anyhow::anyhow!("Vote transaction failed"))?;
        Ok(receipt)
    }

    pub async fn execute_monthly_selection(&self) -> anyhow::Result<TransactionReceipt> {
        let contract = &self.contract;
        let tx = contract.method::<_, ()>("executeMonthlySelection", ())?;
        let pending_tx = tx.send().await?;
        let receipt = pending_tx.await?
            .ok_or_else(|| anyhow::anyhow!("Monthly selection failed"))?;
        Ok(receipt)
    }

    pub async fn get_proposal(&self, proposal_id: U256) -> anyhow::Result<ContractProposal> {
        let contract = &self.contract;
        let proposal = contract
            .method::<_, ContractProposal>("getProposal", proposal_id)?
            .call()
            .await?;
        Ok(proposal)
    }

    pub async fn get_active_proposals(&self) -> anyhow::Result<Vec<U256>> {
        let proposals = self.contract
            .method::<_, Vec<U256>>("getActiveProposals", ())?
            .call()
            .await?;

        Ok(proposals)
    }

    pub async fn check_configuration(&self) -> anyhow::Result<()> {
        // Verificar que tenemos un provider válido
        let _ = self.provider.get_chainid().await?;
        
        // Verificar que el contrato está configurado
        let code = self.provider
            .get_code(self.contract.address(), None)
            .await?;
        
        if code.is_empty() {
            return Err(anyhow::anyhow!("Contract not deployed at specified address"));
        }

        Ok(())
    }

    pub async fn get_current_month_proposals(&self) -> Result<Vec<ContractProposalResponse>, Box<dyn std::error::Error>> {
        let contract = ProposalContract::new(
            self.contract.address(),
            Arc::clone(&self.provider)
        );

        let current_month = chrono::Utc::now().month() as u64;
        let month_u256 = U256::from(current_month);
        
        let proposals = contract.get_monthly_proposals(month_u256).call().await?;
        let mut response_proposals = Vec::new();

        for proposal_id in proposals {
            if let Ok(proposal) = contract.get_proposal(proposal_id).call().await {
                response_proposals.push(ContractProposalResponse {
                    id: proposal_id,
                    proposer: proposal.proposer,
                    proposal_type: proposal.proposal_type,
                    description: proposal.description,
                    conversation: proposal.conversation,
                    timestamp: proposal.timestamp,
                    approval_count: proposal.approval_count,
                    rejection_count: proposal.rejection_count,
                    status: proposal.status,
                });
            }
        }
        
        Ok(response_proposals)
    }

    pub async fn get_all_winning_proposals(&self) -> Result<Vec<ContractProposalResponse>, Box<dyn std::error::Error>> {
        let contract = ProposalContract::new(
            self.contract.address(),
            Arc::clone(&self.provider)
        );

        let mut all_winners = Vec::new();
        let current_month = chrono::Utc::now().month() as u64;
        
        for month in 1..=current_month {
            let month_u256 = U256::from(month);
            let winners = contract.get_winning_proposals(month_u256).call().await?;
            for winner_id in winners {
                if let Ok(proposal) = contract.get_proposal(winner_id).call().await {
                    all_winners.push(ContractProposalResponse {
                        id: winner_id,
                        proposer: proposal.proposer,
                        proposal_type: proposal.proposal_type,
                        description: proposal.description,
                        conversation: proposal.conversation,
                        timestamp: proposal.timestamp,
                        approval_count: proposal.approval_count,
                        rejection_count: proposal.rejection_count,
                        status: proposal.status,
                    });
                }
            }
        }
        
        Ok(all_winners)
    }
}

#[derive(Serialize, Debug)]
pub struct ProposalSummary {
    wallet: String,
    proposal_type: String,
    timestamp: DateTime<Utc>,
    status: i32,
}

pub async fn handle_proposal_post(
    req: HttpRequest,
    json_data: web::Json<Proposal>,
    redis_client: web::Data<redis::Client>,
) -> impl Responder {
    println!("📝 Recibiendo propuesta: {:?}", json_data);  // Debug

    if let Err(response) = verify_token(&req).await {
        println!("❌ Error de autenticación");  // Debug
        return response;
    }

    let mut con = match redis_client.get_async_connection().await {
        Ok(con) => con,
        Err(e) => {
            println!("❌ Error de conexión Redis: {:?}", e);  // Debug
            return HttpResponse::InternalServerError().body("Redis connection error");
        }
    };

    let proposal = json_data.into_inner();
    println!("📋 Propuesta procesada: {:?}", proposal);  // Debug

    // Usar wallet como clave
    if let Err(e) = con.hset::<_, _, _, ()>(
        "proposals",
        &proposal.wallet,
        serde_json::to_string(&proposal).unwrap(),
    ).await {
        println!("❌ Error guardando propuesta: {:?}", e);  // Debug
        return HttpResponse::InternalServerError().body("Error saving proposal");
    }

    println!("✅ Propuesta guardada exitosamente");  // Debug
    HttpResponse::Ok().json(proposal)
}

pub async fn handle_proposals_get(
    req: HttpRequest,
    redis_client: web::Data<redis::Client>,
) -> impl Responder {
    if let Err(response) = verify_token(&req).await {
        return response;
    }

    let mut con = match redis_client.get_async_connection().await {
        Ok(con) => con,
        Err(_) => return HttpResponse::InternalServerError().body("Redis connection error"),
    };

    // Obtener todas las propuestas
    let proposals: Vec<String> = match con.hvals("proposals").await {
        Ok(p) => p,
        Err(_) => Vec::new()
    };

    // Si no hay propuestas, devolver array vacío
    if proposals.is_empty() {
        return HttpResponse::Ok().json(Vec::<ProposalSummary>::new());
    }

    let summaries: Vec<ProposalSummary> = proposals.iter()
        .filter_map(|p| {
            match serde_json::from_str::<Proposal>(p) {
                Ok(proposal) => Some(ProposalSummary {
                    wallet: proposal.wallet.clone(),
                    proposal_type: proposal.proposal_type.clone(),
                    timestamp: proposal.timestamp.parse::<DateTime<Utc>>().ok()?,
                    status: proposal.status,
                }),
                Err(_) => None
            }
        })
        .collect();

    HttpResponse::Ok().json(summaries)
}

pub async fn handle_proposal_by_wallet_get(
    req: HttpRequest,
    wallet: web::Path<String>,
    redis_client: web::Data<redis::Client>,
) -> impl Responder {
    println!("📥 GET /proposals/{} - Buscando propuestas", wallet.as_ref());

    if let Err(response) = verify_token(&req).await {
        println!("❌ Error de autenticación");
        return response;
    }

    let mut con = match redis_client.get_async_connection().await {
        Ok(con) => con,
        Err(e) => {
            println!("❌ Error de conexión Redis: {:?}", e);
            return HttpResponse::InternalServerError().body("Redis connection error");
        }
    };

    // Obtener propuesta directamente por wallet
    let proposal: Option<String> = match con.hget("proposals", wallet.as_ref()).await {
        Ok(p) => {
            println!("✅ Propuesta encontrada: {:?}", p);
            p
        },
        Err(e) => {
            println!("❌ Error obteniendo propuesta: {:?}", e);
            None
        }
    };

    match proposal {
        Some(proposal_str) => {
            match serde_json::from_str::<Proposal>(&proposal_str) {
                Ok(proposal) => {
                    println!("✅ Propuesta parseada: {:?}", proposal);
                    HttpResponse::Ok().json(vec![proposal])
                },
                Err(e) => {
                    println!("⚠️ Error parseando propuesta: {:?}", e);
                    HttpResponse::Ok().json(Vec::<Proposal>::new())
                }
            }
        },
        None => {
            println!("ℹ️ No se encontraron propuestas para la wallet");
            HttpResponse::Ok().json(Vec::<Proposal>::new())
        }
    }
}

pub async fn handle_proposal_status_update(
    req: HttpRequest,
    path: web::Path<(String, i32)>,
    redis_client: web::Data<redis::Client>,
) -> impl Responder {
    if let Err(response) = verify_token(&req).await {
        return response;
    }

    let (proposal_id, new_status) = path.into_inner();
    if !(1..=4).contains(&new_status) {
        return HttpResponse::BadRequest().body("Invalid status");
    }

    let mut con = match redis_client.get_async_connection().await {
        Ok(con) => con,
        Err(_) => return HttpResponse::InternalServerError().body("Redis connection error"),
    };

    let proposal_str: Option<String> = match con.hget("proposals", &proposal_id).await {
        Ok(p) => p,
        Err(_) => return HttpResponse::InternalServerError().body("Error getting proposal"),
    };

    match proposal_str {
        Some(str) => {
            let mut proposal: Proposal = match serde_json::from_str(&str) {
                Ok(p) => p,
                Err(_) => return HttpResponse::InternalServerError().body("Error parsing proposal"),
            };
            
            proposal.status = new_status;

            let proposal_json = serde_json::to_string(&proposal).unwrap();
            if let Err(_) = con.hset::<_, _, _, ()>(
                "proposals",
                &proposal_id,
                &proposal_json,
            ).await {
                return HttpResponse::InternalServerError().body("Error updating proposal");
            }

            HttpResponse::Ok().json(proposal)
        },
        None => HttpResponse::NotFound().body("Proposal not found"),
    }
}
