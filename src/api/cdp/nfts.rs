use anyhow::Result;
use ethers::{
    prelude::*,
    providers::{Http, Provider},
    signers::{LocalWallet, MnemonicBuilder},
};
use std::sync::Arc;
use std::env;
use ethers::utils::keccak256;
use ethers::signers::coins_bip39::English;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::Rng;
use reqwest::multipart::{Form, Part};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use std::fs;
use crate::openai_methods::get_image::generate_image;

// Generar los bindings para el contrato
abigen!(
    QawakunContract,
    "./src/api/cdp/abi/nft_contract_abi.json",
    derives(serde::Deserialize, serde::Serialize)
);

pub struct NftManager {
    #[allow(dead_code)]
    provider: Arc<Provider<Http>>,
    wallet: LocalWallet,
    contract: QawakunContract<SignerMiddleware<Arc<Provider<Http>>, LocalWallet>>,
}

impl NftManager {
    pub async fn new() -> Result<Self> {
        dotenv::dotenv().ok();
        
        let rpc_url = env::var("BASE_SEPOLIA_RPC_URL")
            .expect("BASE_SEPOLIA_RPC_URL debe estar configurado en .env");
        let mnemonic = env::var("MNEMONIC")
            .expect("WALLET_MNEMONIC debe estar configurado en .env");
        let contract_address = env::var("NFT_CONTRACT_ADDRESS")
            .expect("NFT_CONTRACT_ADDRESS debe estar configurado en .env");

        let provider = Provider::<Http>::try_from(rpc_url)?;
        let chain_id = provider.get_chainid().await?;
        println!("🔗 Chain ID: {}", chain_id);
        
        let provider = Arc::new(provider);

        // Crear wallet con chain_id específico
        let wallet = MnemonicBuilder::<English>::default()
            .phrase(mnemonic.as_str())
            .build()?
            .with_chain_id(chain_id.as_u64());

        println!("👛 Wallet address: {}", wallet.address());

        let middleware = SignerMiddleware::new(
            provider.clone(),
            wallet.clone(),
        );

        let contract_address: Address = contract_address.parse()?;
        let contract = QawakunContract::new(
            contract_address,
            Arc::new(middleware),
        );

        //println!("🔍 Funciones disponibles en el contrato:");
        //for function in contract.abi().functions() {
        //    println!("  - {}", function.name);
        //}

        // Verificar balance de ETH
        let balance = provider.get_balance(wallet.address(), None).await?;
        println!("💰 Balance de ETH: {} wei", balance);

        Ok(Self {
            provider,
            wallet,
            contract,
        })
    }

