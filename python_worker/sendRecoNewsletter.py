#!/usr/bin/env python3
import os
import sys
import json
import logging
from datetime import datetime
from supabase import create_client, Client as SupabaseClient
from atproto import Client, IdResolver, models

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('newsletter-sender')

# Environment variables
BLUESKY_USERNAME = os.environ.get('BLUESKY_BOT_USERNAME')
BLUESKY_PASSWORD = os.environ.get('BLUESKY_BOT_PASSWORD')
SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

# Initialize Supabase client
supabase: SupabaseClient = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_user_recommendations(user_id):
    """Récupère les recommandations pour un utilisateur"""
    try:
        logger.info(f"Getting recommendations for user {user_id}")
        
        # Utiliser une fonction RPC ou une requête Supabase pour obtenir les recommandations
        response = supabase.schema("public").rpc(
            'get_user_recommendations', 
            {
                'user_id': user_id,
                'limit': 5  # Limiter à 5 recommandations
            }
        ).execute()
        
        if hasattr(response, 'data') and response.data:
            logger.info(f"Found {len(response.data)} recommendations")
            return response.data
        else:
            logger.warning(f"No recommendations found for user {user_id}")
            return []
            
    except Exception as e:
        logger.error(f"Error getting recommendations: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []

def send_newsletter_dm(client, recipient_handle, recommendations):
    """Envoie un DM avec les recommandations de la newsletter"""
    try:
        logger.info(f"Sending newsletter DM to {recipient_handle}")
        
        # Formater les recommandations
        reco_text = ""
        for reco in recommendations:
            if isinstance(reco, dict):
                # Adapter selon la structure de vos données
                handle = reco.get('handle', None)
                name = reco.get('name', None)
                reason = reco.get('reason', 'recommandé pour vous')
                
                if handle:
                    reco_text += f"• @{handle}"
                    if name:
                        reco_text += f" ({name})"
                    reco_text += f" - {reason}\n"
        
        # Message personnalisé avec les recommandations
        message = f"""
Bonjour @{recipient_handle}! 

Voici votre bulletin de recommandations OpenPortability de cette semaine.

Comptes recommandés à suivre:
{reco_text}

Merci de participer à notre projet de recherche sur la portabilité des réseaux sociaux.

— HelloQittoX | OpenPortability
        """
        
        # Créer client proxy pour les DMs
        dm_client = client.with_bsky_chat_proxy()
        
        # Raccourci pour les méthodes de conversation
        dm = dm_client.chat.bsky.convo
        
        # Résoudre le handle en DID
        id_resolver = IdResolver()
        chat_to = id_resolver.handle.resolve(recipient_handle)
        logger.info(f"Resolved {recipient_handle} to DID: {chat_to}")
        
        # Créer ou obtenir la conversation
        convo = dm.get_convo_for_members(
            models.ChatBskyConvoGetConvoForMembers.Params(members=[chat_to]),
        ).convo
        logger.info(f"Conversation ID: {convo.id}")
        
        # Envoyer le message
        dm.send_message(
            models.ChatBskyConvoSendMessage.Data(
                convo_id=convo.id,
                message=models.ChatBskyConvoDefs.MessageInput(
                    text=message,
                ),
            )
        )
        
        logger.info(f"Successfully sent newsletter DM to {recipient_handle}")
        return {"success": True, "recipient": recipient_handle}
        
    except Exception as e:
        error_msg = f"Error sending newsletter DM to {recipient_handle}: {e}"
        logger.error(error_msg)
        return {"success": False, "error": str(e), "recipient": recipient_handle}

def process_newsletter_task(payload):
    """Traite une tâche de newsletter"""
    try:
        logger.info("Starting newsletter task processing")
        
        # Extraire les informations de la tâche
        user_id = payload.get('user_id')
        
        if not user_id:
            raise ValueError("Missing user_id in payload")
        
        # Récupérer les informations de l'utilisateur
        user_response = supabase.schema("next-auth").from_("users").select("id, bluesky_username").eq("id", user_id).limit(1).execute()
        
        if not hasattr(user_response, 'data') or not user_response.data:
            raise ValueError(f"User not found: {user_id}")
        
        user = user_response.data[0]
        recipient_handle = user.get('bluesky_username')
        
        if not recipient_handle:
            raise ValueError(f"User has no Bluesky username: {user_id}")
        
        # Récupérer les recommandations
        recommendations = get_user_recommendations(user_id)
        
        if not recommendations:
            logger.info(f"No recommendations found for user {user_id}")
            return {"success": True, "message": "No recommendations to send"}
        
        # Se connecter à Bluesky
        client = Client()
        profile = client.login(BLUESKY_USERNAME, BLUESKY_PASSWORD)
        logger.info(f"Connected to Bluesky as {profile.handle}")
        
        # Envoyer la newsletter
        result = send_newsletter_dm(client, recipient_handle, recommendations)
        
        return result
        
    except Exception as e:
        logger.error(f"Error processing newsletter task: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"success": False, "error": str(e)}

def main():
    """Fonction principale pour exécuter le script"""
    try:
        logger.info("Starting newsletter script")
        
        # Vérifier les arguments
        if len(sys.argv) < 2:
            logger.error("No payload provided")
            return {"success": False, "error": "No payload provided"}
        
        # Récupérer et valider le payload
        payload_str = sys.argv[1]
        logger.info(f"Received payload: {payload_str}")
        
        try:
            payload = json.loads(payload_str)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON payload: {e}")
            return {"success": False, "error": f"Invalid JSON payload: {e}"}
        
        # Traiter la tâche
        result = process_newsletter_task(payload)
        
        return result
        
    except Exception as e:
        logger.error(f"Unexpected error in main: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    result = main()
    # Le code de retour indique le succès ou l'échec
    print(json.dumps(result))
    sys.exit(0 if result.get('success', False) else 1)