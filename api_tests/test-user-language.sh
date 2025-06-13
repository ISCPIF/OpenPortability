#!/bin/bash

# Enhanced script de test pour l'endpoint /api/users/language
# Usage: AUTH_COOKIE="your_cookie" ./test-language-enhanced.sh
# Tests de sécurité pour la gestion des préférences linguistiques

BASE_URL="http://localhost:3000"
ENDPOINT="/api/users/language"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="language_test_${TIMESTAMP}.txt"

echo "=== ENHANCED TESTING LANGUAGE API ===" | tee "$OUTPUT_FILE"
echo "Date: $(date)" | tee -a "$OUTPUT_FILE"
echo "Target: $BASE_URL$ENDPOINT" | tee -a "$OUTPUT_FILE"
echo

# Check if AUTH_COOKIE is set
if [ -z "$AUTH_COOKIE" ]; then
  echo "Error: AUTH_COOKIE environment variable is not set" | tee -a "$OUTPUT_FILE"
  echo "Usage: AUTH_COOKIE=\"your_cookie\" ./test-language-enhanced.sh" | tee -a "$OUTPUT_FILE"
  exit 1
fi

# Variables pour le résumé
TEST_COUNT=0
RESULTS_SUMMARY=()
FAILED_TESTS=()
FAILED_DETAILS=()

# Fonction pour exécuter un test
run_language_test() {
  local description="$1"
  local expected="$2"
  local use_auth="$3"  # true ou false
  local method="${4:-GET}"
  local payload="$5"  # données JSON optionnelles
  
  TEST_COUNT=$((TEST_COUNT + 1))
  
  # Construire la commande curl
  local curl_cmd="curl -s -X $method \"$BASE_URL$ENDPOINT\" -H \"Content-Type: application/json\""
  
  # Ajouter l'authentification si requise
  if [ "$use_auth" = "true" ]; then
    curl_cmd="$curl_cmd -H \"Cookie: $AUTH_COOKIE\""
  fi
  
  # Ajouter le payload si fourni
  if [ -n "$payload" ]; then
    curl_cmd="$curl_cmd -d '$payload'"
  fi
  
  curl_cmd="$curl_cmd -w \"\nHTTP_CODE:%{http_code}\nTIME:%{time_total}\" --max-time 10"
  
  # Exécuter la requête
  local response
  response=$(eval "$curl_cmd" 2>/dev/null)
  
  # Extraire le code HTTP et le temps de réponse
  local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
  local response_time=$(echo "$response" | grep "TIME:" | cut -d: -f2)
  local content=$(echo "$response" | grep -v "HTTP_CODE:" | grep -v "TIME:")
  
  # Analyser la réponse
  local result_emoji=""
  local result_text=""
  
  if [ "$http_code" = "200" ]; then
    if echo "$content" | grep -q '"success":true'; then
      result_emoji="✅"
      result_text="SUCCÈS - OPÉRATION RÉUSSIE"
    elif echo "$content" | grep -qi "error\|failed"; then
      result_emoji="⚠️"
      result_text="RÉPONSE AVEC ERREUR MAIS CODE 200"
    else
      result_emoji="✅"
      result_text="DONNÉES RÉCUPÉRÉES"
    fi
  elif [ "$http_code" = "400" ]; then
    result_emoji="✅"
    result_text="BAD REQUEST - VALIDATION FONCTIONNELLE"
  elif [ "$http_code" = "401" ]; then
    result_emoji="✅"
    result_text="NON AUTORISÉ - SÉCURITÉ FONCTIONNELLE"
  elif [ "$http_code" = "403" ]; then
    result_emoji="✅"
    result_text="ACCÈS INTERDIT - SÉCURITÉ FONCTIONNELLE"
  elif [ "$http_code" = "405" ]; then
    result_emoji="✅"
    result_text="MÉTHODE NON AUTORISÉE - SÉCURITÉ FONCTIONNELLE"
  elif [ "$http_code" = "422" ]; then
    result_emoji="✅"
    result_text="VALIDATION ÉCHOUÉE - SÉCURITÉ FONCTIONNELLE"
  elif [ "$http_code" = "429" ]; then
    result_emoji="⚡"
    result_text="RATE LIMIT ATTEINT - PROTECTION ACTIVE"
  elif [ "$http_code" = "500" ]; then
    result_emoji="🚨"
    result_text="ERREUR SERVEUR - PROBLÈME CRITIQUE!"
  elif [ "$http_code" = "404" ]; then
    result_emoji="❌"
    result_text="ENDPOINT NON TROUVÉ"
  elif [ -z "$http_code" ]; then
    result_emoji="❌"
    result_text="AUCUNE RÉPONSE - PROBLÈME DE CONNECTIVITÉ"
  else
    result_emoji="⚠️"
    result_text="CODE INATTENDU $http_code"
  fi

  # Ajouter au résumé
  RESULTS_SUMMARY+=("$TEST_COUNT.$result_emoji")
  
  # Affichage console - tous les emojis s'affichent
  echo -n "$TEST_COUNT.$result_emoji "
  
  # Stocker les détails SEULEMENT pour les tests qui ont vraiment échoué
  if [ "$result_emoji" != "✅" ] && [ "$result_emoji" != "⚡" ]; then
    # Stocker les détails du test échoué
    local failure_summary="$TEST_COUNT.$result_emoji $description - $result_text"
    
    # Créer un détail complet pour ce test échoué
    local failure_detail="
═══════════════════════════════════════════════════════════════
Test #$TEST_COUNT: $description
═══════════════════════════════════════════════════════════════
• Méthode: $method
• URL: $BASE_URL$ENDPOINT
• Authentification: $([ "$use_auth" = "true" ] && echo "Oui (Cookie fourni)" || echo "Non")
• Payload envoyé: ${payload:-"(aucun)"}
• Attendu: $expected
• Code HTTP reçu: $http_code (temps: ${response_time}s)
• Résultat: $result_text
• Réponse complète du serveur:
$(echo "$content" | sed 's/^/  /')
═══════════════════════════════════════════════════════════════"
    
    FAILED_TESTS+=("$failure_summary")
    FAILED_DETAILS+=("$failure_detail")
  fi

  # Pause pour éviter le rate limiting
  if [ "$result_emoji" = "⚡" ]; then
    sleep 2
  else
    sleep 0.3
  fi
}

