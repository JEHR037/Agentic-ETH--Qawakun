use actix_web::{web, HttpResponse, Responder, HttpRequest};
use serde::{Deserialize, Serialize};
use redis::AsyncCommands;
use chrono::{DateTime, Utc};
use crate::api::auth::verify_token;
use crate::api::cdp::nfts::{NftManager, UserData};
use ethers::types::{Address, U256, H256};
use anyhow::Result;

#[derive(Deserialize)]
pub struct NFTClaimRequest {
    fid: u64,
    wallet: String,
    message_count: i32,
    message_history: Vec<String>,
    timestamp: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct NFTClaimResponse {
    has_claimed: bool,
    message: String,
    token_id: Option<u64>,
}

#[derive(Serialize, Deserialize)]
pub struct Claim {
    fid: u64,
    wallet: String,
    timestamp: DateTime<Utc>,
    token_id: u64,
}

async fn check_wallet_has_nft(nft_manager: &NftManager, wallet: &str) -> Result<bool> {
    let wallet_address = wallet.parse::<Address>()?;
    let balance = nft_manager.get_balance(wallet_address).await?;
    Ok(!balance.is_zero())
}

pub async fn handle_nft_claim_get(
    req: HttpRequest,
    _redis_client: web::Data<redis::Client>,
    nft_manager: web::Data<NftManager>,
) -> impl Responder {
    if let Err(response) = verify_token(&req).await {
        return response;
    }

    let user_wallet = match req.headers().get("wallet") {
        Some(header) => header.to_str().unwrap_or("").to_string(),
        None => return HttpResponse::BadRequest().body("Wallet address required"),
    };

    match check_wallet_has_nft(&nft_manager, &user_wallet).await {
        Ok(has_nft) => {
            if has_nft {
                HttpResponse::Ok().json(NFTClaimResponse {
                    has_claimed: true,
                    message: "Come back soon!".to_string(),
                    token_id: None, // Podrías obtener el token_id si lo necesitas
                })
            } else {
                HttpResponse::Ok().json(NFTClaimResponse {
                    has_claimed: false,
                    message: "Not claimed yet".to_string(),
                    token_id: None,
                })
            }
        },
        Err(_) => HttpResponse::InternalServerError().body("Error checking NFT ownership"),
    }
}

pub async fn handle_nft_claim_post(
    req: HttpRequest,
    json_data: web::Json<NFTClaimRequest>,
    redis_client: web::Data<redis::Client>,
    nft_manager: web::Data<NftManager>,
) -> impl Responder {
    if let Err(response) = verify_token(&req).await {
        return response;
    }

    // Verificar si ya tiene un NFT
    match check_wallet_has_nft(&nft_manager, &json_data.wallet).await {
        Ok(has_nft) => {
            if has_nft {
                return HttpResponse::BadRequest().json(NFTClaimResponse {
                    has_claimed: true,
                    message: "NFT already claimed".to_string(),
                    token_id: None,
                });
            }
        },
        Err(_) => return HttpResponse::InternalServerError().body("Error checking NFT ownership"),
    }

    let mut con = match redis_client.get_async_connection().await {
        Ok(con) => con,
        Err(_) => return HttpResponse::InternalServerError().body("Redis connection error"),
    };

    // Buscar en todas las conversaciones, no solo en farcaster
    let conversation_patterns = [
        format!("conversation:{}", json_data.wallet),           // conversación normal
        format!("farcaster:conversation:{}", json_data.wallet), // conversación de farcaster
    ];
    
    println!("🔍 Buscando conversaciones con patrones: {:?}", conversation_patterns);
    
    let mut all_keys = Vec::new();
    for pattern in conversation_patterns.iter() {
        let keys: Vec<String> = redis::cmd("KEYS")
            .arg(&format!("{}*", pattern))
            .query_async(&mut con)
            .await
            .unwrap_or_default();
        all_keys.extend(keys);
    }

    println!("🔑 Claves encontradas: {:?}", all_keys);

    // Obtener la primera conversación que encontremos
    let conversation: Option<String> = if !all_keys.is_empty() {
        let result = con.get(&all_keys[0]).await.ok();
        println!("💬 Conversación encontrada en clave: {}", all_keys[0]);
        result
    } else {
        None
    };

    if let Some(conv) = conversation {
        let user_count = conv.matches("user").count();

        if user_count >= 6 {

            let user_data = UserData {
                username: format!("Farcaster User {}", json_data.fid),
                email: "".to_string(),
                wallet_address: json_data.wallet.clone(),
                avatar_url: "".to_string(),
                additional_data: Some(serde_json::json!({
                    "fid": json_data.fid,
                    "message_count": json_data.message_count,
                    "claim_timestamp": json_data.timestamp,
                    "conversation": conv 
                })),
            };

            let to_address = match json_data.wallet.parse::<Address>() {
                Ok(address) => address,
                Err(_) => return HttpResponse::BadRequest().body("Invalid wallet address"),
            };

            // Mintear el NFT
            match nft_manager.mint_nft_with_encrypted_data(to_address, user_data).await {
                Ok(receipt) => {
                    println!("✅ NFT minteado y transferido exitosamente");
                    // Obtener el token ID del evento de mint
                    let token_id = receipt
                        .logs
                        .iter()
                        .find(|log| log.topics[0] == H256::from(ethers::utils::keccak256("Transfer(address,address,uint256)")))
                        .and_then(|log| {
                            let bytes = log.topics[3].as_bytes();
                            U256::from_big_endian(bytes).to_string().parse::<u64>().ok()
                        });

                    if let Some(token_id) = token_id {
                        let claim = Claim {
                            fid: json_data.fid,
                            wallet: json_data.wallet.clone(),
                            timestamp: json_data.timestamp,
                            token_id,
                        };

                        let _: () = con.hset(
                            "nft:claims",
                            &json_data.wallet,
                            serde_json::to_string(&claim).unwrap(),
                        ).await.unwrap_or_default();

                        HttpResponse::Ok().json(NFTClaimResponse {
                            has_claimed: true,
                            message: "NFT claim successful".to_string(),
                            token_id: Some(token_id),
                        })
                    } else {
                        HttpResponse::InternalServerError().body("Failed to get token ID")
                    }
                },
                Err(e) => {
                    if e.to_string().contains("User already has an NFT") {
                        HttpResponse::BadRequest().json(NFTClaimResponse {
                            has_claimed: true,
                            message: "User already has an NFT".to_string(),
                            token_id: None,
                        })
                    } else {
                        println!("❌ Error detallado al mintear NFT: {:?}", e);
                        let error_message = format!("Failed to mint NFT: {}", e);
                        println!("🔍 Mensaje de error: {}", error_message);
                        HttpResponse::InternalServerError().body(error_message)
                    }
                }
            }
        } else {
            HttpResponse::BadRequest().json(NFTClaimResponse {
                has_claimed: false,
                message: format!("Not enough interactions. Current: {}, Required: 6", user_count),
                token_id: None,
            })
        }
    } else {
        println!("❌ No se encontró conversación para la wallet: {}", json_data.wallet);
        HttpResponse::BadRequest().json(NFTClaimResponse {
            has_claimed: false,
            message: format!("No conversation found for wallet: {}", json_data.wallet),
            token_id: None,
        })
    }
} 