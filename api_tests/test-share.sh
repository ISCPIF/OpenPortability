#!/bin/bash

# Script de test pour la sécurité de l'API de partage
# Usage: ./test-share.sh
# Tests des injections SQL, XSS et autres attaques sur app.beta.v2.helloquittex.com/api/share

TARGET="https://app.beta.v2.helloquitx.com"
ENDPOINT="/api/share"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="share_security_test_${TIMESTAMP}.txt"
COOKIE_FILE="auth_cookie.txt"
FAILED_TESTS=()
FAILED_DETAILS=()
TEST_COUNT=0

echo "=== TEST DE SÉCURITÉ DE L'API DE PARTAGE ===" | tee "$OUTPUT_FILE"
echo "Date: $(date)" | tee -a "$OUTPUT_FILE"
echo "Target: $TARGET$ENDPOINT" | tee -a "$OUTPUT_FILE"
echo

# Utilisation de la variable d'environnement AUTH_COOKIE
if [ -n "$AUTH_COOKIE" ]; then
  echo "$AUTH_COOKIE" > "$COOKIE_FILE"
  echo "Cookie d'authentification trouvé dans la variable d'environnement." | tee -a "$OUTPUT_FILE"
else
  echo "ERREUR: Variable d'environnement AUTH_COOKIE non définie." | tee -a "$OUTPUT_FILE"
  echo "Exécutez le script avec: AUTH_COOKIE=votre_cookie ./test-share.sh" | tee -a "$OUTPUT_FILE"
  exit 1
fi

# Fonction pour exécuter un test
run_test() {
  local payload="$1"
  local description="$2"
  local expected="$3"
  local method="$4"  # GET ou POST
  local use_auth="$5"  # true ou false
  
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
    else
      echo "❌ RÉSULTAT: $result_message - TEST ÉCHOUÉ" >> "$OUTPUT_FILE"
    fi
    
    # Stocker les détails du test échoué pour affichage ultérieur
    local failure_summary
    if [ "$http_code" = "500" ]; then
      failure_summary="$TEST_COUNT.🚨 $description - $result_message"
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
    else
      echo -n "$TEST_COUNT.❌ "
    fi
  fi
  
  # Pause pour éviter le rate limiting
  sleep 1
}

# Test d'authentification
echo "[1] Test d'authentification..." >> "$OUTPUT_FILE"

# Test GET sans authentification
run_test "" "GET sans authentification" "Devrait être rejeté (401)" "GET" "false"

# Test POST sans authentification
run_test '{"platform":"twitter", "success":true}' "POST sans authentification" "Devrait être rejeté (401)" "POST" "false"

# Test des payloads d'injection SQL dans les paramètres
echo "[2] Tests d'injection SQL dans les paramètres..." >> "$OUTPUT_FILE"

sql_payloads=(
  '{"platform":"twitter'\'' OR 1=1 --", "success":true}'
  '{"platform":"twitter\" OR \"1\"=\"1", "success":true}'
  '{"platform":"twitter; DROP TABLE users; --", "success":true}'
  '{"platform":"twitter UNION SELECT * FROM users --", "success":true}'
  '{"platform":"twitter", "success":"true'\'' OR 1=1 --"}'
)

sql_descriptions=(
  "Injection SQL dans le paramètre platform (single quote)"
  "Injection SQL dans le paramètre platform (double quote)"
  "Injection SQL dans le paramètre platform (DROP TABLE)"
  "Injection SQL dans le paramètre platform (UNION SELECT)"
  "Injection SQL dans le paramètre success"
)

for i in "${!sql_payloads[@]}"; do
  run_test "${sql_payloads[$i]}" "${sql_descriptions[$i]}" "Devrait être bloqué par validation" "POST" "true"
done

# Test des payloads XSS
echo "[3] Tests d'injection XSS..." >> "$OUTPUT_FILE"

xss_payloads=(
  '{"platform":"<script>alert(1)</script>", "success":true}'
  '{"platform":"javascript:alert(1)", "success":true}'
  '{"platform":"twitter onload=alert(1)", "success":true}'
  '{"platform":"<img src=x onerror=alert(1)>", "success":true}'
  '{"platform":"<svg onload=alert(1)>", "success":true}'
)

xss_descriptions=(
  "Injection XSS avec balise script"
  "Injection XSS avec protocole javascript"
  "Injection XSS avec event handler"
  "Injection XSS avec balise img"
  "Injection XSS avec balise svg"
)

for i in "${!xss_payloads[@]}"; do
  run_test "${xss_payloads[$i]}" "${xss_descriptions[$i]}" "Devrait être bloqué par validation" "POST" "true"
done

# Test de pollution de prototype
echo "[4] Tests de pollution de prototype..." >> "$OUTPUT_FILE"

prototype_payloads=(
  '{"__proto__":{"admin":true}, "platform":"twitter", "success":true}'
  '{"constructor":{"prototype":{"admin":true}}, "platform":"twitter", "success":true}'
  '{"prototype":{"admin":true}, "platform":"twitter", "success":true}'
)

prototype_descriptions=(
  "Pollution de prototype avec __proto__"
  "Pollution de prototype avec constructor"
  "Pollution de prototype avec prototype"
)

for i in "${!prototype_payloads[@]}"; do
  run_test "${prototype_payloads[$i]}" "${prototype_descriptions[$i]}" "Devrait être bloqué par validation" "POST" "true"
done

# Test des structures de données invalides
echo "[5] Test des structures de données invalides..." >> "$OUTPUT_FILE"

structure_payloads=(
  '{"platform":123, "success":true}'
  '{"platform":"twitter", "success":"true"}'
  '{"platform":null, "success":null}'
  '{"platform":"invalid_platform", "success":true}'
  '{"platform":"twitter"}'
  '{"success":true}'
  '{}'
  'not_json'
)

structure_descriptions=(
  "Platform non-string (number)"
  "Success non-boolean (string)"
  "Platform et success null"
  "Platform invalide (hors enum)"
  "Success manquant"
  "Platform manquant"
  "Objet vide"
  "Payload non-JSON"
)

for i in "${!structure_payloads[@]}"; do
  run_test "${structure_payloads[$i]}" "${structure_descriptions[$i]}" "Devrait être bloqué par validation de type" "POST" "true"
done

# Test avec valeurs légitimes
echo "[6] Test avec valeurs légitimes..." >> "$OUTPUT_FILE"

valid_payloads=(
  '{"platform":"twitter", "success":true}'
  '{"platform":"twitter", "success":false}'
  '{"platform":"bluesky", "success":true}'
  '{"platform":"mastodon", "success":true}'
)

valid_descriptions=(
  "Twitter partagé avec succès"
  "Twitter partagé sans succès"
  "Bluesky partagé avec succès"
  "Mastodon partagé avec succès"
)

for i in "${!valid_payloads[@]}"; do
  run_test "${valid_payloads[$i]}" "${valid_descriptions[$i]}" "Devrait être accepté" "POST" "true"
done

# Test de l'endpoint GET
echo "[7] Test de l'endpoint GET..." >> "$OUTPUT_FILE"
run_test "" "Récupération du statut de partage" "Devrait retourner hasShares" "GET" "true"

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
echo "TEST DE SÉCURITÉ DE L'API DE PARTAGE TERMINÉ!"
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