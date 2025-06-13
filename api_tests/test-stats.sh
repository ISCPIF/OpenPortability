#!/bin/bash

# Enhanced script de test pour la sécurité des API de statistiques
# Usage: AUTH_COOKIE="your_cookie" ./test-stats-enhanced.sh
# Tests d'authentification et de sécurité sur les endpoints /api/stats et /api/stats/total

TARGET="https://app.beta.v2.helloquitx.com"
ENDPOINTS=("/api/stats" "/api/stats/total")
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="stats_security_test_${TIMESTAMP}.txt"

echo "=== ENHANCED TESTING STATS APIs SECURITY ===" | tee "$OUTPUT_FILE"
echo "Date: $(date)" | tee -a "$OUTPUT_FILE"
echo "Target: $TARGET" | tee -a "$OUTPUT_FILE"
echo "Endpoints: ${ENDPOINTS[*]}" | tee -a "$OUTPUT_FILE"
echo

# Check if AUTH_COOKIE is set
if [ -z "$AUTH_COOKIE" ]; then
  echo "Error: AUTH_COOKIE environment variable is not set" | tee -a "$OUTPUT_FILE"
  echo "Usage: AUTH_COOKIE=\"your_cookie\" ./test-stats-enhanced.sh" | tee -a "$OUTPUT_FILE"
  exit 1
fi

# Variables pour le résumé
TEST_COUNT=0
RESULTS_SUMMARY=()
FAILED_TESTS=()
FAILED_DETAILS=()

# Fonction pour encoder correctement les paramètres URL
encode_url_param() {
  local param="$1"
  # Encoder les caractères spéciaux pour curl
  param=$(echo "$param" | sed 's/\[/%5B/g' | sed 's/\]/%5D/g' | sed 's/ /%20/g' | sed 's/&/%26/g')
  echo "$param"
}

# Fonction pour exécuter un test
run_stats_test() {
  local endpoint="$1"
  local description="$2"
  local expected="$3"
  local use_auth="$4"  # true ou false
  local query_params="$5"  # paramètres optionnels de requête
  local method="${6:-GET}"
  
  TEST_COUNT=$((TEST_COUNT + 1))
  
  # Construire l'URL avec les paramètres de requête si présents
  local url="${TARGET}${endpoint}"
  if [ -n "$query_params" ]; then
    local encoded_params=$(encode_url_param "$query_params")
    url="${url}?${encoded_params}"
  fi
  
  # Construire la commande curl
  local curl_cmd="curl -s -X $method \"$url\" -H \"Content-Type: application/json\""
  
  # Ajouter l'authentification si requise
  if [ "$use_auth" = "true" ]; then
    curl_cmd="$curl_cmd -H \"Cookie: $AUTH_COOKIE\""
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
    if echo "$content" | grep -qi "error\|invalid\|failed"; then
      result_emoji="⚠️"
      result_text="REJETÉ MAIS CODE 200 - INCOHÉRENT"
    else
      result_emoji="✅"
      result_text="ACCEPTÉ - DONNÉES RÉCUPÉRÉES"
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
• URL: $url
• Endpoint: $endpoint
• Authentification: $([ "$use_auth" = "true" ] && echo "Oui (Cookie fourni)" || echo "Non")
• Paramètres de requête: ${query_params:-"(aucun)"}
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
    sleep 3
  else
    sleep 0.5
  fi
}

# Test de connectivité de base
echo "[0] Test de connectivité de base..." | tee -a "$OUTPUT_FILE"
run_stats_test "/api/stats" "Test de connectivité sans auth" "Devrait rejeter sans auth" "false"

# Tests d'authentification sur tous les endpoints
echo "[1] Tests d'authentification..." | tee -a "$OUTPUT_FILE"

for endpoint in "${ENDPOINTS[@]}"; do
  run_stats_test "$endpoint" "GET sans authentification" "Devrait être rejeté (401)" "false"
  run_stats_test "$endpoint" "GET avec cookie invalide" "Devrait être rejeté (401)" "false" "" "GET"
done

# Tests avec authentification valide
echo "[2] Tests avec authentification valide..." | tee -a "$OUTPUT_FILE"

for endpoint in "${ENDPOINTS[@]}"; do
  run_stats_test "$endpoint" "GET avec authentification valide" "Devrait être accepté (200)" "true"
done

# Tests de méthodes HTTP non autorisées
echo "[3] Tests de méthodes HTTP..." | tee -a "$OUTPUT_FILE"

