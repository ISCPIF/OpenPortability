#!/usr/bin/env python3
import os
import sys
import logging
import json
from atproto import Client, IdResolver, models

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('test-dm')

# Afficher toutes les variables d'environnement disponibles pour le diagnostic
print("Variables d'environnement disponibles:")
for key in sorted(os.environ.keys()):
    if not key.startswith("npm_") and not "PASSWORD" in key.upper() and not "SECRET" in key.upper():
        print(f"  {key}={os.environ.get(key)}")

# Récupérer les identifiants Bluesky du bot depuis les variables d'environnement
BLUESKY_USERNAME = os.environ.get('BLUESKY_BOT_USERNAME')
BLUESKY_PASSWORD = os.environ.get('BLUESKY_BOT_PASSWORD')

# Vérifier si les variables sont définies
if not BLUESKY_USERNAME or not BLUESKY_PASSWORD:
    print(f"❌ Erreur: Variables d'environnement manquantes!")
    print(f"BLUESKY_BOT_USERNAME est {'défini' if BLUESKY_USERNAME else 'MANQUANT'}")
    print(f"BLUESKY_BOT_PASSWORD est {'défini' if BLUESKY_PASSWORD else 'MANQUANT'}")
    sys.exit(1)

def send_direct_message(client, recipient_handle, message):
    """Envoyer un message direct en utilisant l'API Bluesky Chat"""
    try:
        print(f"🔍 Envoi d'un DM à {recipient_handle}")
        
        # Créer un client proxy pour le service Bluesky Chat
        dm_client = client.with_bsky_chat_proxy()
        
        # Raccourci pour les méthodes de conversation
        dm = dm_client.chat.bsky.convo
        
        # Créer une instance de résolveur avec cache en mémoire
        id_resolver = IdResolver()
        
        # Résoudre le handle du destinataire en DID
        chat_to = id_resolver.handle.resolve(recipient_handle)
        print(f"✅ Résolution de {recipient_handle} en DID: {chat_to}")
        
        # Créer ou récupérer une conversation avec chat_to
        convo = dm.get_convo_for_members(
            models.ChatBskyConvoGetConvoForMembers.Params(members=[chat_to]),
        ).convo
        
        print(f"✅ ID de conversation: {convo.id}")
        print("Membres de la conversation:")
        for member in convo.members:
            print(f"- {member.display_name} ({member.did})")
        
        # Envoyer le message à la conversation
        dm.send_message(
            models.ChatBskyConvoSendMessage.Data(
                convo_id=convo.id,
                message=models.ChatBskyConvoDefs.MessageInput(
                    text=message,
                ),
            )
        )
        
        print(f"✅ Message envoyé avec succès à {recipient_handle}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Erreur lors de l'envoi du DM à {recipient_handle}: {e}")
        # Propager l'erreur pour l'analyser dans l'API
        raise e

def test_dm(recipient_handle, custom_message=None):
    """Test l'envoi d'un DM à un utilisateur
    
    Args:
        recipient_handle (str): Handle de l'utilisateur destinataire
        custom_message (str, optional): Message personnalisé à envoyer. Si non fourni, utilise le message de test par défaut.
    
    Returns:
        bool: True si le message a été envoyé avec succès, False sinon
    """
    try:
        print(f"🚀 Démarrage du test DM pour {recipient_handle}")
        
        # Créer le client Bluesky
        client = Client()
        
        print(f"🔑 Connexion avec l'utilisateur {BLUESKY_USERNAME}")
        client.login(BLUESKY_USERNAME, BLUESKY_PASSWORD)
        print(f"✅ Connecté avec succès à Bluesky en tant que {BLUESKY_USERNAME}")
        
        # Message par défaut si aucun message personnalisé n'est fourni
        if custom_message is None:
            custom_message = "This is an automated test message from OpenPortability to verify we can reach you via DM. No action is required."
        
        # Envoyer le message direct
        send_direct_message(client, recipient_handle, custom_message)
        
        print(f"✅ Message envoyé avec succès à {recipient_handle}")
        print(f"Message envoyé avec succès à {recipient_handle}")
        
        return True
        
    except Exception as e:
        error_str = str(e)
        print(f"Erreur lors de l'envoi du message à {recipient_handle}: {e}")
        
        # Vérifier si l'erreur indique que l'utilisateur doit suivre le compte
        if "recipient has disabled incoming messages" in error_str or "recipient requires incoming messages to come from someone they follow" in error_str:
            print(f"⚠️ L'utilisateur {recipient_handle} doit suivre le compte pour recevoir des DMs")
            # Renvoyer l'erreur originale au lieu de la transformer
            raise e
            
        raise e  # Propager l'erreur pour l'analyse dans l'API

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: python3 testDm.py <recipient_handle> [custom_message]"}))
        sys.exit(1)
    
    recipient_handle = sys.argv[1]
    custom_message = sys.argv[2] if len(sys.argv) > 2 else None
    
    try:
        result = test_dm(recipient_handle, custom_message)
        print(json.dumps({"success": True, "message": f"DM sent successfully to {recipient_handle}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)