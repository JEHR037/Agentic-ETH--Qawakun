use chrono::Utc;
use ethers::core::k256::ecdsa::SigningKey;
use ethers::signers::{Signer, Wallet};
use reqwest;
use serde_json::json;
use anyhow::Result;
use base64::Engine;
use serde::Deserialize;

const API_ROOT: &str = "https://api.warpcast.com";

#[derive(Debug, Deserialize)]
struct CustodyAddressRoot {
    result: CustodyAddressResult,
}

#[derive(Debug, Deserialize)]
struct CustodyAddressResult {
    #[serde(rename = "custodyAddress")]
    custody_address: String,
}

pub struct Auth;

#[derive(Debug, Deserialize)]
struct AuthResponse {
    result: AuthResult,
}

#[derive(Debug, Deserialize)]
struct AuthResult {
    token: Token,
}

#[derive(Debug, Deserialize)]
struct Token {
    secret: String,
}

impl Auth {
    pub async fn handle_session(
        wallet: &Wallet<SigningKey>,
        duration_secs: Option<i64>,
    ) -> Result<String> {
        let wallet_address = wallet.address();
        println!("🔑 Iniciando sesión en Farcaster...");


        let payload = json!({
            "method": "generateToken",
            "params": {
                "timestamp": Utc::now().timestamp_millis(),
                "expiresAt": Utc::now().timestamp_millis() + (duration_secs.unwrap_or(300) * 1000)
            }
        });

        let message = serde_json::to_string(&payload)?;
        let signature = wallet.sign_message(message.as_bytes()).await?;
        let signature_bytes = signature.to_vec();
        let base64_signature = base64::engine::general_purpose::STANDARD.encode(signature_bytes);
        let bearer_token = format!("Bearer eip191:{}", base64_signature);


        let client = reqwest::Client::new();
        let response = client
            .put(format!("{}/v2/auth", API_ROOT))
            .header("Content-Type", "application/json")
            .header("Authorization", &bearer_token)
            .json(&payload)
            .send()
            .await?;

        let status = response.status();
        let response_text = response.text().await?;

        if status.is_success() {
            println!("✅ Autenticación exitosa");
            
            let auth_response: AuthResponse = serde_json::from_str(&response_text)?;
            let session_token = auth_response.result.token.secret;
            
            match Self::get_custody_address_by_fid(892331, &session_token).await {
                Ok(custody_address) => {
                    let _wallet_clean = wallet_address.to_string().to_lowercase().trim_start_matches("0x").to_string();
                    let _custody_clean = custody_address.to_lowercase().trim_start_matches("0x").to_string();
                },
                Err(_) => println!("⚠️ No se pudo verificar custody address")
            }
            
            Ok(session_token)
        } else {
            Err(anyhow::anyhow!("Error de autenticación: {}", response_text))
        }
    }

    async fn get_custody_address_by_fid(fid: u64, token: &str) -> Result<String> {
        let client = reqwest::Client::new();
        let response = client
            .get(&format!("{}/v2/custody-address?fid={}", API_ROOT, fid))
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await?;

        let status = response.status();
        let response_text = response.text().await?;

        if !status.is_success() {
            return Err(anyhow::anyhow!("Error obteniendo custody address: {}", response_text));
        }

        let custody_address: CustodyAddressRoot = serde_json::from_str(&response_text)?;
        Ok(custody_address.result.custody_address)
    }
}
