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

pub async fn verify_token(req: &HttpRequest) -> Result<Claims, HttpResponse> {
    let auth_header = match req.headers().get("Authorization") {
        Some(header) => header,
        None => return Err(HttpResponse::Unauthorized().body("No authorization header")),
    };

    let auth_str = match auth_header.to_str() {
        Ok(str) => str,
        Err(_) => return Err(HttpResponse::Unauthorized().body("Invalid authorization header")),
    };

    if !auth_str.starts_with("Bearer ") {
        return Err(HttpResponse::Unauthorized().body("Invalid token format"));
    }

    let token = &auth_str[7..];

    let jwt_secret = match env::var("JWT_SECRET") {
        Ok(secret) => secret,
        Err(_) => return Err(HttpResponse::InternalServerError().body("JWT_SECRET not found")),
    };

    let token_data = match decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    ) {
        Ok(data) => data,
        Err(_) => return Err(HttpResponse::Unauthorized().body("Invalid token")),
    };

    Ok(token_data.claims)
}
