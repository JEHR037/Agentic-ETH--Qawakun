use actix_web::{App, HttpServer};
use dotenv::dotenv;
mod api;
mod openai_methods;
mod twitter;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load environment variables and check
    match dotenv() {
        Ok(_) => println!("Environment variables loaded successfully"),
        Err(e) => println!("Error loading .env: {:?}", e),
    }
    
    // Check critical variables
    for var in &[
        "APP_USER", "APP_PASSWORD", "JWT_SECRET", "OPENAI_API_KEY",
        "TWITTER_API_KEY", "TWITTER_API_SECRET",
        "TWITTER_ACCESS_TOKEN", "TWITTER_ACCESS_SECRET"
    ] {
        match std::env::var(var) {
            Ok(_) => println!("✅ Variable {} found", var),
            Err(e) => println!("❌ Error loading {}: {:?}", var, e),
        }
    }
    
    println!("Server starting at http://127.0.0.1:8080");
    
    // Initialize Twitter client
    let twitter_client = match twitter::client::TwitterClient::new().await {
        Ok(client) => client,
        Err(e) => {
            println!("❌ Error initializing Twitter: {}", e);
            return Ok(());
        }
    };

    // Clone the client for the new thread
    let twitter_client_clone = twitter_client.clone();

    // Start streams in a new thread
    tokio::spawn(async move {
        if let Err(e) = twitter::stream::start_streams(twitter_client_clone).await {
            println!("❌ Error in streams: {}", e);
        }
    });

    HttpServer::new(|| {
        App::new()
            .configure(api::handlers::config)
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