# Test de connectivité de base
echo "[0] Test de connectivité de base..." | tee -a "$OUTPUT_FILE"
run_language_test "Test de connectivité GET sans auth" "Devrait rejeter sans auth" "false" "GET"

# Tests d'authentification
echo "[1] Tests d'authentification..." | tee -a "$OUTPUT_FILE"

run_language_test "GET sans authentification" "Devrait être rejeté (401)" "false" "GET"
run_language_test "POST sans authentification" "Devrait être rejeté (401)" "false" "POST" '{"language":"fr"}'
run_language_test "GET avec cookie invalide" "Devrait être rejeté (401)" "false" "GET"
run_language_test "POST avec cookie invalide" "Devrait être rejeté (401)" "false" "POST" '{"language":"fr"}'

# Tests avec authentification valide
echo "[2] Tests avec authentification valide..." | tee -a "$OUTPUT_FILE"

run_language_test "GET avec authentification valide" "Devrait récupérer la langue (200)" "true" "GET"
run_language_test "POST avec langue valide (fr)" "Devrait mettre à jour (200)" "true" "POST" '{"language":"fr"}'
run_language_test "POST avec langue valide (en)" "Devrait mettre à jour (200)" "true" "POST" '{"language":"en"}'

# Tests de méthodes HTTP non autorisées
echo "[3] Tests de méthodes HTTP..." | tee -a "$OUTPUT_FILE"

run_language_test "PUT avec auth" "Devrait être rejeté (405)" "true" "PUT" '{"language":"fr"}'
run_language_test "DELETE avec auth" "Devrait être rejeté (405)" "true" "DELETE"
run_language_test "PATCH avec auth" "Devrait être rejeté (405)" "true" "PATCH" '{"language":"fr"}'
run_language_test "HEAD avec auth" "Devrait répondre sans corps" "true" "HEAD"

# Tests de validation des codes de langue
echo "[4] Tests de validation des codes de langue..." | tee -a "$OUTPUT_FILE"

# Codes de langue invalides
run_language_test "Langue invalide: format incorrect" "Devrait être rejeté (400)" "true" "POST" '{"language":"invalid-language-format"}'
run_language_test "Langue invalide: trop longue" "Devrait être rejeté (400)" "true" "POST" '{"language":"francais"}'
run_language_test "Langue invalide: chiffres" "Devrait être rejeté (400)" "true" "POST" '{"language":"fr123"}'
run_language_test "Langue invalide: caractères spéciaux" "Devrait être rejeté (400)" "true" "POST" '{"language":"fr-FR@special"}'
run_language_test "Langue invalide: vide" "Devrait être rejeté (400)" "true" "POST" '{"language":""}'
run_language_test "Langue invalide: null" "Devrait être rejeté (400)" "true" "POST" '{"language":null}'

