use actix_web::{web, HttpResponse, Responder, HttpRequest};
use serde::{Deserialize, Serialize};
use std::env;
use jsonwebtoken::{encode, EncodingKey, Header};
use chrono::{Utc, Duration};
use crate::openai_methods::get_text::handle_conversation;
use crate::api::auth::{verify_token, Claims};
use super::nft_claim::{handle_nft_claim_post, handle_nft_claim_get, mint_nft};
use super::proposals::{
    handle_proposal_by_wallet_get,
    handle_proposal_status_update,
    ProposalManager,
    Proposal,
    VoteNFT,
};
use redis::AsyncCommands;
use ethers::types::U256;
use serde_json::json;
use super::game_options::{handle_game_options_get, handle_game_options_set};

#[derive(Serialize, Deserialize, Debug)]
pub struct Post {
    post_type: String,
    data: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct LoginResponse {
    message: String,
    token: String,
}

async fn process_register(data: serde_json::Value) -> HttpResponse {
    let username = data["data"]["author"].as_str().unwrap_or("").to_string();

    HttpResponse::Ok().json(format!("User registered: {}", username))
}

async fn process_ads(data: serde_json::Value) -> HttpResponse {

    let ad_content = data["data"]["content"].as_str().unwrap_or("").to_string();

    HttpResponse::Ok().json(format!("Ad processed: {}", ad_content))
}

pub async fn protected_api(
    req: HttpRequest, 
    post: web::Json<Post>
) -> impl Responder {
    if let Err(response) = verify_token(&req).await {
        return response;
    }

    match post.post_type.as_str() {
        "message" => {
            let author = post.data["author"].as_str().unwrap_or("").to_string();
            let message_content = post.data["content"].as_str().unwrap_or("").to_string();
            let cleaned_data = serde_json::json!({
                "message": message_content,
                "author": author,
            });
            process_message(cleaned_data).await
        },
        "ads" => process_ads(post.data.clone()).await,
        "register" => process_register(post.data.clone()).await,
        _ => HttpResponse::BadRequest().body("Unrecognized post type"),
    }
}

async fn process_message(data: serde_json::Value) -> HttpResponse {
    let api_key = match env::var("OPENAI_API_KEY") {
        Ok(key) => key,
        Err(e) => {
            println!("❌ OPENAI_API_KEY: {}", e);
            return HttpResponse::InternalServerError().body("OPENAI_API_KEY not found");
        }
    };

    let redis_url = match env::var("REDIS_URL") {
        Ok(url) => url,
        Err(e) => {
            println!("❌ REDIS_URL: {}", e);
            return HttpResponse::InternalServerError().body("REDIS_URL not found");
        }
    };

    println!("🔌 Connected: {}", redis_url);
    let redis_client = match redis::Client::open(redis_url) {
        Ok(client) => client,
        Err(e) => {
            println!("❌ Redis connection: {}", e);
            return HttpResponse::InternalServerError().body(format!("Redis error: {}", e));
        }
    };

    let mut con = match redis_client.get_async_connection().await {
        Ok(con) => {
            println!("✅ Conexión Redis establecida");
            con
        },
        Err(e) => {
            println!("❌ Error de conexión Redis: {:?}", e);
            return HttpResponse::InternalServerError().body(format!("Redis error: {}", e));
        }
    };

    let context_content = match con.exists::<_, bool>("context-text").await {
        Ok(true) => {
            match con.get::<_, String>("context-text").await {
                Ok(content) => {
                    format!(
                        "You are Qawakun, a narrative guide in this interactive experience.\n{}\n\
                         Stay in character and maintain narrative consistency.",
                        content
                    )
                },
                Err(e) => {
                    println!("❌ Error leyendo contexto de Redis: {}", e);
                    println!("⚠️ Cambiando a archivo context.md como respaldo");
                    match std::fs::read_to_string("context.md") {
                        Ok(content) => format!(
                            "You are Qawakun, a narrative guide in this interactive experience.\n{}\n\
                             Stay in character and maintain narrative consistency.",
                            content
                        ),
                        Err(e) => {
                            println!("❌ Error leyendo context.md: {}", e);
                            return HttpResponse::InternalServerError().body("Narrative context error");
                        }
                    }
                }
            }
        },
        Ok(false) => {
            println!("⚠️ Usando archivo context.md (clave context-text no existe en Redis)");
            match std::fs::read_to_string("context.md") {
                Ok(content) => format!(
                    "You are Qawakun, a narrative guide in this interactive experience.\n{}\n\
                     Stay in character and maintain narrative consistency.",
                    content
                ),
                Err(e) => {
                    println!("❌ Error leyendo context.md: {}", e);
                    return HttpResponse::InternalServerError().body("Narrative context error");
                }
            }
        },
        Err(e) => {
            println!("❌ Error verificando existencia en Redis: {}", e);
            println!("⚠️ Cambiando a archivo context.md como respaldo");
            match std::fs::read_to_string("context.md") {
                Ok(content) => format!(
                    "You are Qawakun, a narrative guide in this interactive experience.\n{}\n\
                     Stay in character and maintain narrative consistency.",
                    content
                ),
                Err(e) => {
                    println!("❌ Error leyendo context.md: {}", e);
                    return HttpResponse::InternalServerError().body("Narrative context error");
                }
            }
        }
    };

    let user_content = data.get("message").and_then(|c| c.as_str()).unwrap_or("").to_string();
    let user_author = data.get("author").and_then(|c| c.as_str()).unwrap_or("").to_string();

    if user_content.is_empty() {
        return HttpResponse::BadRequest().body("Empty message");
    }

    println!("🤖 Processing message from {}", user_author);
    match handle_conversation(&redis_client, &api_key, &user_author, &context_content, &user_content).await {
        Ok(response) => {
            let message = response["choices"][0]["message"]["content"].as_str().unwrap_or("");
            println!("✅ Response sent");
            HttpResponse::Ok().json(message)
        },
        Err(e) => {
            println!("❌ Error: {}", e);
            HttpResponse::InternalServerError().body(format!("Error: {}", e))
        },
    }
}

pub async fn login(login_data: web::Json<serde_json::Value>) -> impl Responder {
    println!("Starting login process...");
    let username = login_data.get("user").and_then(|u| u.as_str()).unwrap_or("");
    let password = login_data.get("password").and_then(|p| p.as_str()).unwrap_or("");
    println!("Attempting to load environment variables...");
    
    let env_username = match env::var("APP_USER") {
        Ok(val) => {
            println!("APP_USER found: {}", val);
            val
        },
        Err(e) => {
            println!("Error loading APP_USER: {:?}", e);
            return HttpResponse::InternalServerError().body("Environment variable APP_USER not found");
        }
    };

    let env_password = match env::var("APP_PASSWORD") {
        Ok(val) => {
            println!("APP_PASSWORD found");
            val
        },
        Err(e) => {
            println!("Error loading APP_PASSWORD: {:?}", e);
            return HttpResponse::InternalServerError().body("Environment variable APP_PASSWORD not found");
        }
    };

    let jwt_secret = match env::var("JWT_SECRET") {
        Ok(val) => {
            println!("JWT_SECRET found");
            val
        },
        Err(e) => {
            println!("Error loading JWT_SECRET: {:?}", e);
            return HttpResponse::InternalServerError().body("Environment variable JWT_SECRET not found");
        }
    };

    println!("Credentials received - User: {}", username);
    println!("Expected credentials - User: {}", env_username);

    if username == env_username && password == env_password {
        println!("Valid credentials, generating token...");
        let expiration = Utc::now()
            .checked_add_signed(Duration::hours(1))
            .expect("Error calculating expiration date")
            .timestamp() as usize;
            
        let claims = Claims {
            sub: username.to_string(),
            exp: expiration,
            iat: Utc::now().timestamp() as usize,
        };

        match encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(jwt_secret.as_bytes())
        ) {
            Ok(token) => {
                let response = LoginResponse {
                    message: format!("User validated: {}", username),
                    token,
                };
                HttpResponse::Ok().json(response)
            }
            Err(e) => {
                println!("Error generating token: {:?}", e);
                HttpResponse::InternalServerError().body("Error generating token")
            }
        }
    } else {
        HttpResponse::Unauthorized().body("Invalid credentials")
    }
}

