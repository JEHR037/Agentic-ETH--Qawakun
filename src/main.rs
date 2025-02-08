use actix_web::{App, HttpServer, web};
use dotenv::dotenv;
use ethers::signers::{LocalWallet, Signer};
use ethers::signers::coins_bip39::English;
use ethers::signers::MnemonicBuilder;
use crate::farcaster::{Auth, CastClient};
use crate::api::cdp::nfts::NftManager;
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
    println!("Starting Farcaster monitoring");
    
    loop {
        if let Err(e) = cast_client.fetch_and_process_mentions(892331, Some(10)).await {
            println!("Error processing Farcaster mentions: {}", e);
        }
        
        sleep(Duration::from_secs(60*10)).await;
    }
}

#[actix_web::main]
async fn main() -> Result<()> {
    // Load environment variables and check
    match dotenv() {
        Ok(_) => println!("📁 Environment variables loaded successfully"),
        Err(e) => println!("❌ Error loading .env: {:?}", e),
    }
    
    println!("\n🔍 Checking required environment variables:");
    let required_vars = [
        "APP_USER", "APP_PASSWORD", "JWT_SECRET", "OPENAI_API_KEY",
        "TWITTER_API_KEY", "TWITTER_API_SECRET",
        "TWITTER_ACCESS_TOKEN", "TWITTER_ACCESS_SECRET",
        "BASE_SEPOLIA_RPC_URL",
        "MNEMONIC",
        "NFT_CONTRACT_ADDRESS"
    ];

    let mut missing_vars = Vec::new();
    for var in &required_vars {
        match std::env::var(var) {
            Ok(_) => continue,
            Err(_) => missing_vars.push(*var),
        }
    }

    if missing_vars.is_empty() {
        println!("✅ All required variables are configured");
    } else {
        println!("❌ Missing variables:");
        for var in missing_vars {
            println!("   • {}", var);
        }
        return Err(anyhow::anyhow!("Missing required environment variables"));
    }
    
    println!("\n🚀 Starting server at http://127.0.0.1:8080");
    sleep(Duration::from_secs(2)).await;

    println!("\n📱 Initializing X (Twitter) integration...");
    let twitter_client = match twitter::client::TwitterClient::new().await {
        Ok(client) => {
            println!("✅ X (Twitter) client initialized successfully");
            Some(client)
        },
        Err(e) => {
            println!("⚠️ Error initializing X (Twitter) (server will continue without X): {}", e);
            None
        }
    };

    if let Some(client) = twitter_client {
        println!("🔗 Starting X (Twitter) streams...");
        let twitter_client_clone = client.clone();
        tokio::spawn(async move {
            if let Err(e) = twitter::stream::start_streams(twitter_client_clone).await {
                println!("⚠️ Error in X (Twitter) streams: {}", e);
            }
        });
    }
    
    sleep(Duration::from_secs(2)).await;
    println!("\n🌟 Initializing Farcaster integration...");
    let farcaster_client = match async {
        let mnemonic = std::env::var("MNEMONIC")?;
        println!("🔑 Generating wallet from seed phrase...");
        let wallet: LocalWallet = MnemonicBuilder::<English>::default()
            .phrase(mnemonic.as_str())
            .derivation_path("m/44'/60'/0'/0/0")?
            .build()?
            .with_chain_id(1u64);

        let wallet_address = wallet.address();
        println!("👛 Wallet address: {}", wallet_address);
        
        println!("🔍 Verifying generated wallet...");
        let address_bytes = wallet_address.as_bytes();
        let address_suffix = &address_bytes[address_bytes.len()-4..];
        println!("✨ Wallet verification: ...{}", hex::encode(address_suffix));
        
        println!("🔐 Starting Farcaster session...");
        let session_token = Auth::handle_session(&wallet, Some(3600)).await?;
        
        println!("🔗 Creating Casts client...");
        let cast_client = CastClient::new(session_token, &env::var("REDIS_URL")?)?;
        
        Ok::<_, anyhow::Error>(cast_client)
    }.await {
        Ok(client) => {
            println!("✅ Farcaster client initialized successfully");
            Some(client)
        },
        Err(e) => {
            println!("⚠️ Error initializing Farcaster (server will continue without Farcaster): {}", e);
            None
        }
    };

    if let Some(client) = farcaster_client {
        println!("📡 Starting Farcaster monitoring...");
        let cast_client_clone = client;
        tokio::spawn(async move {
            start_farcaster_monitoring(cast_client_clone).await;
        });
    }

    sleep(Duration::from_secs(2)).await;
    println!("\n🎮 Initializing NFT Manager...");
    let redis_client = web::Data::new(redis::Client::open(env::var("REDIS_URL")?)?);
    
    let nft_manager = match NftManager::new().await {
        Ok(manager) => {
            println!("✅ NFT Manager initialized successfully");
            web::Data::new(manager)
        },
        Err(e) => {
            println!("❌ Error initializing NFT Manager: {}", e);
            return Err(anyhow::anyhow!("Failed to initialize NFT Manager"));
        }
    };

    sleep(Duration::from_secs(2)).await;
    println!("\n🌐 Configuring web server...");
    HttpServer::new(move || {
        App::new()
            .app_data(redis_client.clone())
            .app_data(nft_manager.clone())
            .configure(api::handlers::config)
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await?;
    
    Ok(())
}