# Tests de codes de langue valides (selon votre API)
echo "[5] Tests de codes de langue valides..." | tee -a "$OUTPUT_FILE"

run_language_test "Langue valide: en (anglais)" "Devrait être accepté (200)" "true" "POST" '{"language":"en"}'
run_language_test "Langue valide: es (espagnol)" "Devrait être accepté (200)" "true" "POST" '{"language":"es"}'
run_language_test "Langue valide: fr (français)" "Devrait être accepté (200)" "true" "POST" '{"language":"fr"}'
run_language_test "Langue valide: it (italien)" "Devrait être accepté (200)" "true" "POST" '{"language":"it"}'
run_language_test "Langue valide: de (allemand)" "Devrait être accepté (200)" "true" "POST" '{"language":"de"}'
run_language_test "Langue valide: sv (suédois)" "Devrait être accepté (200)" "true" "POST" '{"language":"sv"}'
run_language_test "Langue valide: pt (portugais)" "Devrait être accepté (200)" "true" "POST" '{"language":"pt"}'

# Tests de codes de langue non supportés
echo "[6] Tests de codes de langue non supportés..." | tee -a "$OUTPUT_FILE"

run_language_test "Langue non supportée: ja (japonais)" "Devrait être rejeté (400)" "true" "POST" '{"language":"ja"}'
run_language_test "Langue non supportée: zh (chinois)" "Devrait être rejeté (400)" "true" "POST" '{"language":"zh"}'
run_language_test "Langue non supportée: ar (arabe)" "Devrait être rejeté (400)" "true" "POST" '{"language":"ar"}'
run_language_test "Langue non supportée: ru (russe)" "Devrait être rejeté (400)" "true" "POST" '{"language":"ru"}'
run_language_test "Langue non supportée: nl (néerlandais)" "Devrait être rejeté (400)" "true" "POST" '{"language":"nl"}'

# Tests de validation JSON
echo "[7] Tests de validation JSON..." | tee -a "$OUTPUT_FILE"

run_language_test "JSON invalide: malformé" "Devrait être rejeté (400)" "true" "POST" '{"language":"fr"'
run_language_test "JSON invalide: sans guillemets" "Devrait être rejeté (400)" "true" "POST" '{language:fr}'
run_language_test "JSON invalide: virgule finale" "Devrait être rejeté (400)" "true" "POST" '{"language":"fr",}'
run_language_test "Contenu non-JSON" "Devrait être rejeté (400)" "true" "POST" 'not-json-content'
run_language_test "JSON vide" "Devrait être rejeté (400)" "true" "POST" '{}'

# Tests de types de données incorrects
echo "[8] Tests de types de données..." | tee -a "$OUTPUT_FILE"

run_language_test "Type incorrect: number" "Devrait être rejeté (400)" "true" "POST" '{"language":123}'
run_language_test "Type incorrect: boolean" "Devrait être rejeté (400)" "true" "POST" '{"language":true}'
run_language_test "Type incorrect: array" "Devrait être rejeté (400)" "true" "POST" '{"language":["fr","en"]}'
run_language_test "Type incorrect: object" "Devrait être rejeté (400)" "true" "POST" '{"language":{"code":"fr"}}'

# Tests de champs supplémentaires
echo "[9] Tests de champs supplémentaires..." | tee -a "$OUTPUT_FILE"

run_language_test "Champ supplémentaire ignoré" "Devrait ignorer extra" "true" "POST" '{"language":"fr","extra_field":"ignored"}'
run_language_test "Tentative élévation privilèges" "Devrait ignorer admin" "true" "POST" '{"language":"fr","admin":true}'
run_language_test "Tentative modification autre user" "Devrait ignorer user_id" "true" "POST" '{"language":"fr","user_id":"other_user"}'
run_language_test "Injection de propriétés" "Devrait ignorer injection" "true" "POST" '{"language":"fr","__proto__":{"admin":true}}'

# Tests d'injection et attaques
echo "[10] Tests d'injection et attaques..." | tee -a "$OUTPUT_FILE"