pub async fn handle_proposal_vote(
    req: HttpRequest,
    path: web::Path<(u64, bool)>,  // (proposal_id, support)
    proposal_manager: web::Data<ProposalManager>,
) -> impl Responder {
    if let Err(response) = verify_token(&req).await {
        return response;
    }

    let (proposal_id, support) = path.into_inner();
    
    match proposal_manager.vote_proposal(
        U256::from(proposal_id),
        support
    ).await {
        Ok(receipt) => HttpResponse::Ok().json(receipt),
        Err(e) => HttpResponse::InternalServerError().body(format!("Error voting: {}", e)),
    }
}

pub async fn handle_monthly_execution(
    req: HttpRequest,
    proposal_manager: web::Data<ProposalManager>,
) -> impl Responder {
    if let Err(response) = verify_token(&req).await {
        return response;
    }

    match proposal_manager.execute_monthly_selection().await {
        Ok(receipt) => HttpResponse::Ok().json(receipt),
        Err(e) => HttpResponse::InternalServerError().body(format!("Error executing: {}", e)),
    }
}

pub async fn handle_proposal_post(
    req: HttpRequest,
    json_data: web::Json<Proposal>,
    redis_client: web::Data<redis::Client>,
) -> impl Responder {
    println!("\n📝 POST /proposals - Guardando nueva propuesta");
    println!("📦 Datos recibidos: {:?}", json_data);

    if let Err(response) = verify_token(&req).await {
        println!("❌ Token verification failed");
        return response;
    }

    let mut con = match redis_client.get_async_connection().await {
        Ok(con) => {
            println!("✅ Conexión Redis establecida");
            con
        },
        Err(e) => {
            println!("❌ Error de conexión Redis: {:?}", e);
            return HttpResponse::InternalServerError().body("Redis connection error");
        }
    };

    let proposal = json_data.into_inner();
    let proposal_json = serde_json::to_string(&proposal).unwrap();
    
    println!("💾 Guardando propuesta - Wallet: {}", proposal.wallet);
    println!("   Datos: {}", proposal_json);

    // Usar wallet como clave
    match con.hset::<_, _, _, ()>(
        "proposals",
        &proposal.wallet,
        &proposal_json,
    ).await {
        Ok(_) => {
            println!("✅ Propuesta guardada exitosamente");
            HttpResponse::Ok().json(proposal)
        },
        Err(e) => {
            println!("❌ Error guardando propuesta: {:?}", e);
            HttpResponse::InternalServerError().body("Error saving proposal")
        }
    }
}

