use actix_web::{web, HttpResponse, Responder, HttpRequest};
use serde::{Deserialize, Serialize};
use std::env;
use jsonwebtoken::{encode, EncodingKey, Header};
use chrono::{Utc, Duration};
use crate::openai_methods::get_text::handle_conversation;
use crate::api::auth::{verify_token, Claims};
use super::nft_claim::{handle_nft_claim_post, handle_nft_claim_get};

#[derive(Serialize, Deserialize, Debug)]
pub struct Post {
    post_type: String,
    data: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct LoginResponse {
    message: String,
    token: String,
}

async fn process_register(data: serde_json::Value) -> HttpResponse {
    let username = data["data"]["author"].as_str().unwrap_or("").to_string();

    HttpResponse::Ok().json(format!("User registered: {}", username))
}

async fn process_ads(data: serde_json::Value) -> HttpResponse {

    let ad_content = data["data"]["content"].as_str().unwrap_or("").to_string();

    HttpResponse::Ok().json(format!("Ad processed: {}", ad_content))
}

pub async fn protected_api(
    req: HttpRequest, 
    post: web::Json<Post>
) -> impl Responder {
    if let Err(response) = verify_token(&req).await {
        return response;
    }

    match post.post_type.as_str() {
        "message" => {
            let author = post.data["author"].as_str().unwrap_or("").to_string();
            let message_content = post.data["content"].as_str().unwrap_or("").to_string();
            let cleaned_data = serde_json::json!({
                "message": message_content,
                "author": author,
            });
            process_message(cleaned_data).await
        },
        "ads" => process_ads(post.data.clone()).await,
        "register" => process_register(post.data.clone()).await,
        _ => HttpResponse::BadRequest().body("Unrecognized post type"),
    }
}

async fn process_message(data: serde_json::Value) -> HttpResponse {
    let api_key = match env::var("OPENAI_API_KEY") {
        Ok(key) => key,
        Err(e) => {
            println!("❌ OPENAI_API_KEY: {}", e);
            return HttpResponse::InternalServerError().body("OPENAI_API_KEY not found");
        }
    };

    let redis_url = match env::var("REDIS_URL") {
        Ok(url) => url,
        Err(e) => {
            println!("❌ REDIS_URL: {}", e);
            return HttpResponse::InternalServerError().body("REDIS_URL not found");
        }
    };

    println!("🔌 Connected: {}", redis_url);
    let redis_client = match redis::Client::open(redis_url) {
        Ok(client) => client,
        Err(e) => {
            println!("❌ Redis connection: {}", e);
            return HttpResponse::InternalServerError().body(format!("Redis error: {}", e));
        }
    };

    let user_content = data.get("message").and_then(|c| c.as_str()).unwrap_or("").to_string();
    let user_author = data.get("author").and_then(|c| c.as_str()).unwrap_or("").to_string();

    if user_content.is_empty() {
        return HttpResponse::BadRequest().body("Empty message");
    }

    let context_content = match std::fs::read_to_string("context.md") {
        Ok(content) => format!(
            "You are Qawakun, a narrative guide in this interactive experience.\n{}\n\
             Stay in character and maintain narrative consistency.",
            content
        ),
        Err(e) => {
            println!("❌ context.md: {}", e);
            return HttpResponse::InternalServerError().body("Narrative context error");
        }
    };

    println!("🤖 Processing message from {}", user_author);
    match handle_conversation(&redis_client, &api_key, &user_author, &context_content, &user_content).await {
        Ok(response) => {
            let message = response["choices"][0]["message"]["content"].as_str().unwrap_or("");
            println!("✅ Response sent");
            HttpResponse::Ok().json(message)
        },
        Err(e) => {
            println!("❌ Error: {}", e);
            HttpResponse::InternalServerError().body(format!("Error: {}", e))
        },
    }
}

pub async fn login(login_data: web::Json<serde_json::Value>) -> impl Responder {
    println!("Starting login process...");
    let username = login_data.get("user").and_then(|u| u.as_str()).unwrap_or("");
    let password = login_data.get("password").and_then(|p| p.as_str()).unwrap_or("");
    println!("Attempting to load environment variables...");
    
    let env_username = match env::var("APP_USER") {
        Ok(val) => {
            println!("APP_USER found: {}", val);
            val
        },
        Err(e) => {
            println!("Error loading APP_USER: {:?}", e);
            return HttpResponse::InternalServerError().body("Environment variable APP_USER not found");
        }
    };

    let env_password = match env::var("APP_PASSWORD") {
        Ok(val) => {
            println!("APP_PASSWORD found");
            val
        },
        Err(e) => {
            println!("Error loading APP_PASSWORD: {:?}", e);
            return HttpResponse::InternalServerError().body("Environment variable APP_PASSWORD not found");
        }
    };

    let jwt_secret = match env::var("JWT_SECRET") {
        Ok(val) => {
            println!("JWT_SECRET found");
            val
        },
        Err(e) => {
            println!("Error loading JWT_SECRET: {:?}", e);
            return HttpResponse::InternalServerError().body("Environment variable JWT_SECRET not found");
        }
    };

    println!("Credentials received - User: {}", username);
    println!("Expected credentials - User: {}", env_username);

    if username == env_username && password == env_password {
        println!("Valid credentials, generating token...");
        let expiration = Utc::now()
            .checked_add_signed(Duration::hours(1))
            .expect("Error calculating expiration date")
            .timestamp() as usize;
            
        let claims = Claims {
            sub: username.to_string(),
            exp: expiration,
            iat: Utc::now().timestamp() as usize,
        };

        match encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(jwt_secret.as_bytes())
        ) {
            Ok(token) => {
                let response = LoginResponse {
                    message: format!("User validated: {}", username),
                    token,
                };
                HttpResponse::Ok().json(response)
            }
            Err(e) => {
                println!("Error generating token: {:?}", e);
                HttpResponse::InternalServerError().body("Error generating token")
            }
        }
    } else {
        HttpResponse::Unauthorized().body("Invalid credentials")
    }
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("")
            .route("/login", web::post().to(login))
            .route("/api", web::post().to(protected_api))
            .route("/nft-claim", web::post().to(handle_nft_claim_post))
            .route("/nft-claim", web::get().to(handle_nft_claim_get))
    );
}
