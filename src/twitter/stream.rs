use super::client::TwitterClient;
use super::handlers::handle_mention;
use tokio::time::{sleep, Duration};
use std::error::Error;
use redis::AsyncCommands;
use std::env;

const LAST_MENTION_KEY: &str = "twitter:last_mention_id";

pub async fn start_streams(client: TwitterClient) -> Result<(), Box<dyn Error + Send + Sync>> {
    println!("📡 Starting X monitoring");
    let redis_url = env::var("REDIS_URL")?;
    let redis_client = redis::Client::open(redis_url)?;
    let mut con = redis_client.get_async_connection().await?;
    
    loop {
        println!("👂 Looking for mentions...");
        

        let since_id: Option<u64> = con.get(LAST_MENTION_KEY).await.ok();
        
        match client.get_mentions_since(since_id).await {
            Ok(tweets) => {
                for tweet in tweets.iter().rev() {
                    println!("📨 Mention received");
                    if let Err(e) = handle_mention(&client, tweet.clone()).await {
                        println!("❌ Error processing mention: {}", e);
                    }
                    let _: () = con.set(LAST_MENTION_KEY, tweet.id.as_u64()).await?;
                    println!("💾 Last mention ID saved");
                }
            },
            Err(e) => println!("❌ Error getting mentions: {}", e)
        }
        
        sleep(Duration::from_secs(60)).await;
    }
}