pub async fn handle_proposal_index(
    req: HttpRequest,
    json_data: web::Json<Proposal>,
    proposal_manager: web::Data<ProposalManager>,
) -> impl Responder {
    if let Err(response) = verify_token(&req).await {
        return response;
    }

    let proposal = json_data.into_inner();
    
    match proposal_manager.index_proposal_from_backend(&proposal).await {
        Ok(receipt) => HttpResponse::Ok().json(receipt),
        Err(e) => HttpResponse::InternalServerError().body(format!("Error indexing proposal: {}", e)),
    }
}

#[derive(Deserialize)]
struct ContextPart {
    content: String,
    #[serde(rename = "type")]
    context_type: ContextType,
}

#[derive(Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
enum ContextType {
    World,
    Laws,
    Personality,
    Characters,
    Examples,
}

pub async fn handle_context_update(
    req: HttpRequest,
    context_parts: web::Json<Vec<ContextPart>>,
    redis_client: web::Data<redis::Client>,
) -> impl Responder {
    println!("\n📝 POST /context - Actualizando contexto");

    if let Err(response) = verify_token(&req).await {
        println!("❌ Token verification failed");
        return response;
    }

    let mut con = match redis_client.get_async_connection().await {
        Ok(con) => {
            println!("✅ Conexión Redis establecida");
            con
        },
        Err(e) => {
            println!("❌ Error de conexión Redis: {:?}", e);
            return HttpResponse::InternalServerError().body("Redis connection error");
        }
    };

    // Crear un mapa ordenado con las partes del contexto
    let mut context_map = std::collections::HashMap::new();
    for part in context_parts.into_inner() {
        context_map.insert(part.context_type, part.content);
    }

    // Construir el contexto en orden específico con títulos predefinidos
    let combined_context = format!(
        "Title: Threads of the Ankanet: A Dream Across Realities\n\n\
         World Description\n{}\n\n\
         Laws of the Worlds\n{}\n\n\
         Personality and Behavior\n{}\n\n\
         Characters and Relations\n{}\n\n\
         Examples of Flow Interactions\n{}",
        context_map.get(&ContextType::World).unwrap_or(&String::from("")),
        context_map.get(&ContextType::Laws).unwrap_or(&String::from("")),
        context_map.get(&ContextType::Personality).unwrap_or(&String::from("")),
        context_map.get(&ContextType::Characters).unwrap_or(&String::from("")),
        context_map.get(&ContextType::Examples).unwrap_or(&String::from(""))
    );

    match con.set::<_, _, ()>("context-text", &combined_context).await {
        Ok(_) => {
            println!("✅ Contexto actualizado exitosamente en Redis");
            HttpResponse::Ok().json("Context updated successfully")
        },
        Err(e) => {
            println!("❌ Error actualizando contexto en Redis: {:?}", e);
            HttpResponse::InternalServerError().body("Error updating context")
        }
    }
}

