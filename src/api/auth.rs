use actix_web::{HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use jsonwebtoken::{decode, DecodingKey, Validation};
use std::env;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
}

fn validate_token(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET not found");
    let key = DecodingKey::from_secret(jwt_secret.as_bytes());
    let validation = Validation::default();
    
    let token_data = decode::<Claims>(token, &key, &validation)?;
    Ok(token_data.claims)
}

// Middleware to verify the JWT
pub async fn verify_token(req: HttpRequest) -> Result<Claims, HttpResponse> {
    let auth_header = req.headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    match auth_header {
        Some(auth_str) if auth_str.starts_with("Bearer ") => {
            let token = &auth_str[7..];
            match validate_token(token) {
                Ok(claims) => Ok(claims),
                Err(_) => Err(HttpResponse::Unauthorized().json("Invalid token"))
            }
        },
        _ => Err(HttpResponse::Unauthorized().json("Token not provided"))
    }
}
