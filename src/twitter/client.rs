use twitter_v2::authorization::Oauth1aToken;
use twitter_v2::TwitterApi;
use std::env;
use std::sync::Arc;
use std::error::Error;
use std::time::Duration;
use tokio::time::sleep;

pub struct TwitterClient {
    pub api: Arc<TwitterApi<Oauth1aToken>>,
    pub user_id: u64,
}

impl TwitterClient {
    pub async fn new() -> Result<Self, Box<dyn Error + Send + Sync>> {
        println!("🔑 Starting OAuth authentication...");
        
        let api_key = env::var("TWITTER_API_KEY")?;
        let api_secret = env::var("TWITTER_API_SECRET")?;
        let access_token = env::var("TWITTER_ACCESS_TOKEN")?;
        let access_secret = env::var("TWITTER_ACCESS_SECRET")?;

        let auth = Oauth1aToken::new(
            api_key,
            api_secret,
            access_token,
            access_secret,
        );

        let api = Arc::new(TwitterApi::new(auth));

        println!("👤 Fetching user information...");
        let me = api.get_users_me()
            .send()
            .await?;
        
        let user_id = me.data
            .as_ref()
            .ok_or("No user data found")?
            .id
            .as_u64();
        
        println!("✅ Twitter client started (ID: {})", user_id);
        Ok(Self { 
            api,
            user_id
        })
    }

    pub async fn get_user_by_username(&self, username: &str) -> Result<u64, Box<dyn Error + Send + Sync>> {
        let user = self.api.get_user_by_username(username)
            .send()
            .await?;
        Ok(user.data
            .as_ref()
            .ok_or("No user data found")?
            .id
            .as_u64())
    }

    pub async fn post_reply(&self, tweet_id: &str, text: &str) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.api
            .post_tweet()
            .in_reply_to_tweet_id(tweet_id.parse::<u64>()?)
            .text(text.to_string())
            .send()
            .await?;
        Ok(())
    }

    pub async fn get_mentions_since(&self, since_id: Option<u64>) -> Result<Vec<twitter_v2::Tweet>, Box<dyn Error + Send + Sync>> {
        let mut request = self.api.get_user_mentions(self.user_id);
        
        let request = if let Some(id) = since_id {
            request.since_id(id)
        } else {
            &mut request 
        };

        let mentions = request.send().await;

        match mentions {
            Ok(response) => {
                Ok(response.data.as_ref().map(|d| d.clone()).unwrap_or_default())
            },
            Err(err) => {
                println!("Error fetching mentions: {:?}", err);
                Ok(vec![]) 
            },
        }
    }

    pub async fn process_mentions(&self, since_id: Option<u64>) {
        loop {
            match self.get_mentions_since(since_id).await {
                Ok(mentions) => {
                    for mention in mentions {
                        println!("Mention: {:?}", mention);
                    }
                }
                Err(err) => {
                    println!("Error processing mentions: {:?}", err);
                }
            }
            sleep(Duration::from_secs(901)).await;
        }
    }
}

impl Clone for TwitterClient {
    fn clone(&self) -> Self {
        Self {
            api: Arc::clone(&self.api),
            user_id: self.user_id,
        }
    }
}