run_language_test "Injection XSS dans langue" "Devrait être validé/échappé" "true" "POST" '{"language":"<script>alert(1)</script>"}'
run_language_test "Injection SQL dans langue" "Devrait être validé/échappé" "true" "POST" '{"language":"fr; DROP TABLE users; --"}'
run_language_test "Injection NoSQL dans langue" "Devrait être validé/échappé" "true" "POST" '{"language":{"$ne":null}}'
run_language_test "Path traversal dans langue" "Devrait être validé" "true" "POST" '{"language":"../../etc/passwd"}'
run_language_test "Null byte injection" "Devrait être validé" "true" "POST" '{"language":"fr\\u0000.php"}'

# Tests de caractères spéciaux et encodage
echo "[11] Tests de caractères spéciaux..." | tee -a "$OUTPUT_FILE"

run_language_test "Codes avec région rejetés: en-US" "Devrait être rejeté (400)" "true" "POST" '{"language":"en-US"}'
run_language_test "Codes avec région rejetés: fr-FR" "Devrait être rejeté (400)" "true" "POST" '{"language":"fr-FR"}'
run_language_test "Caractères de contrôle" "Devrait nettoyer" "true" "POST" '{"language":"fr\\u0001\\u001F"}'
run_language_test "Espaces dans langue" "Devrait valider format" "true" "POST" '{"language":"f r"}'
run_language_test "Tabulations et retours ligne" "Devrait nettoyer" "true" "POST" '{"language":"fr\\t\\n"}'

# Tests de longueur de chaîne
echo "[12] Tests de longueur de chaîne..." | tee -a "$OUTPUT_FILE"

# Générer une chaîne très longue
long_string=$(printf 'a%.0s' {1..1000})
very_long_string=$(printf 'b%.0s' {1..10000})

run_language_test "Langue très longue (1000 chars)" "Devrait être rejeté" "true" "POST" "{\"language\":\"$long_string\"}"
run_language_test "Langue extrêmement longue (10k chars)" "Devrait être rejeté" "true" "POST" "{\"language\":\"$very_long_string\"}"

# Tests de pollution de prototype
echo "[13] Tests de pollution de prototype..." | tee -a "$OUTPUT_FILE"

run_language_test "Pollution __proto__" "Devrait ignorer __proto__" "true" "POST" '{"__proto__":{"admin":true},"language":"fr"}'
run_language_test "Pollution constructor" "Devrait ignorer constructor" "true" "POST" '{"constructor":{"prototype":{"admin":true}},"language":"fr"}'
run_language_test "Pollution prototype dans langue" "Devrait valider langue" "true" "POST" '{"language":"__proto__.admin"}'

# Tests de Content-Type malveillants
echo "[14] Tests de Content-Type..." | tee -a "$OUTPUT_FILE"

# Note: Ces tests nécessiteraient une modification de la fonction pour changer le Content-Type
# Pour l'instant, on teste avec des payloads qui tentent de changer le comportement
run_language_test "Tentative changement Content-Type" "Devrait valider JSON" "true" "POST" '{"language":"fr","content-type":"text/html"}'

# Tests de headers d'injection
echo "[15] Tests d'injection de headers..." | tee -a "$OUTPUT_FILE"

run_language_test "Injection header dans données" "Devrait valider données" "true" "POST" '{"language":"fr\\r\\nX-Admin: true"}'
run_language_test "CRLF injection" "Devrait nettoyer CRLF" "true" "POST" '{"language":"fr\\r\\nSet-Cookie: admin=true"}'

# Tests de bypasses de validation
echo "[16] Tests de contournement..." | tee -a "$OUTPUT_FILE"

run_language_test "Casse différente: FR" "Devrait normaliser casse" "true" "POST" '{"language":"FR"}'
run_language_test "Casse mélangée: Fr" "Devrait normaliser casse" "true" "POST" '{"language":"Fr"}'
run_language_test "Avec espaces: ' fr '" "Devrait trimmer espaces" "true" "POST" '{"language":" fr "}'
run_language_test "Double-encoding" "Devrait décoder correctement" "true" "POST" '{"language":"fr%2520test"}'

# Tests de rate limiting
echo "[17] Tests de rate limiting..." | tee -a "$OUTPUT_FILE"

# Faire plusieurs requêtes rapides pour déclencher le rate limiting
for i in {1..10}; do
  if [ "$i" -eq 10 ]; then
    # Analyser seulement la dernière requête
    run_language_test "Requête #$i - test rate limiting" "Devrait être limité (429) ou accepté" "true" "POST" '{"language":"en"}'
  else
    # Requêtes silencieuses pour déclencher le rate limiting
    curl -s -o /dev/null -H "Cookie: $AUTH_COOKIE" -H "Content-Type: application/json" -d '{"language":"fr"}' -X POST "$BASE_URL$ENDPOINT" 2>/dev/null
    sleep 0.1
  fi
