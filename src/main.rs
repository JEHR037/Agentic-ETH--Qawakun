use actix_web::{App, HttpServer, web};
use dotenv::dotenv;
use ethers::signers::{LocalWallet, Signer};
use ethers::signers::coins_bip39::English;
use ethers::signers::MnemonicBuilder;
use crate::farcaster::{Auth, CastClient};
use tokio::time::{sleep, Duration};
mod api;
mod openai_methods;
mod twitter;
mod farcaster;
use hex;
use anyhow::Result;
use std::env;
use redis;

async fn start_farcaster_monitoring(cast_client: CastClient) {
    println!("📡 Iniciando monitoreo de Farcaster");
    
    loop {
        if let Err(e) = cast_client.fetch_and_process_mentions(892331, Some(10)).await {
            println!("❌ Error procesando menciones de Farcaster: {}", e);
        }
        
        // Esperar 1 minuto antes de la siguiente revisión
        sleep(Duration::from_secs(60)).await;
    }
}

#[actix_web::main]
async fn main() -> Result<()> {
    // Load environment variables and check
    match dotenv() {
        Ok(_) => println!("Environment variables loaded successfully"),
        Err(e) => println!("Error loading .env: {:?}", e),
    }
    
    // Check critical variables
    for var in &[
        "APP_USER", "APP_PASSWORD", "JWT_SECRET", "OPENAI_API_KEY",
        "TWITTER_API_KEY", "TWITTER_API_SECRET",
        "TWITTER_ACCESS_TOKEN", "TWITTER_ACCESS_SECRET","MNEMONIC","NODE_URL"
    ] {
        match std::env::var(var) {
            Ok(_) => println!("✅ Variable {} found", var),
            Err(e) => println!("❌ Error loading {}: {:?}", var, e),
        }
    }
    
    println!("Server starting at http://127.0.0.1:8080");
    // Inicializar cliente de Twitter
    // let twitter_client = match twitter::client::TwitterClient::new().await {
    //     Ok(client) => client,
    //     Err(e) => {
    //         println!("❌ Error initializing Twitter: {}", e);
    //         return Ok(());
    //     }
    // };

    // Clonar el cliente para el nuevo hilo
    // let twitter_client_clone = twitter_client.clone();

    // Iniciar streams de Twitter en un nuevo hilo
    // tokio::spawn(async move {
    //     if let Err(e) = twitter::stream::start_streams(twitter_client_clone).await {
    //         println!("❌ Error in Twitter streams: {}", e);
    //     }
    // });

    println!("\n=== Iniciando autenticación con Farcaster ===");
    let mnemonic = std::env::var("MNEMONIC")
        .map_err(|_| anyhow::anyhow!("MNEMONIC no encontrada en .env"))?;
    
    println!("🔑 Generando wallet desde frase semilla...");
    let wallet: LocalWallet = MnemonicBuilder::<English>::default()
        .phrase(mnemonic.as_str())
        .derivation_path("m/44'/60'/0'/0/0")
        .map_err(|e| anyhow::anyhow!("Error en el path de derivación: {}", e))?
        .build()
        .map_err(|e| anyhow::anyhow!("Error generando wallet desde mnemónica: {}", e))?
        .with_chain_id(1u64); // Mainnet

    let wallet_address = wallet.address();
    println!("📝 Dirección completa del wallet: {}", wallet_address);
    println!("🔍 Verificando wallet generado...");
    
    // Obtener los últimos 4 bytes de la dirección para verificación
    let address_bytes = wallet_address.as_bytes();
    let address_suffix = &address_bytes[address_bytes.len()-4..];
    println!("🔐 Verificación de wallet: ...{}", hex::encode(address_suffix));
    
    println!("🌟 Iniciando sesión en Farcaster con dirección: {}", wallet.address());
    
    let session_token = Auth::handle_session(&wallet, Some(3600)).await?;
    
    // Crear el cliente de Casts
    let cast_client = CastClient::new(session_token, &env::var("REDIS_URL")?)?;
    
    // Iniciar el monitoreo de Farcaster en un nuevo thread
    let cast_client_clone = cast_client;
    tokio::spawn(async move {
        start_farcaster_monitoring(cast_client_clone).await;
    });

    let redis_client = web::Data::new(redis::Client::open(env::var("REDIS_URL")?)?);

    HttpServer::new(move || {
        App::new()
            .app_data(redis_client.clone())
            .configure(api::handlers::config)
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await?;
    
    Ok(())
}
