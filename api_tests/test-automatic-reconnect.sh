#!/bin/bash

# Enhanced test script for /api/users/automatic-reconnect endpoint
# Usage: AUTH_COOKIE="your_auth_cookie" ./test-automatic-reconnect-enhanced.sh

# Configuration
BASE_URL="https://app.beta.v2.helloquitx.com"
ENDPOINT="/api/users/automatic-reconnect"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="automatic_reconnect_test_${TIMESTAMP}.txt"

echo "=== ENHANCED TESTING /api/users/automatic-reconnect ===" | tee $OUTPUT_FILE
echo "Date: $(date)" | tee -a $OUTPUT_FILE
echo "Target: $BASE_URL$ENDPOINT" | tee -a $OUTPUT_FILE
echo

# Check if AUTH_COOKIE is set
if [ -z "$AUTH_COOKIE" ]; then
  echo "Error: AUTH_COOKIE environment variable is not set" | tee -a $OUTPUT_FILE
  echo "Usage: AUTH_COOKIE=\"your_auth_cookie\" ./test-automatic-reconnect-enhanced.sh" | tee -a $OUTPUT_FILE
  exit 1
fi

# Variables pour le résumé
TEST_COUNT=0
RESULTS_SUMMARY=()
FAILED_TESTS=()
FAILED_DETAILS=()

# Fonction pour exécuter un test
run_test() {
  local payload="$1"
  local description="$2"
  local expected="$3"
  local auth_header="$4"
  local method="${5:-POST}"
  
  TEST_COUNT=$((TEST_COUNT + 1))
  
  # Construire la commande curl
  local curl_cmd="curl -s -X $method \"$BASE_URL$ENDPOINT\" -H \"Content-Type: application/json\""
  
  # Ajouter l'authentification si fournie
  if [ -n "$auth_header" ]; then
    curl_cmd="$curl_cmd -H \"Cookie: $auth_header\""
  fi
  
  # Ajouter le payload si fourni
  if [ -n "$payload" ]; then
    curl_cmd="$curl_cmd -d '$payload'"
  fi
  
  curl_cmd="$curl_cmd -w \"\nHTTP_CODE:%{http_code}\nTIME:%{time_total}\""
  
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
      result_text="SUCCÈS - MISE À JOUR RÉUSSIE"
    else
      result_emoji="⚠️"
      result_text="RÉPONSE INATTENDUE - À VÉRIFIER"
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
  elif [ "$http_code" = "500" ]; then
    result_emoji="🚨"
    result_text="ERREUR SERVEUR - PROBLÈME CRITIQUE!"
  elif [ "$http_code" = "404" ]; then
    result_emoji="❌"
    result_text="ENDPOINT NON TROUVÉ"
  elif [ "$http_code" = "429" ]; then
    result_emoji="⚡"
    result_text="LIMITE DE TAUX - PROTECTION ACTIVE"
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
  if [ "$result_emoji" != "✅" ]; then
    # Stocker les détails du test échoué
    local failure_summary="$TEST_COUNT.$result_emoji $description - $result_text"
    
    # Créer un détail complet pour ce test échoué
    local failure_detail="
═══════════════════════════════════════════════════════════════
Test #$TEST_COUNT: $description
═══════════════════════════════════════════════════════════════
• Méthode: $method
• URL: $BASE_URL$ENDPOINT
• Authentification: $([ -n "$auth_header" ] && echo "Oui (Cookie fourni)" || echo "Non")
• Payload envoyé:
  $payload
• Attendu: $expected
• Code HTTP reçu: $http_code (temps: ${response_time}s)
• Résultat: $result_text
• Réponse complète du serveur:
$(echo "$content" | sed 's/^/  /')
═══════════════════════════════════════════════════════════════"
    
    FAILED_TESTS+=("$failure_summary")
    FAILED_DETAILS+=("$failure_detail")
  fi

  # Pause courte pour éviter la surcharge
  sleep 0.1
}

Test de connectivité de base
echo "[0] Test de connectivité de base..." | tee -a $OUTPUT_FILE
run_test "" "Test de connectivité sans données" "Devrait rejeter sans auth" "" "GET"

# # Tests d'authentification
echo "[1] Tests d'authentification..." | tee -a $OUTPUT_FILE

run_test '{"automatic_reconnect":true}' "POST sans authentification" "Devrait être rejeté (401)" ""
run_test '{"automatic_reconnect":true}' "POST avec cookie invalide" "Devrait être rejeté (401)" "invalid_cookie=123"
run_test '{"automatic_reconnect":true}' "POST avec cookie vide" "Devrait être rejeté (401)" ""
run_test "" "GET sans authentification" "Devrait être rejeté (401)" "" "GET"

# Tests de validation des données
echo "[2] Tests de validation des données..." | tee -a $OUTPUT_FILE

run_test '{}' "POST avec objet vide" "Devrait être rejeté (400)" "$AUTH_COOKIE"
run_test '{"automatic_reconnect":"not-a-boolean"}' "POST avec type invalide (string)" "Devrait être rejeté (400)" "$AUTH_COOKIE"
run_test '{"automatic_reconnect":123}' "POST avec type invalide (number)" "Devrait être rejeté (400)" "$AUTH_COOKIE"
run_test '{"automatic_reconnect":null}' "POST avec valeur null" "Devrait être rejeté (400)" "$AUTH_COOKIE"
run_test '{"automatic_reconnect":[]}' "POST avec array" "Devrait être rejeté (400)" "$AUTH_COOKIE"
run_test '{"automatic_reconnect":{}}' "POST avec objet" "Devrait être rejeté (400)" "$AUTH_COOKIE"