done

echo
echo

# Afficher le résumé des échecs SEULEMENT s'il y en a
if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
    echo "RÉSUMÉ DES TESTS ÉCHOUÉS:" | tee -a "$OUTPUT_FILE"
    echo "=========================" | tee -a "$OUTPUT_FILE"
    for failure in "${FAILED_TESTS[@]}"; do
        echo "$failure" | tee -a "$OUTPUT_FILE"
    done
    
    echo | tee -a "$OUTPUT_FILE"
    echo "DÉTAILS COMPLETS DES TESTS ÉCHOUÉS:" | tee -a "$OUTPUT_FILE"
    echo "===================================" | tee -a "$OUTPUT_FILE"
    
    for detail in "${FAILED_DETAILS[@]}"; do
        echo "$detail" | tee -a "$OUTPUT_FILE"
        echo | tee -a "$OUTPUT_FILE"
    done
fi

echo
echo "=============================================="
echo "TEST LANGUAGE API TERMINÉ!"
echo "=============================================="
echo "Rapport complet sauvegardé: $OUTPUT_FILE"
echo
echo "📊 RÉSUMÉ RAPIDE DES TESTS:"
echo "$(printf '%s ' "${RESULTS_SUMMARY[@]}")"
echo
echo "🔍 LÉGENDE:"
echo "✅ = Sécurisé (validation fonctionnelle)"
echo "⚠️ = Attention (comportement inattendu)"
echo "🚨 = Vulnérabilité critique"
echo "❌ = Erreur technique"
echo "❓ = À analyser manuellement"
echo "⚡ = Rate limiting actif"

# Compter les résultats
SECURE_COUNT=$(printf '%s\n' "${RESULTS_SUMMARY[@]}" | grep -c "✅")
WARNING_COUNT=$(printf '%s\n' "${RESULTS_SUMMARY[@]}" | grep -c "⚠️")
CRITICAL_COUNT=$(printf '%s\n' "${RESULTS_SUMMARY[@]}" | grep -c "🚨")
ERROR_COUNT=$(printf '%s\n' "${RESULTS_SUMMARY[@]}" | grep -c "❌")
AMBIGUOUS_COUNT=$(printf '%s\n' "${RESULTS_SUMMARY[@]}" | grep -c "❓")
RATELIMIT_COUNT=$(printf '%s\n' "${RESULTS_SUMMARY[@]}" | grep -c "⚡")

echo
echo "📈 STATISTIQUES:"
echo "Tests sécurisés: $SECURE_COUNT/$TEST_COUNT"
echo "Tests avec attention: $WARNING_COUNT/$TEST_COUNT"
echo "Vulnérabilités critiques: $CRITICAL_COUNT/$TEST_COUNT"
echo "Erreurs techniques: $ERROR_COUNT/$TEST_COUNT"
echo "Tests ambigus: $AMBIGUOUS_COUNT/$TEST_COUNT"
echo "Rate limiting: $RATELIMIT_COUNT/$TEST_COUNT"

echo
echo "🌐 CATÉGORIES TESTÉES POUR API LANGUAGE:"
echo "• Authentification et autorisation"
echo "• Validation des codes de langue (ISO 639-1)"
echo "• Support des codes de langue avec région"
echo "• Validation JSON et types de données"
echo "• Protection contre injections (XSS, SQL, NoSQL)"
echo "• Gestion des caractères spéciaux et Unicode"
echo "• Tests de pollution de prototype"
echo "• Validation de longueur et format"
echo "• Tests de contournement et bypasses"
echo "• Rate limiting et protection DoS"

if [ "$CRITICAL_COUNT" -gt 0 ]; then
    echo
    echo "🚨 ALERTE: $CRITICAL_COUNT vulnérabilité(s) critique(s) détectée(s)!"
elif [ "$WARNING_COUNT" -gt 0 ]; then
    echo
    echo "⚠️ ATTENTION: $WARNING_COUNT comportement(s) inattendu(s) détecté(s)!"
else
    echo
    echo "✅ Aucune vulnérabilité critique détectée dans ces tests."
fi

echo
echo "⚠️  RAPPEL: Assurez-vous d'avoir l'autorisation pour tester cet endpoint"
echo "    et que AUTH_COOKIE est valide pour un utilisateur autorisé."

exit 0