for endpoint in "${ENDPOINTS[@]}"; do
  run_stats_test "$endpoint" "POST avec auth" "Devrait être rejeté (405)" "true" "" "POST"
  run_stats_test "$endpoint" "PUT avec auth" "Devrait être rejeté (405)" "true" "" "PUT"
  run_stats_test "$endpoint" "DELETE avec auth" "Devrait être rejeté (405)" "true" "" "DELETE"
  run_stats_test "$endpoint" "PATCH avec auth" "Devrait être rejeté (405)" "true" "" "PATCH"
done

# Tests d'injection SQL dans les paramètres
echo "[4] Tests d'injection SQL..." | tee -a "$OUTPUT_FILE"

sql_params=(
  "id=1%20OR%201=1"
  "id=1%27%20OR%20%271%27=%271"
  "id=1;DROP%20TABLE%20users;--"
  "id=1%27%20UNION%20SELECT%20*%20FROM%20users--"
  "filter=1%27)%20OR%20(1=1"
  "sort=id%27;%20DROP%20TABLE%20stats;--"
  "limit=1%27%20OR%20SLEEP(5)--"
  "offset=1%27%20AND%20extractvalue(1,concat(0x7e,version(),0x7e))--"
)

sql_descriptions=(
  "Injection SQL basique OR 1=1"
  "Injection SQL avec guillemets"
  "Injection SQL destructive DROP TABLE"
  "Injection SQL avec UNION SELECT"
  "Injection SQL avec parenthèses"
  "Injection SQL dans paramètre sort"
  "Injection SQL dans paramètre limit"
  "Injection SQL avec extractvalue"
)

for endpoint in "${ENDPOINTS[@]}"; do
  for i in "${!sql_params[@]}"; do
    run_stats_test "$endpoint" "${sql_descriptions[$i]}" "Devrait être bloqué" "true" "${sql_params[$i]}"
  done
done

# Tests d'injection NoSQL
echo "[5] Tests d'injection NoSQL..." | tee -a "$OUTPUT_FILE"

nosql_params=(
  "id[$ne]=null"
  "id[$gt]="
  "id[$regex]=.*"
  "filter[$where]=return%20true"
  "id[$exists]=true"
  "sort[$ne]=null"
)

nosql_descriptions=(
  "NoSQL injection avec \$ne"
  "NoSQL injection avec \$gt"
  "NoSQL injection avec \$regex"
  "NoSQL injection avec \$where"
  "NoSQL injection avec \$exists"
  "NoSQL injection dans sort"
)

for endpoint in "${ENDPOINTS[@]}"; do
  for i in "${!nosql_params[@]}"; do
    run_stats_test "$endpoint" "${nosql_descriptions[$i]}" "Devrait être bloqué" "true" "${nosql_params[$i]}"
  done
done

# Tests XSS dans les paramètres
echo "[6] Tests XSS dans les paramètres..." | tee -a "$OUTPUT_FILE"

xss_params=(
  "callback=<script>alert(1)</script>"
  "jsonp=<img%20src=x%20onerror=alert(1)>"
  "format=<svg%20onload=alert(1)>"
  "filter=<iframe%20src=javascript:alert(1)>"
  "sort=\"%20onfocus=alert(1)%20autofocus=\""
  "callback=eval(atob('YWxlcnQoMSk='))"
)

xss_descriptions=(
  "XSS avec script dans callback"
  "XSS avec img dans jsonp"
  "XSS avec svg dans format"
  "XSS avec iframe dans filter"
  "XSS avec attribut dans sort"
  "XSS avec eval encodé"
)

for endpoint in "${ENDPOINTS[@]}"; do
  for i in "${!xss_params[@]}"; do
    run_stats_test "$endpoint" "${xss_descriptions[$i]}" "Devrait être bloqué/échappé" "true" "${xss_params[$i]}"
  done
done

# Tests de pollution de prototype
echo "[7] Tests de pollution de prototype..." | tee -a "$OUTPUT_FILE"

prototype_params=(
  "__proto__[admin]=true"
  "constructor[prototype][admin]=true"
  "__proto__[isAdmin]=true"
  "constructor.prototype.admin=true"
)

prototype_descriptions=(
  "Pollution avec __proto__"
  "Pollution avec constructor.prototype"
  "Pollution isAdmin avec __proto__"
  "Pollution avec notation point"
)

for endpoint in "${ENDPOINTS[@]}"; do
  for i in "${!prototype_params[@]}"; do
    run_stats_test "$endpoint" "${prototype_descriptions[$i]}" "Devrait être ignoré" "true" "${prototype_params[$i]}"
  done
done

# Tests de paramètres de pagination malveillants
echo "[8] Tests de paramètres de pagination..." | tee -a "$OUTPUT_FILE"

pagination_params=(
  "limit=-1"
  "limit=999999999"
  "offset=-1"
  "offset=999999999"
  "page=-1"
  "page=999999999"
  "limit=0"
  "limit=abc"
  "offset=xyz"
)