pub async fn handle_context_get(
    req: HttpRequest,
    redis_client: web::Data<redis::Client>,
) -> impl Responder {
    println!("\n📖 GET /context - Obteniendo contextos");

    if let Err(response) = verify_token(&req).await {
        println!("❌ Token verification failed");
        return response;
    }

    let mut con = match redis_client.get_async_connection().await {
        Ok(con) => {
            println!("✅ Conexión Redis establecida");
            con
        },
        Err(e) => {
            println!("❌ Error de conexión Redis: {:?}", e);
            return HttpResponse::InternalServerError().body("Redis connection error");
        }
    };

    // Intentar obtener el texto completo del contexto
    let context_string: Option<String> = match con.get("context-text").await {
        Ok(content) => {
            println!("✅ Contexto recuperado de Redis");
            content
        },
        Err(e) => {
            println!("⚠️ Error obteniendo contexto de Redis: {:?}", e);
            None
        }
    };

    // Si hay contenido, procesarlo para dividir en secciones
    if let Some(content) = context_string {
        // Crear una lista de secciones y sus identificadores
        let sections = vec![
            ("World Description", "world"),
            ("Laws of the Worlds", "laws"),
            ("Personality and Behavior", "personality"),
            ("Characters and Relations", "characters"),
            ("Examples of Flow Interactions", "examples")
        ];
        
        let mut context_parts = Vec::new();
        
        // Para cada sección, buscar el contenido entre los marcadores
        for (i, (section_title, section_type)) in sections.iter().enumerate() {
            // El formato real en Redis es "Título\nContenido", así que buscamos eso
            let full_pattern = format!("{}\n", section_title);
            
            if let Some(start_idx) = content.find(&full_pattern) {
                // Avanzar después del patrón (título + salto de línea)
                let content_start = start_idx + full_pattern.len();
                
                // Determinar dónde termina esta sección
                let content_end = if i < sections.len() - 1 {
                    // Si no es la última sección, buscar el inicio de la siguiente
                    let next_pattern = format!("\n\n{}\n", sections[i + 1].0);
                    if let Some(next_idx) = content[content_start..].find(&next_pattern) {
                        content_start + next_idx
                    } else {
                        content.len() // Si no encuentra la siguiente, usar hasta el final
                    }
                } else {
                    content.len() // Si es la última sección, usar hasta el final
                };
                
                // Extraer y limpiar el texto
                let section_content = content[content_start..content_end].trim().to_string();
                
                println!("✓ Sección '{}' encontrada", section_title);
                context_parts.push(serde_json::json!({
                    "type": section_type,
                    "content": section_content
                }));
            } else {
                println!("⚠️ No se encontró la sección '{}'", section_title);
                // Agregar la sección con contenido vacío para mantener la estructura
                context_parts.push(serde_json::json!({
                    "type": section_type,
                    "content": ""
                }));
            }
        }
        
        println!("✅ Contexto procesado y dividido en {} partes", context_parts.len());
        HttpResponse::Ok().json(context_parts)
    } else {
        // Si no hay contexto, devolver un arreglo vacío
        println!("ℹ️ No se encontró contexto en Redis");
        HttpResponse::Ok().json(Vec::<serde_json::Value>::new())
    }
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("")
            .route("/login", web::post().to(login))
            .route("/api", web::post().to(protected_api))
            .route("/nft-claim", web::post().to(handle_nft_claim_post))
            .route("/nft-claim", web::get().to(handle_nft_claim_get))
            .route("/proposals", web::get().to(handle_proposals_get))
            .route("/proposals", web::post().to(handle_proposal_post))
            .route("/proposals", web::put().to(handle_proposal_update))
            .route("/proposalsw", web::get().to(handle_proposals_winners))
            .route("/health", web::get().to(health_check))
            .route("/context", web::post().to(handle_context_update))
            .route("/context", web::get().to(handle_context_get))
            .route("/game-options", web::get().to(handle_game_options_get))
            .route("/game-options", web::post().to(handle_game_options_set))
    );
}

