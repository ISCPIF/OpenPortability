#!/bin/bash

# Script de test pour la sécurité de l'API de mise à jour des statistiques utilisateur
# Usage: ./test-update-stats.sh
# Tests d'authentification et de rate limiting sur l'endpoint /api/update/user_stats

TARGET="https://app.beta.v2.helloquitx.com"
ENDPOINT="/api/update/user_stats"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="update_stats_security_test_${TIMESTAMP}.txt"
COOKIE_FILE="auth_cookie.txt"

echo "=== TEST DE SÉCURITÉ DE L'API DE MISE À JOUR DES STATISTIQUES ===" | tee "$OUTPUT_FILE"
echo "Date: $(date)" | tee -a "$OUTPUT_FILE"
echo "Target: $TARGET" | tee -a "$OUTPUT_FILE"
echo "Endpoint: $ENDPOINT" | tee -a "$OUTPUT_FILE"
echo

# Utilisation de la variable d'environnement AUTH_COOKIE
if [ -n "$AUTH_COOKIE" ]; then
  echo "$AUTH_COOKIE" > "$COOKIE_FILE"
  echo "Cookie d'authentification trouvé dans la variable d'environnement." | tee -a "$OUTPUT_FILE"
else
  echo "ERREUR: Variable d'environnement AUTH_COOKIE non définie." | tee -a "$OUTPUT_FILE"
  echo "Exécutez le script avec: AUTH_COOKIE=votre_cookie ./test-update-stats.sh" | tee -a "$OUTPUT_FILE"
  exit 1
fi

# Fonction pour encoder correctement les paramètres URL, y compris les crochets []
encode_url_param() {
  local param="$1"
  # Encoder les caractères spéciaux pour curl
  param=$(echo "$param" | sed 's/\[/%5B/g' | sed 's/\]/%5D/g')
  echo "$param"
}

# Fonction pour exécuter un test
run_test() {
  local description="$1"
  local expected="$2"
  local use_auth="$3"  # true ou false
  local query_params="$4"  # paramètres optionnels de requête
  
  echo "----------------------------------------" | tee -a "$OUTPUT_FILE"
  echo "Test: $description" | tee -a "$OUTPUT_FILE"
  echo "Endpoint: $ENDPOINT" | tee -a "$OUTPUT_FILE"
  
  if [ -n "$query_params" ]; then
    echo "Paramètres: $query_params" | tee -a "$OUTPUT_FILE"
  fi
  
  # Construire l'URL avec les paramètres de requête si présents
  local url="${TARGET}${ENDPOINT}"
  if [ -n "$query_params" ]; then
    # Encoder correctement les paramètres
    local encoded_params=$(encode_url_param "$query_params")
    url="${url}?${encoded_params}"
  fi
  
  # Exécuter la requête avec un timeout pour éviter les blocages
  local response
  if [ "$use_auth" = "true" ] && [ -f "$COOKIE_FILE" ]; then
    # Avec cookie
    response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
      -H "Content-Type: application/json" \
      -H "Cookie: $(cat "$COOKIE_FILE")" \
      --max-time 10 \
      -d "{}" \
      -X POST "$url" 2>/dev/null)
  else
    # Sans cookie
    response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
      -H "Content-Type: application/json" \
      --max-time 10 \
      -d "{}" \
      -X POST "$url" 2>/dev/null)
  fi
  
  # Extraire le code HTTP et le temps de réponse
  local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
  local response_time=$(echo "$response" | grep "TIME:" | cut -d: -f2)
  local content=$(echo "$response" | grep -v "HTTP_CODE:" | grep -v "TIME:")
  
  # S'assurer que le code HTTP est présent, sinon considérer comme une erreur
  if [ -z "$http_code" ]; then
    http_code="ERREUR"
    echo "ERREUR: Pas de code HTTP reçu, la requête a probablement échoué" | tee -a "$OUTPUT_FILE"
  fi
  
  echo "HTTP Code: $http_code" | tee -a "$OUTPUT_FILE"
  echo "Response Time: ${response_time}s" | tee -a "$OUTPUT_FILE"
  echo "Response:" | tee -a "$OUTPUT_FILE"
  echo "$content" | tee -a "$OUTPUT_FILE"
  echo "Expected: $expected" | tee -a "$OUTPUT_FILE"
  
  # Vérifier si la réponse est conforme aux attentes
  local test_passed=false
  local result_message=""
  
  if [ "$http_code" = "200" ]; then
    if echo "$content" | grep -qi "error\|invalid\|failed"; then
      result_message="REJETÉ MAIS CODE 200 - INCOHÉRENT"
    else
      result_message="ACCEPTÉ - VALIDE"
      if [[ "$expected" == *"accepté"* ]] || [[ "$expected" == *"réussir"* ]]; then
        test_passed=true
      fi
    fi
  elif [ "$http_code" = "400" ]; then
    result_message="CORRECTEMENT BLOQUÉ - VALIDATION FONCTIONNELLE"
    if [[ "$expected" == *"bloqué"* ]] || [[ "$expected" == *"rejeté"* ]]; then
      test_passed=true
    fi
  elif [ "$http_code" = "401" ]; then
    result_message="AUTHENTIFICATION REQUISE - SÉCURITÉ FONCTIONNELLE"
    if [[ "$expected" == *"rejeté"* ]] || [[ "$expected" == *"401"* ]]; then
      test_passed=true
    fi
  elif [ "$http_code" = "403" ]; then
    result_message="ACCÈS REFUSÉ - AUTORISATION FONCTIONNELLE"
    if [[ "$expected" == *"rejeté"* ]] || [[ "$expected" == *"403"* ]]; then
      test_passed=true
    fi
  elif [ "$http_code" = "429" ]; then
    result_message="RATE LIMIT ATTEINT - PROTECTION FONCTIONNELLE"
    if [[ "$expected" == *"rate limit"* ]] || [[ "$expected" == *"429"* ]]; then
      test_passed=true
    fi
  elif [ "$http_code" = "ERREUR" ]; then
    result_message="ERREUR DE REQUÊTE - VÉRIFIER LES LOGS"
  else
    result_message="CODE HTTP INATTENDU"
  fi
  
  if [ "$test_passed" = true ]; then
    echo "Résultat: ✅ $result_message" | tee -a "$OUTPUT_FILE"
  else
    echo "Résultat: ❌ $result_message" | tee -a "$OUTPUT_FILE"
  fi
  
  echo "" | tee -a "$OUTPUT_FILE"
  sleep 1  # Pause pour éviter de surcharger l'API
}

# Tests d'authentification
echo "[1] Tests d'authentification..." | tee -a "$OUTPUT_FILE"

# Test sans authentification
run_test "POST sans authentification" "Devrait être rejeté (401)" "false"

# Test avec authentification valide
run_test "POST avec authentification valide" "Devrait être accepté (200)" "true"

# Tests de rate limiting
echo "[2] Tests de rate limiting..." | tee -a "$OUTPUT_FILE"

# Premier appel - devrait réussir
run_test "Premier appel (devrait réussir)" "Devrait être accepté (200)" "true"

# Deuxième appel immédiat - devrait être limité
run_test "Deuxième appel immédiat" "Devrait être bloqué par rate limit (429)" "true"

# Troisième appel immédiat - devrait être limité
run_test "Troisième appel immédiat" "Devrait être bloqué par rate limit (429)" "true"

echo "Tests terminés. Résultats enregistrés dans $OUTPUT_FILE"
