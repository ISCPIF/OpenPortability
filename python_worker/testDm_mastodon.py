#!/usr/bin/env python3
import os
import sys
import logging
from mastodon import Mastodon
from mastodon.errors import MastodonError, MastodonAPIError, MastodonNotFoundError, MastodonRatelimitError
from dotenv import load_dotenv

load_dotenv()


# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('test-dm-mastodon')

# Get Mastodon credentials from environment
MASTODON_ACCESS_TOKEN = os.environ.get('MASTODON_BOT_ACCESSTOKEN')
MASTODON_API_BASE_URL = os.environ.get('MASTODON_INSTANCE_URL')
MASTODON_BOT_USERNAME = os.environ.get('MASTODON_BOT_USERNAME')

# Vérifier si les variables sont définies
if not all([MASTODON_ACCESS_TOKEN, MASTODON_API_BASE_URL, MASTODON_BOT_USERNAME]):
    print("❌ Erreur: Variables d'environnement manquantes!")
    print(f"MASTODON_BOT_ACCESSTOKEN est {'défini' if MASTODON_ACCESS_TOKEN else 'MANQUANT'}")
    print(f"MASTODON_INSTANCE_URL est {'défini' if MASTODON_API_BASE_URL else 'MANQUANT'}")
    print(f"MASTODON_BOT_USERNAME est {'défini' if MASTODON_BOT_USERNAME else 'MANQUANT'}")
    sys.exit(1)

def send_direct_message(mastodon, recipient_handle, message):
    """Envoyer un message direct en utilisant l'API Mastodon"""
    try:
        # Nettoyer le handle si nécessaire
        recipient_handle = recipient_handle.replace('https://', '')
        print(f"🔍 Envoi d'un DM à {recipient_handle}")
        
        try:
            search_results = mastodon.account_search(recipient_handle)
            if not search_results:
                raise MastodonNotFoundError(f"Utilisateur {recipient_handle} non trouvé")
        except MastodonNotFoundError:
            logger.error(f"❌ Utilisateur {recipient_handle} non trouvé")
            raise
        except MastodonRatelimitError:
            logger.error("❌ Limite de requêtes API atteinte")
            raise
        except MastodonAPIError as e:
            logger.error(f"❌ Erreur API Mastodon: {e.response.status_code} - {e.response.text}")
            raise
            
        recipient = search_results[0]
        
        try:
            # D'abord, créer un status privé pour initier la conversation
            initial_status = mastodon.status_post(
                "Initialisation de la conversation...",
                visibility="direct"
            )
        except MastodonAPIError as e:
            logger.error(f"❌ Erreur lors de la création du status initial: {e.response.status_code} - {e.response.text}")
            raise
        
        try:
            # Puis, envoyer le vrai message en réponse
            status = mastodon.status_post(
                f"@{recipient.acct} {message}",
                visibility="direct",
                in_reply_to_id=initial_status['id']
            )
        except MastodonAPIError as e:
            logger.error(f"❌ Erreur lors de l'envoi du message: {e.response.status_code} - {e.response.text}")
            # Essayer de nettoyer le message initial en cas d'erreur
            try:
                mastodon.status_delete(initial_status['id'])
            except:
                pass
            raise
        
        try:
            # Supprimer le message d'initialisation
            mastodon.status_delete(initial_status['id'])
        except MastodonAPIError as e:
            logger.warning(f"⚠️ Impossible de supprimer le message initial: {e.response.status_code} - {e.response.text}")
        
        print(f"✅ Message envoyé avec succès à {recipient_handle}")

        # Vérifier que le message apparaît dans les conversations
        print("\n🔍 Vérification des conversations...")
        try:
            conversations = mastodon.conversations()
            found = False
            for conv in conversations:
                if any(account.id == recipient.id for account in conv['accounts']):
                    print(f"✅ Conversation trouvée avec {recipient_handle}")
                    print(f"Dernier message: {conv['last_status']['content']}")
                    found = True
                    break
            
            if not found:
                logger.warning("⚠️ Message envoyé mais pas trouvé dans les conversations")
        except MastodonAPIError as e:
            logger.warning(f"⚠️ Impossible de vérifier les conversations: {e.response.status_code} - {e.response.text}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Erreur lors de l'envoi du DM à {recipient_handle}: {str(e)}")
        raise

def test_dm(recipient_handle, custom_message=None):
    """Test l'envoi d'un DM à un utilisateur
    Args:
        recipient_handle (str): Handle de l'utilisateur destinataire (format: username@instance)
        custom_message (str, optional): Message personnalisé à envoyer. Si non fourni, utilise le message de test par défaut.
    """
    try:
        print(f"🚀 Démarrage du test DM pour {recipient_handle}")
        print(f"🔑 Connexion avec l'utilisateur {MASTODON_BOT_USERNAME}")
        
        # Initialiser le client Mastodon
        mastodon = Mastodon(
            access_token=MASTODON_ACCESS_TOKEN,
            api_base_url=MASTODON_API_BASE_URL
        )
        
        # Message à envoyer (utiliser le message personnalisé ou le message de test par défaut)
        message = custom_message or "👋 Ceci est un message de test de HelloQittoX. Si vous recevez ce message, cela signifie que nous pouvons vous envoyer des informations par DM. Merci de faire partie de notre communauté !"
        
        # Envoyer le message direct
        result = send_direct_message(mastodon, recipient_handle, message)
        
        print(f"Message envoyé avec succès à {recipient_handle}")
        return True
        
    except Exception as e:
        error_str = str(e)
        print(f"Erreur lors de l'envoi du message à {recipient_handle}: {e}")
        raise e

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 testDm_mastodon.py <username@instance> [custom_message]")
        print("Example: python3 testDm_mastodon.py user@mastodon.social")
        sys.exit(1)
    
    recipient_handle = sys.argv[1]
    if '@' not in recipient_handle:
        print("❌ Erreur: Le format du handle Mastodon doit être username@instance")
        print("Example: user@mastodon.social")
        sys.exit(1)
    
    custom_message = sys.argv[2] if len(sys.argv) > 2 else None
    test_dm(recipient_handle, custom_message)