pub async fn handle_pending_proposals(
    req: HttpRequest,
    redis_client: web::Data<redis::Client>,
) -> impl Responder {
    println!("\n📥 [PENDING_PROPOSALS] Iniciando búsqueda de todas las propuestas pendientes");
    println!("🔑 [PENDING_PROPOSALS] Auth header: {:?}", req.headers().get("Authorization"));
    
    if let Err(response) = verify_token(&req).await {
        println!("❌ [PENDING_PROPOSALS] Token verification failed");
        return response;
    }
    println!("✅ [PENDING_PROPOSALS] Token verificado correctamente");

    let mut con = match redis_client.get_async_connection().await {
        Ok(con) => {
            println!("✅ [PENDING_PROPOSALS] Conexión Redis establecida");
            con
        },
        Err(e) => {
            println!("❌ [PENDING_PROPOSALS] Error de conexión Redis: {:?}", e);
            return HttpResponse::InternalServerError().body(format!("Redis connection error: {}", e));
        }
    };

    // Obtener todas las propuestas de Redis usando HKEYS primero
    println!("📝 [PENDING_PROPOSALS] Obteniendo todas las keys de Redis");
    let keys: Vec<String> = match con.hkeys::<_, Vec<String>>("proposals").await {
        Ok(k) => {
            println!("✅ [PENDING_PROPOSALS] Encontradas {} keys en total", k.len());
            k
        },
        Err(e) => {
            println!("❌ [PENDING_PROPOSALS] Error obteniendo keys: {:?}", e);
            return HttpResponse::InternalServerError().body(format!("Redis error: {}", e));
        }
    };

    // Obtener cada propuesta individualmente
    let mut pending_proposals = Vec::new();
    for key in &keys {
        println!("🔍 [PENDING_PROPOSALS] Revisando propuesta con key: {}", key);
        match con.hget::<_, _, Option<String>>("proposals", key).await {
            Ok(Some(value)) => {
                println!("📋 [PENDING_PROPOSALS] Valor encontrado para key {}", key);
                match serde_json::from_str::<Proposal>(&value) {
                    Ok(proposal) => {
                        println!("✅ [PENDING_PROPOSALS] Propuesta parseada - Wallet: {} - Status: {}", 
                            proposal.wallet, proposal.status);
                        if proposal.status == 1 || proposal.status == 2 {
                            println!("➕ [PENDING_PROPOSALS] Añadiendo propuesta pendiente de wallet {}", 
                                proposal.wallet);
                            pending_proposals.push(proposal);
                        } else {
                            println!("ℹ️ [PENDING_PROPOSALS] Ignorando propuesta de {} - Status {} no es pendiente", 
                                proposal.wallet, proposal.status);
                        }
                    },
                    Err(e) => println!("❌ [PENDING_PROPOSALS] Error parseando propuesta: {:?}\nValor: {}", e, value),
                }
            },
            Ok(None) => println!("⚠️ [PENDING_PROPOSALS] No se encontró valor para key: {}", key),
            Err(e) => println!("❌ [PENDING_PROPOSALS] Error obteniendo valor de key {}: {:?}", key, e),
        }
    }

    println!("\n🔍 [PENDING_PROPOSALS] Resumen:");
    println!("   Total keys en Redis: {}", keys.len());
    println!("   Total propuestas pendientes encontradas: {}", pending_proposals.len());
    HttpResponse::Ok().json(pending_proposals)
}

