use redis::AsyncCommands;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatCompletionsBody {
    model: String,
    messages: Vec<ChatMessage>,
}

fn create_chat_completions_body(messages: Vec<ChatMessage>) -> ChatCompletionsBody {
    ChatCompletionsBody {
        model: "gpt-4o-mini-2024-07-18".to_string(),
        messages,
    }
}

pub async fn get_chat_completion(
    api_key: &str, 
    messages: Vec<ChatMessage>
) -> Result<serde_json::Value, Box<dyn Error + Send + Sync>> {
    let client = Client::new();
    let body = create_chat_completions_body(messages);

    println!("📤 OpenAI request");
    let response = match client.post("https://api.openai.com/v1/chat/completions")
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await 
    {
        Ok(resp) => {
            println!("📥 OpenAI status: {}", resp.status());
            resp
        },
        Err(e) => {
            println!("❌ OpenAI error: {}", e);
            return Err(Box::new(e));
        }
    };

    match response.json().await {
        Ok(completion) => Ok(completion),
        Err(e) => {
            println!("❌ JSON error: {}", e);
            Err(Box::new(e))
        }
    }
}

pub async fn handle_conversation(
    redis_client: &redis::Client,
    api_key: &str,
    user_author: &str,
    system_content: &str,
    user_content: &str
) -> Result<serde_json::Value, Box<dyn Error + Send + Sync>> {
    let mut con = match redis_client.get_async_connection().await {
        Ok(conn) => conn,
        Err(e) => {
            println!("❌ Redis connection error: {}", e);
            return Err(Box::new(e));
        }
    };

    let conversation_key = format!("conversation:{}", user_author);
    let mut messages: Vec<ChatMessage> = match con.get::<_, String>(&conversation_key).await {
        Ok(stored_json) => {
            println!("📖 Existing chat");
            serde_json::from_str(&stored_json)?
        },
        Err(_) => {
            println!("🆕 New chat");
            vec![ChatMessage {
                role: "system".to_string(),
                content: system_content.to_string(),
            }]
        }
    };

    messages.push(ChatMessage {
        role: "user".to_string(),
        content: user_content.to_string(),
    });

    let response = get_chat_completion(api_key, messages.clone()).await?;

    if let Some(message_content) = response["choices"][0]["message"]["content"].as_str() {
        messages.push(ChatMessage {
            role: "assistant".to_string(),
            content: message_content.to_string(),
        });
        
        if let Ok(json) = serde_json::to_string(&messages) {
            match con.set::<_, _, ()>(conversation_key, json).await {
                Ok(_) => println!("💾 Chat saved"),
                Err(e) => println!("⚠️ Error saving chat: {}", e)
            }
        }
    }

    Ok(response)
}