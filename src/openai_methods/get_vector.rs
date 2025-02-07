use reqwest::header;
use serde_json::json;

async fn create_embedding(input: &str, model: &str) -> Result<serde_json::Value, reqwest::Error> {
    let client = reqwest::Client::new();
    let url = "https://api.openai.com/v1/embeddings";
    let openai_api_key = std::env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY not set");

    let mut headers = header::HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, header::HeaderValue::from_static("application/json"));
    headers.insert(header::AUTHORIZATION, header::HeaderValue::from_str(&format!("Bearer {}", openai_api_key)).unwrap());

    let body = json!({
        "input": input,
        "model": model,
    });

    let response = client.get(url).headers(headers).json(&body).send().await?;
    let response_body = response.json().await?;

    Ok(response_body)
}