pub async fn handle_voting_proposals(
    req: HttpRequest,
    proposal_manager: web::Data<ProposalManager>,
) -> impl Responder {
    if let Err(response) = verify_token(&req).await {
        return response;
    }

    match proposal_manager.get_active_proposals().await {
        Ok(proposals) => HttpResponse::Ok().json(proposals),
        Err(e) => HttpResponse::InternalServerError().body(format!("Error: {}", e)),
    }
}

pub async fn handle_winners_by_month(
    req: HttpRequest,
    path: web::Path<String>,  // month
    proposal_manager: web::Data<ProposalManager>,
) -> impl Responder {
    println!("📥 Processing winners request for month: {}", path.into_inner());
    println!("🔑 Auth header: {:?}", req.headers().get("Authorization"));
    
    if let Err(response) = verify_token(&req).await {
        println!("❌ Token verification failed");
        return response;
    }

    // Verificar que el ProposalManager está configurado correctamente
    match proposal_manager.check_configuration().await {
        Ok(_) => println!("✅ ProposalManager configuration verified"),
        Err(e) => {
            println!("❌ ProposalManager configuration error: {:?}", e);
            return HttpResponse::InternalServerError()
                .body("ProposalManager not configured correctly");
        }
    }

    match proposal_manager.get_active_proposals().await {
        Ok(proposals) => {
            println!("✅ Found {} active proposals", proposals.len());
            HttpResponse::Ok().json(proposals)
        },
        Err(e) => {
            println!("❌ Error getting active proposals: {:?}", e);
            HttpResponse::InternalServerError()
                .body(format!("Error getting active proposals: {}", e))
        }
    }
}

pub async fn health_check() -> impl Responder {
    HttpResponse::Ok().json("OK")
}

pub async fn handle_proposals_voting(
    req: HttpRequest,
    proposal_manager: web::Data<ProposalManager>,
) -> impl Responder {
    if let Err(response) = verify_token(&req).await {
        return response;
    }

    match proposal_manager.get_current_month_proposals().await {
        Ok(proposals) => HttpResponse::Ok().json(proposals),
        Err(e) => {
            println!("❌ Error obteniendo propuestas en votación: {}", e);
            HttpResponse::InternalServerError().body(format!("Error: {}", e))
        }
    }
}

pub async fn handle_proposal_elevate(
    req: HttpRequest,
    proposal: web::Json<Proposal>,
    proposal_manager: web::Data<ProposalManager>,
) -> impl Responder {
    println!("📥 [ELEVATE] Recibiendo propuesta para elevar al blockchain");
    
    if let Err(response) = verify_token(&req).await {
        println!("❌ [ELEVATE] Error de autenticación");
        return HttpResponse::BadRequest().json(serde_json::json!({
            "success": false,
            "message": "Authentication failed",
            "error": "Invalid token"
        }));
    }

    let proposal_data = proposal.into_inner();
    println!("📋 [ELEVATE] Datos de la propuesta: {:?}", proposal_data);
    
    match proposal_manager.index_proposal_from_backend(&proposal_data).await {
        Ok(tx_receipt) => {
            println!("✅ [ELEVATE] Propuesta elevada exitosamente");
            println!("📝 [ELEVATE] Transaction receipt: {:?}", tx_receipt);
            
            HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "message": "Proposal successfully elevated to blockchain",
                "data": {
                    "transaction_hash": tx_receipt.transaction_hash.to_string(),
                    "block_number": tx_receipt.block_number.map(|n| n.as_u64()),
                    "status": tx_receipt.status.map(|s| s.as_u64())
                }
            }))
        },
        Err(e) => {
            println!("❌ [ELEVATE] Error al elevar propuesta: {}", e);
            println!("🔍 [ELEVATE] Detalles del error: {:?}", e);
            
            HttpResponse::BadRequest().json(serde_json::json!({
                "success": false,
                "message": "Failed to elevate proposal",
                "error": format!("{}", e)
            }))
        }
    }
}

