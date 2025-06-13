#!/bin/bash

# Script de test pour la sécurité de l'API de consentement
# Usage: ./test-consent.sh
# Tests des injections SQL, XSS et autres attaques sur app.beta.v2.helloquittex.com/api/newsletter/request

TARGET="https://app.beta.v2.helloquitx.com"
ENDPOINT="/api/newsletter/request"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="consent_security_test_${TIMESTAMP}.txt"
COOKIE_FILE="auth_cookie.txt"
FAILED_TESTS=()
FAILED_DETAILS=()
TEST_COUNT=0

echo "=== TEST DE SÉCURITÉ DE L'API DE CONSENTEMENT ===" | tee "$OUTPUT_FILE"
echo "Date: $(date)" | tee -a "$OUTPUT_FILE"
echo "Target: $TARGET$ENDPOINT" | tee -a "$OUTPUT_FILE"
echo

# Utilisation de la variable d'environnement AUTH_COOKIE
if [ -n "$AUTH_COOKIE" ]; then
  echo "$AUTH_COOKIE" > "$COOKIE_FILE"
  echo "Cookie d'authentification trouvé dans la variable d'environnement." | tee -a "$OUTPUT_FILE"
else
  echo "ERREUR: Variable d'environnement AUTH_COOKIE non définie." | tee -a "$OUTPUT_FILE"
  echo "Exécutez le script avec: AUTH_COOKIE=votre_cookie ./test-consent.sh" | tee -a "$OUTPUT_FILE"
  exit 1
fi