# Tests de champs supplémentaires
echo "[3] Tests de champs supplémentaires..." | tee -a $OUTPUT_FILE

run_test '{"automatic_reconnect":true,"extra_field":"test"}' "POST avec champ supplémentaire" "Devrait ignorer le champ extra" "$AUTH_COOKIE"
run_test '{"automatic_reconnect":true,"admin":true}' "POST avec tentative d'élévation de privilèges" "Devrait ignorer admin" "$AUTH_COOKIE"
run_test '{"automatic_reconnect":true,"user_id":"other_user"}' "POST avec tentative de modification d'autre utilisateur" "Devrait ignorer user_id" "$AUTH_COOKIE"

# Tests JSON malformés
echo "[4] Tests JSON malformés..." | tee -a $OUTPUT_FILE

run_test '{"automatic_reconnect":true' "POST avec JSON incomplet" "Devrait être rejeté (400)" "$AUTH_COOKIE"
run_test 'automatic_reconnect":true}' "POST avec JSON malformé" "Devrait être rejeté (400)" "$AUTH_COOKIE"
run_test '{"automatic_reconnect":}' "POST avec valeur manquante" "Devrait être rejeté (400)" "$AUTH_COOKIE"
run_test 'not_json_at_all' "POST avec contenu non-JSON" "Devrait être rejeté (400)" "$AUTH_COOKIE"

# Tests d'injection
echo "[5] Tests d'injection..." | tee -a $OUTPUT_FILE

run_test '{"automatic_reconnect":"<script>alert(1)</script>"}' "POST avec XSS dans valeur" "Devrait être rejeté (400)" "$AUTH_COOKIE"
run_test "{\"automatic_reconnect\":\"' OR 1=1 --\"}" "POST avec injection SQL" "Devrait être rejeté (400)" "$AUTH_COOKIE"
run_test '{"automatic_reconnect":{"$ne":null}}' "POST avec injection NoSQL" "Devrait être rejeté (400)" "$AUTH_COOKIE"

# Tests de pollution de prototype
echo "[6] Tests de pollution de prototype..." | tee -a $OUTPUT_FILE

run_test '{"__proto__":{"admin":true},"automatic_reconnect":true}' "POST avec pollution __proto__" "Devrait ignorer __proto__" "$AUTH_COOKIE"
run_test '{"constructor":{"prototype":{"admin":true}},"automatic_reconnect":true}' "POST avec pollution constructor" "Devrait ignorer constructor" "$AUTH_COOKIE"

# Tests de méthodes HTTP
echo "[7] Tests de méthodes HTTP..." | tee -a $OUTPUT_FILE

run_test '{"automatic_reconnect":true}' "PUT avec données valides" "Devrait être rejeté ou accepté selon l'API" "$AUTH_COOKIE" "PUT"
run_test '{"automatic_reconnect":true}' "PATCH avec données valides" "Devrait être rejeté ou accepté selon l'API" "$AUTH_COOKIE" "PATCH"
run_test "" "DELETE sans données" "Devrait être rejeté" "$AUTH_COOKIE" "DELETE"
# run_test "" "HEAD sans données" "Devrait répondre sans corps" "$AUTH_COOKIE" "HEAD"

# Tests de headers malveillants
echo "[8] Tests de headers malveillants..." | tee -a $OUTPUT_FILE

# Note: Ces tests nécessiteraient une modification plus complexe de la fonction run_test
# Pour l'instant, on teste avec des payloads contenant des tentatives d'injection de headers
# run_test '{"automatic_reconnect":true,"header_injection":"test\r\nX-Admin: true"}' "POST avec injection de header" "Devrait nettoyer l'input" "$AUTH_COOKIE"

# Tests de taille de payload
echo "[9] Tests de taille de payload..." | tee -a $OUTPUT_FILE

# # Générer une chaîne très longue
long_string=$(printf 'a%.0s' {1..10000})
run_test "{\"automatic_reconnect\":\"$long_string\"}" "POST avec payload très long" "Devrait être rejeté (400)" "$AUTH_COOKIE"

# # Tests de valeurs valides (devraient fonctionner)
echo "[10] Tests de valeurs valides..." | tee -a $OUTPUT_FILE

run_test '{"automatic_reconnect":true}' "POST avec true valide" "Devrait réussir (200)" "$AUTH_COOKIE"
run_test '{"automatic_reconnect":false}' "POST avec false valide" "Devrait réussir (200)" "$AUTH_COOKIE"
run_test '{"automatic_reconnect":true}' "POST avec true (re-test)" "Devrait réussir (200)" "$AUTH_COOKIE"

echo
echo

# Afficher le résumé des échecs SEULEMENT s'il y en a
if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
    echo "RÉSUMÉ DES TESTS ÉCHOUÉS:" | tee -a $OUTPUT_FILE
    echo "=========================" | tee -a $OUTPUT_FILE
    for failure in "${FAILED_TESTS[@]}"; do
        echo "$failure" | tee -a $OUTPUT_FILE
    done
    
    echo | tee -a $OUTPUT_FILE
    echo "DÉTAILS COMPLETS DES TESTS ÉCHOUÉS:" | tee -a $OUTPUT_FILE
    echo "===================================" | tee -a $OUTPUT_FILE
    
    for detail in "${FAILED_DETAILS[@]}"; do
        echo "$detail" | tee -a $OUTPUT_FILE
        echo | tee -a $OUTPUT_FILE
    done
fi

echo
echo "=============================================="
echo "TEST AUTOMATIC RECONNECT API TERMINÉ!"
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
echo "    et que AUTH_COOKIE est valide pour un utilisateur de test."

exit 0