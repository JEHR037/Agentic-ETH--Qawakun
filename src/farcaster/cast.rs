use serde::{Deserialize, Serialize};
use anyhow::Result;
use redis::AsyncCommands;
use serde_json::json;
use chrono::{DateTime, Utc};
use crate::openai_methods::get_text::handle_conversation;
use std::env;
use tokio;

const API_ROOT: &str = "https://api.warpcast.com";
const LAST_PROCESSED_CAST_KEY: &str = "farcaster:last_processed_cast";
const MY_FID: u64 = 979204;  // Tu FID
const BOT_USERNAME: &str = "@qawakun";  // Agregar esta constante

#[derive(Debug, Deserialize)]
pub struct CastRoot {
    result: CastResult,
}

#[derive(Debug, Deserialize)]
pub struct CastResult {
    casts: Vec<Cast>,
    #[serde(default)]
    cursor: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Cast {
    hash: String,
    thread_hash: Option<String>,
    parent_hash: Option<String>,
    author: CastAuthor,
    text: String,
    timestamp: i64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CastAuthor {
    fid: u64,
    username: String,
}

impl Cast {
    fn format_timestamp(&self) -> String {
        let dt = DateTime::<Utc>::from_timestamp(self.timestamp / 1000, 0)
            .unwrap_or_default();
        dt.format("%Y-%m-%d %H:%M:%S UTC").to_string()
    }
}

pub struct CastClient {
    session_token: String,
    redis_client: redis::Client,
}

impl CastClient {
    pub fn new(session_token: String, redis_url: &str) -> Result<Self> {
        let redis_client = redis::Client::open(redis_url)?;
        Ok(Self { session_token, redis_client })
    }

    pub async fn fetch_and_display_recent_casts(&self, fid: u64, limit: Option<i32>) -> Result<()> {
        println!("📥 Obteniendo casts recientes...");
        
        let casts = self.get_casts_by_fid(fid, limit, None).await?;
        
        println!("\n=== Casts Encontrados ===");
        for cast in casts.result.casts {
            println!("\n🔷 Cast ID: {}", cast.hash);
            println!("👤 Autor: @{} (FID: {})", cast.author.username, cast.author.fid);
            println!("📝 Contenido: {}", cast.text);
            println!("⏰ Timestamp: {}", cast.format_timestamp());
            
            if let Some(ref thread) = cast.thread_hash {
                println!("🧵 Thread ID: {}", thread);
            }
            if let Some(ref parent) = cast.parent_hash {
                println!("↩️ Respuesta a: {}", parent);
            }
            
            // Verificar si es parte de una conversación
            let mut con = self.redis_client.get_async_connection().await?;
            let conversation_key = format!("farcaster:conversation:{}", 
                cast.thread_hash.as_deref().unwrap_or(&cast.hash));
            
            let conversation_exists: bool = con.exists(&conversation_key).await?;
            if conversation_exists {
                println!("💬 Parte de una conversación activa");
            }
        }

        Ok(())
    }

    pub async fn get_casts_by_fid(&self, fid: u64, limit: Option<i32>, cursor: Option<&str>) -> Result<CastRoot> {
        let mut url = format!("{}/v2/casts?fid={}", API_ROOT, fid);
        if let Some(limit) = limit {
            url.push_str(&format!("&limit={}", limit));
        }
        if let Some(cursor) = cursor {
            url.push_str(&format!("&cursor={}", cursor));
        }

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.session_token))
            .send()
            .await?;

        let casts: CastRoot = response.json().await?;
        

        let mut con = self.redis_client.get_async_connection().await?;
        for cast in &casts.result.casts {
            let key = format!("farcaster:conversation:{}", cast.thread_hash.as_deref().unwrap_or(&cast.hash));
            let _: () = con.hset(&key, cast.hash.clone(), serde_json::to_string(cast)?).await?;
            let _: () = con.expire(&key, 24*60*60).await?; // Expira en 24 horas
        }

        Ok(casts)
    }

    pub async fn publish_cast(&self, content: &str, reply_to: Option<(&str, u64)>) -> Result<Cast> {
        let payload = match reply_to {
            Some((parent_hash, parent_fid)) => json!({
                "parent": {
                    "hash": parent_hash,
                    "fid": parent_fid
                },
                "text": content.trim()
            }),
            None => json!({ 
                "text": content.trim() 
            })
        };

        let response = reqwest::Client::new()
            .post(format!("{}/v2/casts", API_ROOT))
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", self.session_token))
            .json(&payload)
            .send()
            .await?
            .text()
            .await?;

        let cast: Cast = serde_json::from_str(&response)?;
        
        // Guardar en Redis para mantener el historial de la conversación
        let mut con = self.redis_client.get_async_connection().await?;
        let key = format!("farcaster:conversation:{}", 
            cast.thread_hash.as_deref().unwrap_or(&cast.hash));
        let _: () = con.hset(&key, &cast.hash, &response).await?;
        let _: () = con.expire(&key, 24*60*60).await?;

        Ok(cast)
    }