# Fonction pour exécuter un test
run_test() {
  local payload="$1"
  local description="$2"
  local expected="$3"
  local method="$4"  # GET ou POST (défaut POST)
  local use_auth="$5"  # true ou false (défaut true)
  
  # Valeurs par défaut
  method=${method:-"POST"}
  use_auth=${use_auth:-"true"}
  
  # Incrémenter le compteur de test
  TEST_COUNT=$((TEST_COUNT + 1))
  
  # Enregistrer les détails du test dans le fichier de log
  echo "----------------------------------------" >> "$OUTPUT_FILE"
  echo "Test #$TEST_COUNT: $description" >> "$OUTPUT_FILE"
  echo "Méthode: $method" >> "$OUTPUT_FILE"
  
  if [ "$method" = "POST" ]; then
    echo "Payload: $payload" >> "$OUTPUT_FILE"
  fi
  
  # Exécuter la requête
  local response
  if [ "$use_auth" = "true" ] && [ -f "$COOKIE_FILE" ]; then
    # Avec cookie
    if [ "$method" = "POST" ]; then
      response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
        -H "Content-Type: application/json" \
        -H "Cookie: $(cat "$COOKIE_FILE")" \
        -d "$payload" \
        -X POST "${TARGET}${ENDPOINT}" 2>/dev/null)
    else
      response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
        -H "Content-Type: application/json" \
        -H "Cookie: $(cat "$COOKIE_FILE")" \
        -X GET "${TARGET}${ENDPOINT}" 2>/dev/null)
    fi
  else
    # Sans cookie
    if [ "$method" = "POST" ]; then
      response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        -X POST "${TARGET}${ENDPOINT}" 2>/dev/null)
    else
      response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
        -H "Content-Type: application/json" \
        -X GET "${TARGET}${ENDPOINT}" 2>/dev/null)
    fi
  fi
  
  # Extraire le code HTTP et le temps de réponse
  local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
  local response_time=$(echo "$response" | grep "TIME:" | cut -d: -f2)
  local content=$(echo "$response" | grep -v "HTTP_CODE:" | grep -v "TIME:")
  
  echo "HTTP Code: $http_code" >> "$OUTPUT_FILE"
  echo "Response Time: ${response_time}s" >> "$OUTPUT_FILE"
  echo "Response:" >> "$OUTPUT_FILE"
  echo "$content" >> "$OUTPUT_FILE"
  echo "Expected: $expected" >> "$OUTPUT_FILE"
  
  # Vérifier si la réponse est conforme aux attentes
  local test_passed=false
  local result_message=""
  
  if [ "$http_code" = "200" ]; then
    if echo "$content" | grep -qi "error\|invalid\|failed"; then
      result_message="REJETÉ MAIS CODE 200 - INCOHÉRENT"
    else
      result_message="ACCEPTÉ - VALIDE"
      if [[ "$expected" == *"accepté"* ]]; then
        test_passed=true
      else
        result_message="ACCEPTÉ - POTENTIELLEMENT VULNÉRABLE!"
      fi
    fi
  elif [ "$http_code" = "400" ]; then
    result_message="CORRECTEMENT BLOQUÉ - VALIDATION FONCTIONNELLE"
    if [[ "$expected" == *"bloqué"* ]] || [[ "$expected" == *"rejeté"* ]]; then
      test_passed=true
    fi
  elif [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
    result_message="NON AUTORISÉ - AUTHENTIFICATION REQUISE"
    if [[ "$expected" == *"rejeté"* ]] && [[ "$expected" == *"401"* ]]; then
      test_passed=true
    fi
  elif [ "$http_code" = "500" ]; then
    result_message="ERREUR SERVEUR - POTENTIELLEMENT VULNÉRABLE!"
  elif [ "$http_code" = "404" ]; then
    result_message="ENDPOINT NON TROUVÉ"
  elif [ "$http_code" = "429" ]; then
    result_message="LIMITE DE TAUX DÉPASSÉE"
  else
    result_message="CODE INATTENDU $http_code"
  fi
  
  # Enregistrer le résultat dans le fichier de log
  if [ "$test_passed" = true ]; then
    echo "✅ RÉSULTAT: $result_message - TEST RÉUSSI" >> "$OUTPUT_FILE"
    # Afficher uniquement le numéro et l'emoji de réussite
    echo -n "$TEST_COUNT.✅ " 
  else
    if [ "$http_code" = "500" ]; then
      echo "🚨 RÉSULTAT: $result_message - TEST ÉCHOUÉ" >> "$OUTPUT_FILE"
    elif [[ "$result_message" == *"POTENTIELLEMENT VULNÉRABLE"* ]]; then
      echo "⚠️ RÉSULTAT: $result_message - TEST ÉCHOUÉ" >> "$OUTPUT_FILE"
    else
      echo "❌ RÉSULTAT: $result_message - TEST ÉCHOUÉ" >> "$OUTPUT_FILE"
    fi
    
    # Stocker les détails du test échoué pour affichage ultérieur
    local failure_summary
    if [ "$http_code" = "500" ]; then
      failure_summary="$TEST_COUNT.🚨 $description - $result_message"
    elif [[ "$result_message" == *"POTENTIELLEMENT VULNÉRABLE"* ]]; then
      failure_summary="$TEST_COUNT.⚠️ $description - $result_message"
    else
      failure_summary="$TEST_COUNT.❌ $description - $result_message"
    fi
    
    # Créer un détail complet pour ce test échoué
    local failure_detail="
═══════════════════════════════════════════════════════════════
Test #$TEST_COUNT: $description
═══════════════════════════════════════════════════════════════
• Méthode: $method
• URL: $TARGET$ENDPOINT
• Authentification: $use_auth"
    
    if [ "$method" = "POST" ]; then
      failure_detail="$failure_detail
• Payload envoyé:
  $payload"
    fi
    
    failure_detail="$failure_detail
• Attendu: $expected
• Code HTTP reçu: $http_code (temps: ${response_time}s)
• Résultat: $result_message
• Réponse complète du serveur:
$(echo "$content" | sed 's/^/  /')
═══════════════════════════════════════════════════════════════"
    
    FAILED_TESTS+=("$failure_summary")
    FAILED_DETAILS+=("$failure_detail")
    
    # Afficher uniquement le numéro et l'emoji d'échec
    if [ "$http_code" = "500" ]; then
      echo -n "$TEST_COUNT.🚨 "
    elif [[ "$result_message" == *"POTENTIELLEMENT VULNÉRABLE"* ]]; then
      echo -n "$TEST_COUNT.⚠️ "
    else
      echo -n "$TEST_COUNT.❌ "
    fi
  fi
  
  # Pause pour éviter le rate limiting
  sleep 1
}