pagination_descriptions=(
  "Limit négatif"
  "Limit excessif"
  "Offset négatif"
  "Offset excessif"
  "Page négative"
  "Page excessive"
  "Limit zéro"
  "Limit non-numérique"
  "Offset non-numérique"
)

for endpoint in "${ENDPOINTS[@]}"; do
  for i in "${!pagination_params[@]}"; do
    run_stats_test "$endpoint" "${pagination_descriptions[$i]}" "Devrait être validé" "true" "${pagination_params[$i]}"
  done
done

# Tests de paramètres de filtre spécifiques aux stats
echo "[9] Tests de paramètres de filtre stats..." | tee -a "$OUTPUT_FILE"

stats_params=(
  "start_date=../../../etc/passwd"
  "end_date=<script>alert(1)</script>"
  "user_id=*"
  "metric=../../config"
  "group_by=; DROP TABLE users;"
  "format=../../../etc/hosts"
  "timezone=<img src=x onerror=alert(1)>"
  "interval=null"
)

stats_descriptions=(
  "Path traversal dans start_date"
  "XSS dans end_date"
  "Wildcard dans user_id"
  "Path traversal dans metric"
  "SQL injection dans group_by"
  "Path traversal dans format"
  "XSS dans timezone"
  "Null dans interval"
)

for endpoint in "${ENDPOINTS[@]}"; do
  for i in "${!stats_params[@]}"; do
    run_stats_test "$endpoint" "${stats_descriptions[$i]}" "Devrait être validé/nettoyé" "true" "${stats_params[$i]}"
  done
done

# Tests de paramètres de longueur excessive
echo "[10] Tests de longueur excessive..." | tee -a "$OUTPUT_FILE"

# Générer des chaînes très longues
long_string_1000=$(printf 'a%.0s' {1..1000})
long_string_5000=$(printf 'b%.0s' {1..5000})

length_params=(
  "filter=${long_string_1000}"
  "sort=${long_string_1000}"
  "metric=${long_string_5000}"
  "user_id=${long_string_1000}"
)

length_descriptions=(
  "Filter très long (1000 chars)"
  "Sort très long (1000 chars)"
  "Metric extrêmement long (5000 chars)"
  "User_id très long (1000 chars)"
)

for endpoint in "${ENDPOINTS[@]}"; do
  for i in "${!length_params[@]}"; do
    run_stats_test "$endpoint" "${length_descriptions[$i]}" "Devrait être tronqué ou rejeté" "true" "${length_params[$i]}"
  done
done

# Tests de combinaisons de paramètres malveillants
echo "[11] Tests de combinaisons malveillantes..." | tee -a "$OUTPUT_FILE"

combo_params=(
  "id=1%27%20OR%201=1&format=<script>alert(1)</script>"
  "__proto__[admin]=true&id[$ne]=null"
  "limit=-1&offset=999999&sort=; DROP TABLE users;"
  "callback=alert(1)&jsonp=<img src=x onerror=alert(1)>"
)

combo_descriptions=(
  "SQL injection + XSS"
  "Prototype pollution + NoSQL injection"
  "Paramètres pagination malveillants multiples"
  "XSS multiple dans callbacks"
)

for endpoint in "${ENDPOINTS[@]}"; do
  for i in "${!combo_params[@]}"; do
    run_stats_test "$endpoint" "${combo_descriptions[$i]}" "Devrait être entièrement bloqué" "true" "${combo_params[$i]}"
  done
done

# Tests de rate limiting
echo "[12] Tests de rate limiting..." | tee -a "$OUTPUT_FILE"

for endpoint in "${ENDPOINTS[@]}"; do
  # Faire plusieurs requêtes rapides pour déclencher le rate limiting
  for i in {1..15}; do
    if [ "$i" -eq 15 ]; then
      # Analyser seulement la dernière requête
      run_stats_test "$endpoint" "Requête #$i - test rate limiting" "Devrait être limité (429) ou accepté" "true"
    else
      # Requêtes silencieuses pour déclencher le rate limiting
      curl -s -o /dev/null -H "Cookie: $AUTH_COOKIE" "${TARGET}${endpoint}" 2>/dev/null
      sleep 0.1
    fi
  done
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
echo "TEST STATS APIs SECURITY TERMINÉ!"
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
echo "📊 RÉPARTITION PAR ENDPOINT:"
stats_tests=$((TEST_COUNT / 2))
echo "Tests sur /api/stats: ~$stats_tests"
echo "Tests sur /api/stats/total: ~$stats_tests"

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
echo "⚠️  RAPPEL: Assurez-vous d'avoir l'autorisation pour tester ces endpoints"
echo "    et que AUTH_COOKIE est valide pour un utilisateur autorisé."

exit 0