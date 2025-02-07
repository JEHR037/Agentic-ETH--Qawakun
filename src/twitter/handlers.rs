use super::client::TwitterClient;
use crate::openai_methods::get_text::handle_conversation;
use twitter_v2::Tweet;
use std::env;
use std::error::Error;
use std::collections::HashSet;
use lazy_static::lazy_static;
use regex::Regex;
use std::sync::Mutex;

lazy_static! {
    static ref REPLIED_TWEETS: Mutex<HashSet<String>> = Mutex::new(HashSet::new());
    static ref SPAM_PATTERNS: Vec<Regex> = vec![
        Regex::new(r"(?i)crypto").unwrap(),
        Regex::new(r"(?i)pump").unwrap(),
        Regex::new(r"(?i)airdrop").unwrap(),
        Regex::new(r"(?i)blast").unwrap(),
        Regex::new(r"(?i)token").unwrap(),
        Regex::new(r"https?://").unwrap(),
        Regex::new(r"(?i)drop").unwrap(),
    ];
}

fn is_spam(text: &str) -> bool {
    let mention_count = text.matches('@').count();
    if mention_count > 3 {
        return true;
    }

    for pattern in SPAM_PATTERNS.iter() {
        if pattern.is_match(text) {
            return true;
        }
    }

    false
}

pub async fn handle_mention(
    client: &TwitterClient, 
    tweet: Tweet
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let tweet_id = tweet.id.to_string();

    {
        let mut replied = REPLIED_TWEETS.lock().unwrap();
        if replied.contains(&tweet_id) {
            println!("🔄 Tweet already replied to, ignoring...");
            return Ok(());
        }
        
        if replied.len() > 1000 {
            replied.clear();
        }
        
        replied.insert(tweet_id);
    }

    let author = tweet.author_id
        .map(|id| id.as_u64().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let content = tweet.text;
    
    // Check for spam
    if is_spam(&content) {
        println!("🚫 Spam detected, ignoring tweet");
        return Ok(());
    }

    println!("👤 From: @{}", author);
    println!("💭 Message: {}", content);

    let redis_client = redis::Client::open(env::var("REDIS_URL")?)?;
    let api_key = env::var("OPENAI_API_KEY")?;
    let context = std::fs::read_to_string("context.md")?;

    let response = handle_conversation(
        &redis_client,
        &api_key,
        &author,
        &context,
        &content
    ).await?;

    if let Some(message) = response["choices"][0]["message"]["content"].as_str() {
        client.post_reply(&tweet.id.to_string(), message).await?;
        println!("✅ Reply sent");
    }

    Ok(())
}