# Test d'authentification
echo "[0] Test d'authentification..." >> "$OUTPUT_FILE"

# Test POST sans authentification
run_test '{"type":"hqx_newsletter", "value":true}' "POST sans authentification" "Devrait être rejeté (401)" "POST" "false"

# Test des payloads d'injection SQL dans les types de consentement
echo "[1] Tests d'injection SQL dans le type de consentement..." >> "$OUTPUT_FILE"

sql_payloads=(
  '{"type":"hqx_newsletter'\'' OR 1=1 --", "value":true}'
  '{"type":"hqx_newsletter\" OR \"1\"=\"1", "value":true}'
  '{"type":"hqx_newsletter; DROP TABLE users; --", "value":true}'
  '{"type":"hqx_newsletter UNION SELECT * FROM users --", "value":true}'
  '{"consents":[{"type":"hqx_newsletter'\'' OR 1=1 --", "value":true}]}'
  '{"consents":[{"type":"hqx_newsletter\" OR \"1\"=\"1", "value":true}]}'
)

sql_descriptions=(
  "Injection SQL avec guillemet simple et commentaire"
  "Injection SQL avec guillemet double"
  "Injection SQL avec DROP TABLE"
  "Injection SQL avec UNION SELECT"
  "Injection SQL dans array de consents (guillemet simple)"
  "Injection SQL dans array de consents (guillemet double)"
)

for i in "${!sql_payloads[@]}"; do
  run_test "${sql_payloads[$i]}" "${sql_descriptions[$i]}" "Devrait être bloqué par validation"
done

# Test des payloads XSS dans les types de consentement
echo "[2] Tests d'attaque XSS dans le type de consentement..." >> "$OUTPUT_FILE"

xss_payloads=(
  '{"type":"<script>alert(1)</script>", "value":true}'
  '{"type":"javascript:alert(1)", "value":true}'
  '{"type":"hqx_newsletter onload=alert(1)", "value":true}'
  '{"consents":[{"type":"<img src=x onerror=alert(1)>", "value":true}]}'
  '{"consents":[{"type":"<svg onload=alert(1)>", "value":true}]}'
)

xss_descriptions=(
  "Injection XSS avec balise script"
  "Injection XSS avec protocole javascript"
  "Injection XSS avec event handler"
  "Injection XSS dans array de consents (img)"
  "Injection XSS dans array de consents (svg)"
)

for i in "${!xss_payloads[@]}"; do
  run_test "${xss_payloads[$i]}" "${xss_descriptions[$i]}" "Devrait être bloqué par validation"
done

# Test de pollution de prototype
echo "[3] Tests de pollution de prototype..." >> "$OUTPUT_FILE"

prototype_payloads=(
  '{"__proto__":{"admin":true}, "type":"hqx_newsletter", "value":true}'
  '{"constructor":{"prototype":{"admin":true}}, "type":"hqx_newsletter", "value":true}'
  '{"prototype":{"admin":true}, "type":"hqx_newsletter", "value":true}'
  '{"consents":[{"__proto__":{"admin":true}, "type":"hqx_newsletter", "value":true}]}'
)

prototype_descriptions=(
  "Pollution de prototype avec __proto__"
  "Pollution de prototype avec constructor"
  "Pollution de prototype avec prototype"
  "Pollution de prototype dans array de consents"
)

for i in "${!prototype_payloads[@]}"; do
  run_test "${prototype_payloads[$i]}" "${prototype_descriptions[$i]}" "Devrait être bloqué par validation"
done

# Test d'injection dans l'email
echo "[4] Tests d'injection dans l'email..." >> "$OUTPUT_FILE"