pub async fn handle_proposals_winners(
    req: HttpRequest,
    proposal_manager: web::Data<ProposalManager>,
) -> impl Responder {
    if let Err(response) = verify_token(&req).await {
        return response;
    }

    match proposal_manager.get_all_winning_proposals().await {
        Ok(winners) => {
            println!("✅ Propuestas ganadoras obtenidas exitosamente");
            HttpResponse::Ok().json(winners)
        },
        Err(e) => {
            println!("❌ Error obteniendo propuestas ganadoras: {}", e);
            HttpResponse::InternalServerError().body(format!("Error: {}", e))
        }
    }
}

pub async fn handle_proposal_update(
    req: HttpRequest,
    update_data: web::Json<UpdateData>,
    redis_client: web::Data<redis::Client>,
) -> impl Responder {
    println!("📥 PUT /proposals - Datos recibidos:");
    println!("🔑 Wallet: {}", update_data.wallet);
    println!("📦 Update data: {:#?}", update_data.update);

    if let Err(_response) = verify_token(&req).await {
        println!("❌ Error de autenticación");
        return HttpResponse::Unauthorized().body("Token inválido");
    }

    let mut con = match redis_client.get_async_connection().await {
        Ok(con) => con,
        Err(e) => {
            println!("❌ Error de conexión a Redis: {:?}", e);
            return HttpResponse::InternalServerError().body("Redis connection error");
        }
    };

    println!("🔍 Buscando propuesta en Redis...");
    let proposal_str: Option<String> = match con.hget("proposals", &update_data.wallet).await {
        Ok(p) => {
            println!("✅ Propuesta encontrada");
            p
        },
        Err(e) => {
            println!("❌ Error obteniendo propuesta de Redis: {:?}", e);
            return HttpResponse::InternalServerError().body("Error getting proposal");
        }
    };

    match proposal_str {
        Some(str) => {
            let mut proposal: Proposal = match serde_json::from_str(&str) {
                Ok(p) => {
                    println!("✅ Propuesta parseada correctamente");
                    p
                },
                Err(e) => {
                    println!("❌ Error parseando propuesta: {:?}", e);
                    return HttpResponse::InternalServerError().body("Error parsing proposal");
                }
            };

            // Si es una acción de voto
            if update_data.update.action == "vote" {
                println!("🗳️ Procesando acción de voto");
                
                if let Some(voter_wallet) = &update_data.update.voter_wallet {
                    println!("👤 Votante: {}", voter_wallet);

                    // Verificar si el usuario ya votó
                    if let Some(voters) = &proposal.voters {
                        if voters.contains(voter_wallet) {
                            println!("⚠️ El usuario ya ha votado por esta propuesta");
                            return HttpResponse::BadRequest().body("Ya has votado por esta propuesta");
                        }
                    }

                    // Mintear el NFT primero
                    println!("🎨 Iniciando minteo de NFT para el voto...");
                    match mint_nft(voter_wallet.clone()).await {
                        Ok(nft_info) => {
                            println!("✅ NFT minteado exitosamente");
                            println!("📜 Token ID: {}", nft_info.token_id);

                            // Inicializar arrays si no existen
                            if proposal.voters.is_none() {
                                proposal.voters = Some(Vec::new());
                            }
                            if proposal.votes.is_none() {
                                proposal.votes = Some(0);
                            }
                            if proposal.vote_nfts.is_none() {
                                proposal.vote_nfts = Some(Vec::new());
                            }

                            // Actualizar votos, votantes y NFTs
                            if let Some(votes) = proposal.votes {
                                proposal.votes = Some(votes + 1);
                            }
                            if let Some(voters) = &mut proposal.voters {
                                voters.push(voter_wallet.clone());
                            }
                            if let Some(vote_nfts) = &mut proposal.vote_nfts {
                                vote_nfts.push(VoteNFT {
                                    token_id: nft_info.token_id.clone(),
                                    voter_wallet: voter_wallet.clone(),
                                    timestamp: update_data.update.timestamp.clone()
                                        .unwrap_or_else(|| chrono::Utc::now().timestamp().to_string())
                                });
                            }

                            // Guardar la propuesta actualizada
                            println!("💾 Guardando propuesta actualizada en Redis");
                            if let Err(e) = con.hset::<_, _, _, ()>(
                                "proposals",
                                &update_data.wallet,
                                serde_json::to_string(&proposal).unwrap(),
                            ).await {
                                println!("❌ Error guardando propuesta en Redis: {:?}", e);
                                return HttpResponse::InternalServerError().body("Error updating proposal");
                            }

                            println!("✅ Voto y NFT registrados exitosamente");
                            HttpResponse::Ok().json(json!({
                                "success": true,
                                "proposal": proposal,
                                "nft_info": {
                                    "token_id": nft_info.token_id,
                                    // Otros campos si los hay...
                                }
                            }))
                        },
                        Err(e) => {
                            println!("❌ Error al mintear NFT: {:?}", e);
                            HttpResponse::InternalServerError().json(json!({
                                "error": "Error al crear el NFT del voto",
                                "details": format!("{:?}", e)
                            }))
                        }
                    }
                } else {
                    println!("❌ No se proporcionó wallet del votante");
                    HttpResponse::BadRequest().body("Se requiere wallet del votante")
                }
            } else {
                // Manejar otras acciones si es necesario
                HttpResponse::BadRequest().body("Acción no soportada")
            }
        },
        None => {
            println!("❌ Propuesta no encontrada en Redis");
            HttpResponse::NotFound().body("Proposal not found")
        }
    }
}

