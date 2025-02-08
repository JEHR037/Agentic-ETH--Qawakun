use reqwest::header;
use serde_json::json;
use anyhow::Result;

pub async fn generate_image(prompt: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let url = "https://api.openai.com/v1/images/generations";
    let openai_api_key = std::env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY not set");

    let mut headers = header::HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE, 
        header::HeaderValue::from_static("application/json")
    );
    headers.insert(
        header::AUTHORIZATION, 
        header::HeaderValue::from_str(&format!("Bearer {}", openai_api_key))?
    );

    let modified_prompt = format!(
        "I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS: {}",
        prompt
    );

    let body = json!({
        "model": "dall-e-2",
        "prompt": modified_prompt,
        "n": 1,
        "size": "512x512",
        "response_format": "b64_json"
    });

    println!("🎨 Enviando solicitud a DALL-E 2 con prompt: {}", modified_prompt);
    
    let response = client
        .post(url)
        .headers(headers)
        .json(&body)
        .send()
        .await?;

    if !response.status().is_success() {
        let error_text = response.text().await?;
        return Err(anyhow::anyhow!("Error de OpenAI: {}", error_text));
    }

    let response_data: serde_json::Value = response.json().await?;
    
    if let Some(revised_prompt) = response_data["data"][0]["revised_prompt"].as_str() {
        println!("📝 Prompt revisado por DALL-E: {}", revised_prompt);
    }
    
    let base64_image = response_data["data"][0]["b64_json"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("No se encontró la imagen en la respuesta"))?;

    println!("✅ Imagen generada exitosamente");
    
    Ok(base64_image.to_string())
}