email_payloads=(
  '{"email":"admin@example.com'\'' OR 1=1 --", "type":"hqx_newsletter", "value":true}'
  '{"email":"<script>alert(1)</script>@example.com", "type":"hqx_newsletter", "value":true}'
  '{"email":"javascript:alert(1)@example.com", "type":"hqx_newsletter", "value":true}'
  '{"email":"user@example.com; DROP TABLE users; --", "type":"hqx_newsletter", "value":true}'
)

email_descriptions=(
  "Injection SQL dans l'email"
  "Injection XSS dans l'email avec balise script"
  "Injection XSS dans l'email avec protocole javascript"
  "Injection SQL dans l'email avec DROP TABLE"
)

for i in "${!email_payloads[@]}"; do
  run_test "${email_payloads[$i]}" "${email_descriptions[$i]}" "Devrait être bloqué par validation"
done

# Test des structures de données invalides
echo "[5] Test des structures de données invalides..." >> "$OUTPUT_FILE"

structure_payloads=(
  '{"type":123, "value":true}'
  '{"type":"hqx_newsletter", "value":"true"}'
  '{"consents":[{"type":123, "value":true}]}'
  '{"consents":[{"type":"hqx_newsletter", "value":"true"}]}'
  '{"consents":"not_an_array"}'
  '{"type":null, "value":null}'
  '{}'
  'not_json'
)

structure_descriptions=(
  "Type non-string (number)"
  "Value non-boolean (string)"
  "Type non-string dans array de consents"
  "Value non-boolean dans array de consents"
  "Consents non-array"
  "Type et value null"
  "Objet vide"
  "Payload non-JSON"
)

for i in "${!structure_payloads[@]}"; do
  run_test "${structure_payloads[$i]}" "${structure_descriptions[$i]}" "Devrait être bloqué par validation de type"
done

# Test avec valeurs légitimes
echo "[6] Test avec valeurs légitimes..." >> "$OUTPUT_FILE"

valid_payloads=(
  '{"email":"user@example.com", "type":"hqx_newsletter", "value":true}'
  '{"email":"user@example.com", "type":"hqx_newsletter", "value":false}'
  '{"consents":[{"type":"hqx_newsletter", "value":true}]}'
  '{"consents":[{"type":"oep_accepted", "value":true}, {"type":"research_accepted", "value":false}]}'
  '{"type":"hqx_newsletter", "value":true}'
  '{"type":"hqx_newsletter", "value":false}'
)

valid_descriptions=(
  "Email et consentement valides (value=true)"
  "Email et consentement valides (value=false)"
  "Array de consents valide (un seul)"
  "Array de consents valide (plusieurs)"
  "Consentement simple valide (value=true)"
  "Consentement simple valide (value=false)"
)

for i in "${!valid_payloads[@]}"; do
  run_test "${valid_payloads[$i]}" "${valid_descriptions[$i]}" "Devrait être accepté"
done

# Afficher une nouvelle ligne après tous les tests
echo

# Afficher les détails des tests échoués
if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
  echo
  echo "RÉSUMÉ DES TESTS ÉCHOUÉS:"
  echo "========================="
  for failed_test in "${FAILED_TESTS[@]}"; do
    echo "$failed_test"
  done
  
  echo
  echo
  echo "DÉTAILS COMPLETS DES TESTS ÉCHOUÉS:"
  echo "==================================="
  for failed_detail in "${FAILED_DETAILS[@]}"; do
    echo "$failed_detail"
    echo
  done
fi

echo
echo "=============================================="
echo "TEST DE SÉCURITÉ DES CONSENTEMENTS TERMINÉ!"
echo "=============================================="
echo "Tests réussis: $((TEST_COUNT - ${#FAILED_TESTS[@]}))/$TEST_COUNT"
echo "Tests échoués: ${#FAILED_TESTS[@]}/$TEST_COUNT"
echo "Rapport complet sauvegardé: $OUTPUT_FILE"

# Nettoyage
if [ -f "$COOKIE_FILE" ]; then
  echo "Suppression du fichier de cookie temporaire..."
  rm -f "$COOKIE_FILE"
fi

exit 0