    // Hacer privados los métodos que son internos
    async fn upload_to_pinata(&self, json_data: &str, file_name: &str) -> Result<String> {
        let jwt = env::var("JWT_SECRET_PINATA")
            .expect("JWT_SECRET_PINATA debe estar configurado en .env");

        let client = reqwest::Client::new();
        let form = Form::new()
            .text("pinataOptions", r#"{"cidVersion": 1}"#)
            .part("file", Part::bytes(json_data.as_bytes().to_vec())
                .file_name(file_name.to_string())
                .mime_str("application/json")?);

        let response = client
            .post("https://api.pinata.cloud/pinning/pinFileToIPFS")
            .header("Authorization", format!("Bearer {}", jwt))
            .multipart(form)
            .send()
            .await?;

        let json: serde_json::Value = response.json().await?;
        let ipfs_hash = json["IpfsHash"].as_str()
            .ok_or_else(|| anyhow::anyhow!("No IPFS hash in response"))?;

        // Construir la URL completa de Pinata
        Ok(format!("https://beige-fit-hedgehog-619.mypinata.cloud/ipfs/{}", ipfs_hash))
    }

    async fn generate_and_upload_image(&self, context: &str) -> Result<String> {
        println!("🎨 Generando imagen con IA...");
        let image_data = generate_image(context).await?;
        
        let image_bytes = BASE64.decode(image_data)?;
        
        let jwt = env::var("JWT_SECRET_PINATA")
            .expect("JWT_SECRET_PINATA debe estar configurado en .env");

        let client = reqwest::Client::new();
        let form = Form::new()
            .text("pinataOptions", r#"{"cidVersion": 1}"#)
            .part("file", Part::bytes(image_bytes)
                .file_name("nft_image.png")
                .mime_str("image/png")?);

        let response = client
            .post("https://api.pinata.cloud/pinning/pinFileToIPFS")
            .header("Authorization", format!("Bearer {}", jwt))
            .multipart(form)
            .send()
            .await?;

        let json: serde_json::Value = response.json().await?;
        let ipfs_hash = json["IpfsHash"].as_str()
            .ok_or_else(|| anyhow::anyhow!("No IPFS hash in response"))?;

        // Construir la URL completa de Pinata
        Ok(format!("https://beige-fit-hedgehog-619.mypinata.cloud/ipfs/{}", ipfs_hash))
    }

    // Eliminar o marcar como deprecated los métodos no usados
    #[deprecated(note = "Use mint_nft_with_encrypted_data instead")]
    pub async fn mint_nft(&self, to: Address, metadata_uri: String) -> Result<TransactionReceipt> {
        println!("🔄 Intentando mintear NFT para {} con URI: {}", to, metadata_uri);
        
        // Extraer la información encriptada y la URL de la imagen de los metadatos
        let metadata_response = reqwest::get(&metadata_uri).await?;
        let metadata: NftMetadata = metadata_response.json().await?;
        
        let tx = self.contract
            .method::<_, ()>("mint", (
                metadata.encrypted_user_data,  // _userInfo
                metadata.image,                // _imageUrl
            ))?;
        
        println!("📬 Enviando transacción...");
        let pending_tx = tx.send().await?;
        
        println!("⏳ Esperando confirmación...");
        let receipt = pending_tx.await?
            .ok_or_else(|| anyhow::anyhow!("Transaction failed"))?;
        
        println!("✅ Transacción completada: {:?}", receipt.transaction_hash);
        Ok(receipt)
    }

    #[allow(dead_code)]
    pub async fn get_owner(&self, token_id: U256) -> Result<Address> {
        let owner: Address = self.contract
            .method("ownerOf", token_id)?
            .call()
            .await?;

        Ok(owner)
    }

    #[allow(dead_code)]
    pub async fn get_token_uri(&self, token_id: U256) -> Result<String> {
        let uri: String = self.contract
            .method("tokenURI", token_id)?
            .call()
            .await?;

        Ok(uri)
    }

 
    #[allow(dead_code)]
    pub async fn transfer_nft(
        &self,
        from: Address,
        to: Address,
        token_id: U256,
    ) -> Result<TransactionReceipt> {
        let tx = self.contract
            .method::<_, ()>("transferFrom", (from, to, token_id))?
            .send()
            .await?
            .await?;

        Ok(tx.expect("Transacción fallida"))
    }

    pub fn get_private_key(&self) -> [u8; 32] {
        let bytes = self.wallet.signer().to_bytes();
        let mut result = [0u8; 32];
        result.copy_from_slice(&bytes);
        result
    }

    pub async fn encrypt_user_data(&self, user_data: &UserData) -> Result<String> {
        let key = self.get_private_key();
        let cipher = Aes256Gcm::new_from_slice(&key[0..32])?;
        
        let mut rng = rand::thread_rng();
        let mut nonce_bytes = [0u8; 12];
        rng.fill(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        let data = serde_json::to_string(&user_data)?.into_bytes();
        let encrypted = cipher.encrypt(nonce, data.as_ref())
            .map_err(|e| anyhow::anyhow!("Encryption error: {:?}", e))?;
        
        let mut final_data = nonce_bytes.to_vec();
        final_data.extend(encrypted);
        Ok(hex::encode(final_data))
    }

    pub async fn mint_nft_with_encrypted_data(
        &self,
        to: Address,
        user_data: UserData,
    ) -> Result<TransactionReceipt> {
        // Verificar si el usuario ya tiene NFTs
        let balance = self.get_balance(to).await?;
        if !balance.is_zero() {
            println!("👛 Usuario ya tiene {} NFTs", balance);
            return Err(anyhow::anyhow!("User already has an NFT"));
        }

        // Verificar que la wallet del contrato tiene fondos para el gas
        let contract_balance = self.provider.get_balance(self.wallet.address(), None).await?;
        if contract_balance.is_zero() {
            return Err(anyhow::anyhow!("La wallet no tiene fondos para pagar gas"));
        }

        println!("🔐 Encriptando datos de usuario...");
        let encrypted_data = self.encrypt_user_data(&user_data).await?;
        
        // Leer y subir la imagen estática a Pinata
        println!("📤 Subiendo imagen estática a Pinata...");
        let image_bytes = fs::read("src/img/image09.png")?;
        
        let jwt = env::var("JWT_SECRET_PINATA")
            .expect("JWT_SECRET_PINATA debe estar configurado en .env");

        let client = reqwest::Client::new();
        let form = Form::new()
            .text("pinataOptions", r#"{"cidVersion": 1}"#)
            .part("file", Part::bytes(image_bytes)
                .file_name("nft_image.png")
                .mime_str("image/png")?);

        let response = client
            .post("https://api.pinata.cloud/pinning/pinFileToIPFS")
            .header("Authorization", format!("Bearer {}", jwt))
            .multipart(form)
            .send()
            .await?;

        let json: serde_json::Value = response.json().await?;
        let ipfs_hash = json["IpfsHash"].as_str()
            .ok_or_else(|| anyhow::anyhow!("No IPFS hash in response"))?;

        let image_uri = format!("https://beige-fit-hedgehog-619.mypinata.cloud/ipfs/{}", ipfs_hash);
        println!("✅ Imagen subida a Pinata: {}", image_uri);
        
        println!("🚀 Iniciando proceso de minteo con datos:");
        println!("  🖼️ URL de imagen: {}", image_uri);
        
        // Mintear el NFT
        let tx = self.contract
            .method::<_, ()>("mint", (
                encrypted_data.clone(),
                image_uri.clone(),
            ))?;

        let gas_estimate = tx.estimate_gas().await?;
        println!("⛽ Estimación de gas para mint: {}", gas_estimate);

        let tx = tx.gas(gas_estimate);
        
        println!("📬 Enviando transacción de mint desde {}", self.wallet.address());
        let pending_tx = tx.send().await?;
        
        println!("⏳ Esperando confirmación del mint...");
        let mint_receipt = pending_tx.await?
            .ok_or_else(|| anyhow::anyhow!("Mint transaction failed"))?;

        println!("✅ NFT minteado exitosamente: {:?}", mint_receipt.transaction_hash);

        // Obtener el token ID del evento Transfer
        let token_id = mint_receipt
            .logs
            .iter()
            .find(|log| log.topics[0] == H256::from(keccak256("Transfer(address,address,uint256)")))
            .and_then(|log| {
                if log.topics.len() >= 4 {
                    Some(U256::from_big_endian(&log.topics[3].as_bytes()))
                } else {
                    None
                }
            })
            .ok_or_else(|| anyhow::anyhow!("No se pudo obtener el token ID"))?;

        println!("🎫 Token ID minteado: {}", token_id);

        // Esperar un poco antes de la transferencia
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        // Transferir el NFT al usuario
        println!("🔄 Transfiriendo NFT {} a {}...", token_id, to);
        let transfer_tx = self.contract
            .method::<_, ()>("transferFrom", (
                self.wallet.address(),  // from
                to,                     // to
                token_id,               // tokenId
            ))?;

        let transfer_gas = transfer_tx.estimate_gas().await?;
        println!("⛽ Estimación de gas para transferencia: {}", transfer_gas);

        let transfer_tx = transfer_tx.gas(transfer_gas);
        
        println!("📬 Enviando transacción de transferencia...");
        let pending_transfer = transfer_tx.send().await?;
        
        println!("⏳ Esperando confirmación de la transferencia...");
        let transfer_receipt = pending_transfer.await?
            .ok_or_else(|| anyhow::anyhow!("Transfer transaction failed"))?;

        println!("✅ NFT transferido exitosamente: {:?}", transfer_receipt.transaction_hash);

        // Devolver el recibo de la transferencia
        Ok(transfer_receipt)
    }

    #[allow(dead_code)]
    pub async fn decrypt_user_data(&self, encrypted_data: &str) -> Result<UserData> {
        let encrypted_bytes = hex::decode(encrypted_data)?;
        if encrypted_bytes.len() < 12 {
            return Err(anyhow::anyhow!("Invalid encrypted data"));
        }
        
        let key = self.get_private_key();
        let cipher = Aes256Gcm::new_from_slice(&key[0..32])?;
        
        let nonce = Nonce::from_slice(&encrypted_bytes[..12]);
        let ciphertext = &encrypted_bytes[12..];
        
        let decrypted = cipher.decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption error: {:?}", e))?;
        let user_data = serde_json::from_slice(&decrypted)?;
        Ok(user_data)
    }

    pub async fn get_balance(&self, address: Address) -> Result<U256> {
        let balance: U256 = self.contract
            .method("balanceOf", address)?
            .call()
            .await?;

        Ok(balance)
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct NftMetadata {
    pub name: String,
    pub description: String,
    pub image: String,
    pub encrypted_user_data: String,
    pub attributes: Vec<NftAttribute>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct NftAttribute {
    pub trait_type: String,
    pub value: String,
}

// Estructura para los datos del usuario que serán encriptados
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserData {
    pub username: String,
    pub email: String,
    pub wallet_address: String,
    pub avatar_url: String,
    pub additional_data: Option<serde_json::Value>,
}

impl ToString for UserData {
    fn to_string(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }
}