    pub async fn fetch_and_process_mentions(&self, fid: u64, limit: Option<i32>) -> Result<()> {
        println!("👂 Looking for Farcaster mentions...");
        let mut con = self.redis_client.get_async_connection().await?;
        let last_processed: Option<String> = con.get(LAST_PROCESSED_CAST_KEY).await.ok();
        
        let casts = self.get_casts_by_fid(fid, limit, None).await?;
        println!("📥 {} casts retrieved", casts.result.casts.len());
        
        let mut new_mentions = Vec::new();
        let mut found_last = false;

        for cast in &casts.result.casts {
            if let Some(ref last) = last_processed {
                if cast.hash == *last {
                    found_last = true;
                    continue;
                }
            }

            if !found_last || last_processed.is_none() {
                if cast.author.fid != MY_FID && self.is_mention_to_us(&cast) {
                    println!("\n🎯 New mention needs response: {}", cast.text);
                    new_mentions.push(cast.clone());
                }
            }
        }

        if let Some(first_cast) = casts.result.casts.first() {
            let _: () = con.set(LAST_PROCESSED_CAST_KEY, &first_cast.hash).await?;
        }

        if !new_mentions.is_empty() {
            println!("\n🔔 Processing {} new mentions", new_mentions.len());
            new_mentions.reverse();
            
            for mention in new_mentions {
                match self.handle_mention(&mention).await {
                    Ok(_) => println!("✅ Successfully replied to: {}", mention.text),
                    Err(e) => println!("❌ Failed to reply: {}", e),
                }
            }
        }

        Ok(())
    }

    fn is_mention_to_us(&self, cast: &Cast) -> bool {
        let is_mention = cast.text.to_lowercase().contains(&BOT_USERNAME.to_lowercase());
        
        let is_reply_to_us = match &cast.parent_hash {
            Some(parent_hash) => {
                let rt = tokio::runtime::Runtime::new().unwrap();
                
                rt.block_on(async {
                    if let Ok(mut con) = self.redis_client.get_async_connection().await {
                        let conversation_key = format!("farcaster:conversation:{}", 
                            cast.thread_hash.as_deref().unwrap_or(parent_hash));
                        
                        match con.hget::<_, _, Option<String>>(&conversation_key, parent_hash).await {
                            Ok(Some(parent_cast_str)) => {
                                if let Ok(parent_cast) = serde_json::from_str::<Cast>(&parent_cast_str) {
                                    parent_cast.author.fid == MY_FID || 
                                    parent_cast.author.fid == cast.author.fid
                                } else {
                                    false
                                }
                            },
                            _ => false
                        }
                    } else {
                        false
                    }
                })
            },
            None => false
        };

        is_mention || is_reply_to_us
    }

    async fn handle_mention(&self, cast: &Cast) -> Result<()> {
        if self.is_spam(&cast.text) {
            return Ok(());
        }

        let conversation_key = format!("farcaster:conversation:{}", 
            cast.thread_hash.as_deref().unwrap_or(&cast.hash));
        
        let api_key = env::var("OPENAI_API_KEY")
            .map_err(|e| anyhow::anyhow!("Failed to get OPENAI_API_KEY: {}", e))?;
        let context = std::fs::read_to_string("context.md")
            .map_err(|e| anyhow::anyhow!("Failed to read context.md: {}", e))?;

        let response = handle_conversation(
            &self.redis_client,
            &api_key,
            &cast.author.username,
            &context,
            &cast.text
        )
        .await
        .map_err(|e| anyhow::anyhow!("OpenAI API error: {}", e))?;

        if let Some(message) = response["choices"][0]["message"]["content"].as_str() {
            let reply = self.publish_cast(message, Some((&cast.hash, cast.author.fid))).await
                .map_err(|e| anyhow::anyhow!("Failed to publish cast: {}", e))?;

            let mut con = self.redis_client.get_async_connection().await
                .map_err(|e| anyhow::anyhow!("Redis connection error: {}", e))?;
            
            con.hset(&conversation_key, &reply.hash, serde_json::to_string(&reply)?)
                .await
                .map_err(|e| anyhow::anyhow!("Failed to save to Redis: {}", e))?;
            
            con.expire(&conversation_key, 24*60*60).await
                .map_err(|e| anyhow::anyhow!("Failed to set expiry: {}", e))?;
        } else {
            return Err(anyhow::anyhow!("No response content in OpenAI result"));
        }

        Ok(())
    }

    fn is_spam(&self, text: &str) -> bool {
        use lazy_static::lazy_static;
        use regex::Regex;

        lazy_static! {
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

        let mention_count = text.matches('@').count();
        if mention_count > 3 {
            println!("🚫 Demasiadas menciones detectadas");
            return true;
        }

        for pattern in SPAM_PATTERNS.iter() {
            if pattern.is_match(text) {
                println!("🚫 Patrón de spam detectado");
                return true;
            }
        }

        false
    }

    async fn get_casts_with_retry(&self, fid: u64, limit: Option<i32>, cursor: Option<&str>) -> Result<CastRoot> {
        let max_retries = 3;
        let mut retry_count = 0;
        let mut delay = 2;

        loop {
            match self.get_casts_by_fid(fid, limit, cursor).await {
                Ok(casts) => return Ok(casts),
                Err(e) => {
                    retry_count += 1;
                    if retry_count >= max_retries {
                        return Err(e);
                    }
                    println!("⚠️ Error getting casts (attempt {}/{}): {}", retry_count, max_retries, e);
                    println!("🕐 Waiting {} seconds before retry...", delay);
                    tokio::time::sleep(tokio::time::Duration::from_secs(delay)).await;
                    delay *= 2; // Exponential backoff
                }
            }
        }
    }
} 