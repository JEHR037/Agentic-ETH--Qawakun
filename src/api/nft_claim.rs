use actix_web::{web, HttpResponse, Responder, HttpRequest};
use serde::{Deserialize, Serialize};
use redis::AsyncCommands;
use chrono::{DateTime, Utc};
use crate::api::auth::verify_token;

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
}

#[derive(Serialize, Deserialize)]
pub struct Claim {
    fid: u64,
    wallet: String,
    timestamp: DateTime<Utc>,
}

pub async fn handle_nft_claim_post(
    req: HttpRequest,
    json_data: web::Json<NFTClaimRequest>,
    redis_client: web::Data<redis::Client>,
) -> impl Responder {
    if let Err(response) = verify_token(&req).await {
        return response;
    }

    let mut con = match redis_client.get_async_connection().await {
        Ok(con) => con,
        Err(_) => return HttpResponse::InternalServerError().body("Redis connection error"),
    };

    let claims_key = "nft:claims";
    let existing_claim: Option<String> = con.hget(claims_key, &json_data.wallet).await.ok();
    
    if existing_claim.is_some() {
        return HttpResponse::BadRequest().body("NFT already claimed");
    }

    let conversation_key = format!("farcaster:conversation:{}", json_data.wallet);
    let conversation: Option<String> = con.get(&conversation_key).await.ok();

    if let Some(conv) = conversation {
        let user_count = conv.matches("user").count();
        if user_count >= 6 {
            let claim = Claim {
                fid: json_data.fid,
                wallet: json_data.wallet.clone(),
                timestamp: json_data.timestamp,
            };
            
            let _: () = con.hset(
                claims_key,
                &json_data.wallet,
                serde_json::to_string(&claim).unwrap(),
            ).await.unwrap_or_default();

            return HttpResponse::Ok().json(NFTClaimResponse {
                has_claimed: true,
                message: "NFT claim successful".to_string(),
            });
        }
    }

    HttpResponse::BadRequest().json(NFTClaimResponse {
        has_claimed: false,
        message: "Not enough interactions".to_string(),
    })
}

pub async fn handle_nft_claim_get(
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

    let user_wallet = match req.headers().get("wallet") {
        Some(header) => header.to_str().unwrap_or("").to_string(),
        None => return HttpResponse::BadRequest().body("Wallet address required"),
    };

    let claims_key = "nft:claims";
    let claim: Option<String> = con.hget(claims_key, &user_wallet).await.ok();

    HttpResponse::Ok().json(NFTClaimResponse {
        has_claimed: claim.is_some(),
        message: if claim.is_some() { 
            "Come back soon!".to_string() 
        } else { 
            "Not claimed yet".to_string() 
        },
    })
} 