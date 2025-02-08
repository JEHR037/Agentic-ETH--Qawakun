use serde::{Deserialize, Serialize};
use anyhow::Result;
use redis::AsyncCommands;
use serde_json::json;
use chrono::{DateTime, Utc};
use std::collections::HashSet;
use crate::openai_methods::get_text::handle_conversation;
use std::env;

const API_ROOT: &str = "https://api.warpcast.com";
const LAST_PROCESSED_CAST_KEY: &str = "farcaster:last_processed_cast";
const MY_FID: u64 = 892331;  // Tu FID

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
                "text": content
            }),
            None => json!({ "text": content })
        };

        let client = reqwest::Client::new();
        let response = client
            .post(format!("{}/v2/casts", API_ROOT))
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", self.session_token))
            .json(&payload)
            .send()
            .await?;

        let cast: Cast = response.json().await?;
        
        let mut con = self.redis_client.get_async_connection().await?;
        let key = format!("farcaster:conversation:{}", cast.thread_hash.as_deref().unwrap_or(&cast.hash));
        let _: () = con.hset(&key, cast.hash.clone(), serde_json::to_string(&cast)?).await?;
        
        Ok(cast)
    }

    pub async fn fetch_and_process_mentions(&self, fid: u64, limit: Option<i32>) -> Result<()> {
        println!("👂 Buscando menciones en Farcaster...");
        let mut con = self.redis_client.get_async_connection().await?;
        

        let last_processed: Option<String> = con.get(LAST_PROCESSED_CAST_KEY).await.ok();
        if let Some(ref last) = last_processed {
            println!("📝 Último cast procesado: {}", last);
        }
        
        let casts = self.get_casts_by_fid(fid, limit, None).await?;
        println!("📥 {} casts obtenidos", casts.result.casts.len());
        
        let mut new_mentions = Vec::new();
        let mut processed = HashSet::new();

        for cast in casts.result.casts {

            if let Some(ref last) = last_processed {
                if cast.hash == *last {
                    println!("✓ Llegamos al último cast procesado");
                    break;
                }
            }

            if processed.is_empty() {
                let _: () = con.set(LAST_PROCESSED_CAST_KEY, &cast.hash).await?;
                println!("💾 Nuevo último cast guardado: {}", cast.hash);
            }
            
            processed.insert(cast.hash.clone());

            if cast.author.fid != MY_FID && self.is_mention_to_us(&cast) {
                new_mentions.push(cast);
            }
        }

        if !new_mentions.is_empty() {
            println!("\n🔔 {} nuevas menciones encontradas", new_mentions.len());
            for mention in new_mentions {
                println!("\n=== Nueva Mención ===");
                println!("🔷 Cast ID: {}", mention.hash);
                println!("👤 De: @{} (FID: {})", mention.author.username, mention.author.fid);
                println!("📝 Mensaje: {}", mention.text);
                println!("⏰ Timestamp: {}", mention.format_timestamp());
                

                if let Err(e) = self.handle_mention(&mention).await {
                    println!("❌ Error procesando mención: {}", e);
                }
            }
        } else {
            println!("😴 No hay nuevas menciones");
        }

        Ok(())
    }

    async fn handle_mention(&self, cast: &Cast) -> Result<()> {
        let author = cast.author.username.clone();
        let content = cast.text.clone();
        

        if self.is_spam(&content) {
            println!("🚫 Spam detectado, ignorando cast");
            return Ok(());
        }

        println!("👤 De: @{}", author);
        println!("💭 Mensaje: {}", content);


        let conversation_key = format!("farcaster:conversation:{}",
            cast.thread_hash.as_deref().unwrap_or(&cast.hash));
        
        let mut con = self.redis_client.get_async_connection().await?;
        

        let _: () = con.hset(&conversation_key, &cast.hash, serde_json::to_string(&cast)?).await?;
        println!("💾 Cast guardado en conversación: {}", conversation_key);


        let api_key = env::var("OPENAI_API_KEY")
            .map_err(|e| anyhow::anyhow!("Error obteniendo OPENAI_API_KEY: {}", e))?;
        let context = std::fs::read_to_string("context.md")
            .map_err(|e| anyhow::anyhow!("Error leyendo context.md: {}", e))?;


        let response = handle_conversation(
            &self.redis_client,
            &api_key,
            &author,
            &context,
            &content
        )
        .await
        .map_err(|e| anyhow::anyhow!("Error generando respuesta con OpenAI: {}", e))?;

        if let Some(message) = response["choices"][0]["message"]["content"].as_str() {
            println!("✍️ Respuesta generada: {}", message);

            let reply = self.publish_cast(message, Some((&cast.hash, cast.author.fid))).await?;
            println!("📤 Respuesta publicada con ID: {}", reply.hash);


            let _: () = con.hset(&conversation_key, &reply.hash, serde_json::to_string(&reply)?).await?;
            println!("💾 Respuesta guardada en conversación");

            let _: () = con.expire(&conversation_key, 24*60*60).await?;
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

    fn is_mention_to_us(&self, cast: &Cast) -> bool {
        let is_mention = cast.text.to_lowercase().contains("@tayni-co");
        let is_reply = cast.parent_hash.is_some();
        
        if is_mention {
            println!("🎯 Mención directa detectada");
        } else if is_reply {
            println!("↩️ Respuesta detectada");
        }
        
        is_mention || is_reply
    }
} 