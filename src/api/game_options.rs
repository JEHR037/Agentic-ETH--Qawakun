use serde::{Deserialize, Serialize};
use actix_web::{web, HttpResponse, Responder, HttpRequest};
use crate::api::auth::verify_token;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameOption {
    pub code: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Interaction {
    pub options: Vec<GameOption>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Language {
    pub code: String,
    pub name: String,
    pub interactions: Vec<Interaction>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameOptions {
    pub languages: Vec<Language>,
}

pub async fn handle_game_options_get(
    req: HttpRequest,
    redis_client: web::Data<redis::Client>,
) -> impl Responder {
    println!("📥 GET /game-options - Obteniendo opciones de juego");
    
    if let Err(response) = verify_token(&req).await {
        println!("❌ Error de autenticación");
        return response;
    }

    let mut con = match redis_client.get_async_connection().await {
        Ok(con) => con,
        Err(e) => {
            println!("❌ Error de conexión a Redis: {:?}", e);
            return HttpResponse::InternalServerError().body("Redis connection error");
        }
    };

    // Intentar obtener las opciones de juego de Redis
    let options_str: Option<String> = match redis::cmd("GET")
        .arg("game_options")
        .query_async(&mut con)
        .await {
        Ok(result) => result,
        Err(e) => {
            println!("❓ No se encontraron opciones en Redis: {:?}", e);
            None
        }
    };

    // Si no hay opciones en Redis, cargar desde las opciones predeterminadas
    match options_str {
        Some(json_str) => {
            println!("✅ Opciones de juego obtenidas de Redis");
            match serde_json::from_str::<GameOptions>(&json_str) {
                Ok(options) => HttpResponse::Ok().json(options),
                Err(e) => {
                    println!("❌ Error al parsear opciones de Redis: {:?}", e);
                    HttpResponse::InternalServerError().body("Error parsing game options")
                }
            }
        },
        None => {
            println!("ℹ️ Cargando opciones de juego predeterminadas del archivo");
            // Cargar opciones predeterminadas desde el archivo options.json incluido en el build
            match std::include_str!("../data/default_game_options.json") {
                options_str => {
                    // También guardarlas en Redis para futuras peticiones
                    match redis::cmd("SET")
                        .arg("game_options")
                        .arg(options_str)
                        .query_async::<_, ()>(&mut con)
                        .await {
                        Ok(_) => println!("✅ Opciones predeterminadas guardadas en Redis"),
                        Err(e) => println!("❌ Error al guardar opciones en Redis: {:?}", e),
                    }
                    
                    match serde_json::from_str::<GameOptions>(options_str) {
                        Ok(options) => HttpResponse::Ok().json(options),
                        Err(e) => {
                            println!("❌ Error al parsear opciones predeterminadas: {:?}", e);
                            HttpResponse::InternalServerError().body("Error parsing default game options")
                        }
                    }
                }
            }
        }
    }
}

pub async fn handle_game_options_set(
    req: HttpRequest,
    options: web::Json<GameOptions>,
    redis_client: web::Data<redis::Client>,
) -> impl Responder {
    println!("📥 POST /game-options - Actualizando opciones de juego");
    
    if let Err(response) = verify_token(&req).await {
        println!("❌ Error de autenticación");
        return response;
    }

    let mut con = match redis_client.get_async_connection().await {
        Ok(con) => con,
        Err(e) => {
            println!("❌ Error de conexión a Redis: {:?}", e);
            return HttpResponse::InternalServerError().body("Redis connection error");
        }
    };

    // Serializar las opciones a JSON
    let options_json = match serde_json::to_string(&options) {
        Ok(json) => json,
        Err(e) => {
            println!("❌ Error al serializar opciones: {:?}", e);
            return HttpResponse::InternalServerError().body("Error serializing game options");
        }
    };

    // Guardar en Redis
    match redis::cmd("SET")
        .arg("game_options")
        .arg(&options_json)
        .query_async::<_, ()>(&mut con)
        .await {
        Ok(_) => {
            println!("✅ Opciones de juego actualizadas en Redis");
            HttpResponse::Ok().json(serde_json::json!({ "success": true, "message": "Game options updated successfully" }))
        },
        Err(e) => {
            println!("❌ Error al guardar opciones en Redis: {:?}", e);
            HttpResponse::InternalServerError().body("Error saving game options")
        }
    }
} 