pub async fn handle_proposals_get(
    req: HttpRequest,
    redis_client: web::Data<redis::Client>,
) -> impl Responder {
    if let Err(response) = verify_token(&req).await {
        return response;
    }

    let mut con = match redis_client.get_async_connection().await {
        Ok(con) => con,
        Err(_) => return HttpResponse::InternalServerError().body("Redis connection error"),
    };

    // Obtener todas las propuestas
    let proposals: Vec<String> = match con.hvals("proposals").await {
        Ok(p) => p,
        Err(_) => return HttpResponse::InternalServerError().body("Error getting proposals"),
    };

    // Para cada propuesta, obtener su historial de conversación
    let mut proposals_with_history = Vec::new();
    
    for proposal_str in proposals {
        if let Ok(mut proposal) = serde_json::from_str::<Proposal>(&proposal_str) {
            // Obtener el historial de conversación para esta wallet
            let conversation_key = format!("conversation:{}", proposal.wallet);
            let messages: Vec<String> = match con.lrange(&conversation_key, -40, -1).await {
                Ok(msgs) => msgs,
                Err(_) => Vec::new(), // Si hay error, usar vector vacío
            };
            
            // Actualizar el message_history de la propuesta
            proposal.message_history = messages;
            proposals_with_history.push(proposal);
        }
    }

    HttpResponse::Ok().json(proposals_with_history)
}

// Mantener solo las estructuras de UpdateData y ProposalUpdate
#[derive(Debug, Deserialize)]
pub struct UpdateData {
    pub wallet: String,
    pub update: ProposalUpdate,
}

#[derive(Debug, Deserialize)]
pub struct ProposalUpdate {
    pub action: String,
    pub voter_wallet: Option<String>,
    pub timestamp: Option<String>,
    pub status: Option<i32>,
}
