#!/bin/bash

# Script de test de sécurité pour l'endpoint d'authentification Bluesky
# Usage: ./test-bluesky-auth.sh
# Tests des injections SQL, XSS, NoSQL, et autres attaques

TARGET="https://app.beta.v2.helloquitx.com"
ENDPOINT="/api/auth/bluesky"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="bluesky_auth_security_test_${TIMESTAMP}.txt"
FAILED_TESTS=()
FAILED_DETAILS=()
TEST_COUNT=0
RESULTS_SUMMARY=()

echo "=== TEST DE SÉCURITÉ DE L'API D'AUTHENTIFICATION BLUESKY ===" | tee "$OUTPUT_FILE"
echo "Date: $(date)" | tee -a "$OUTPUT_FILE"
echo "Target: $TARGET$ENDPOINT" | tee -a "$OUTPUT_FILE"
echo "Note: Tests sur endpoint d'authentification - Attention aux tentatives de brute force!" | tee -a "$OUTPUT_FILE"
echo

# Note: Ce script ne nécessite pas d'authentification car il teste l'endpoint de login
# Mais on peut optionnellement utiliser des headers spécifiques si nécessaire
if [ -n "$TEST_HEADERS" ]; then
  echo "Headers de test personnalisés détectés dans la variable d'environnement." | tee -a "$OUTPUT_FILE"
fi

# Fonction pour exécuter un test
run_test() {
  local payload="$1"
  local description="$2"
  local expected="$3"
  
  # Incrémenter le compteur de test
  TEST_COUNT=$((TEST_COUNT + 1))
  
  # Enregistrer les détails du test dans le fichier de log
  echo "----------------------------------------" >> "$OUTPUT_FILE"
  echo "Test #$TEST_COUNT: $description" >> "$OUTPUT_FILE"
  echo "Payload: $payload" >> "$OUTPUT_FILE"
  
  # Exécuter la requête avec timeout - EXACTEMENT comme l'original
  local response
  if [ -n "$TEST_HEADERS" ]; then
    response=$(curl -s -m 10 -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
      -H "Content-Type: application/json" \
      -H "User-Agent: SecurityTest/1.0" \
      -H "$TEST_HEADERS" \
      -d "$payload" \
      -X POST "${TARGET}${ENDPOINT}" 2>/dev/null)
  else
    response=$(curl -s -m 10 -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
      -H "Content-Type: application/json" \
      -H "User-Agent: SecurityTest/1.0" \
      -d "$payload" \
      -X POST "${TARGET}${ENDPOINT}" 2>/dev/null)
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
  
  # Analyser la réponse selon la logique ORIGINALE
  local result_emoji=""
  local result_text=""
  local test_passed=false
  
  if [ "$http_code" = "200" ]; then
    if echo "$content" | grep -q '"success":true'; then
      result_emoji="🚨"
      result_text="AUTHENTIFICATION RÉUSSIE - VULNÉRABILITÉ CRITIQUE!"
    elif echo "$content" | grep -q '"success":false' && echo "$content" | grep -q '"error":"Invalid identifier or password"'; then
      result_emoji="⚠️"
      result_text="VALIDATION NON EFFECTIVE - PAYLOAD TRAITÉ COMME NORMAL!"
    elif echo "$content" | grep -q '"success":false'; then
      result_emoji="✅"
      result_text="AUTHENTIFICATION ÉCHOUÉE - NORMAL"
      test_passed=true
    else
      result_emoji="❓"
      result_text="RÉPONSE AMBIGUË - À ANALYSER"
    fi
  elif [ "$http_code" = "400" ]; then
    result_emoji="✅"
    result_text="BAD REQUEST - VALIDATION FONCTIONNELLE"
    test_passed=true
  elif [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
    result_emoji="✅"
    result_text="NON AUTORISÉ - SÉCURITÉ FONCTIONNELLE"
    test_passed=true
  elif [ "$http_code" = "422" ]; then
    result_emoji="✅"
    result_text="VALIDATION ÉCHOUÉE - SÉCURITÉ FONCTIONNELLE"
    test_passed=true
  elif [ "$http_code" = "500" ]; then
    result_emoji="🚨"
    result_text="ERREUR SERVEUR - POTENTIELLEMENT VULNÉRABLE!"
  elif [ "$http_code" = "404" ]; then
    result_emoji="❌"
    result_text="ENDPOINT NON TROUVÉ"
  elif [ "$http_code" = "429" ]; then
    result_emoji="⚡"
    result_text="LIMITE DE TAUX - PROTECTION ACTIVE"
    test_passed=true
  elif [ -z "$http_code" ]; then
    result_emoji="❌"
    result_text="AUCUNE RÉPONSE - PROBLÈME DE CONNECTIVITÉ"
  else
    result_emoji="⚠️"
    result_text="CODE INATTENDU $http_code"
  fi
  
  echo "$result_emoji RÉSULTAT: $result_text" >> "$OUTPUT_FILE"
  
  # Ajouter au résumé
  RESULTS_SUMMARY+=("$TEST_COUNT.$result_emoji")
  
  # Affichage console - COMPORTEMENT ORIGINAL : tous les emojis s'affichent
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
• Méthode: POST
• URL: $TARGET$ENDPOINT
• Headers personnalisés: $([ -n "$TEST_HEADERS" ] && echo "true" || echo "false")
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
  
  # Pause pour éviter le rate limiting
  sleep 1
}

# Test de connectivité de base
echo "[0] Test de connectivité de base..." | tee -a "$OUTPUT_FILE"
run_test '{"identifier":"test@example.com","password":"testpassword"}' "Test de connectivité avec credentials factices" "Devrait rejeter l'authentification"

# Tests d'injection SQL dans l'identifier
echo "[1] Tests d'injection SQL dans l'identifier..." | tee -a "$OUTPUT_FILE"

sql_identifier_payloads=(
  '{"identifier":"admin'\'' OR '\''1'\''='\''1'\'' --","password":"anything"}'
  '{"identifier":"admin'\'' OR 1=1 --","password":"anything"}'
  '{"identifier":"admin'\'' UNION SELECT * FROM users --","password":"anything"}'
  '{"identifier":"admin'\''; DROP TABLE users; --","password":"anything"}'
  '{"identifier":"admin'\'' OR '\''x'\''='\''x","password":"anything"}'
  '{"identifier":"'\'' OR 1=1#","password":"anything"}'
  '{"identifier":"admin\" OR \"1\"=\"1\" --","password":"anything"}'
  '{"identifier":"admin\"; DROP TABLE users; --","password":"anything"}'
)

sql_identifier_descriptions=(
  "Injection SQL classique avec OR 1=1"
  "Injection SQL simple avec commentaire"
  "Injection SQL avec UNION SELECT"
  "Injection SQL avec DROP TABLE"
  "Injection SQL avec égalité toujours vraie"
  "Injection SQL avec commentaire MySQL"
  "Injection SQL avec guillemets doubles"
  "Injection SQL destructive avec guillemets doubles"
)

for i in "${!sql_identifier_payloads[@]}"; do
  run_test "${sql_identifier_payloads[$i]}" "${sql_identifier_descriptions[$i]}" "Devrait être bloqué"
done

# Tests d'injection SQL dans le password
echo "[2] Tests d'injection SQL dans le password..." | tee -a "$OUTPUT_FILE"

sql_password_payloads=(
  '{"identifier":"admin@example.com","password":"anything'\'' OR '\''1'\''='\''1'\'' --"}'
  '{"identifier":"admin@example.com","password":"anything'\'' OR 1=1 --"}'
  '{"identifier":"admin@example.com","password":"anything'\'' UNION SELECT password FROM users WHERE username='\''admin'\'' --"}'
  '{"identifier":"admin@example.com","password":"\" OR \"1\"=\"1\" --"}'
)

sql_password_descriptions=(
  "Injection SQL dans password avec OR 1=1"
  "Injection SQL dans password simple"
  "Injection SQL dans password avec UNION"
  "Injection SQL dans password avec guillemets doubles"
)

for i in "${!sql_password_payloads[@]}"; do
  run_test "${sql_password_payloads[$i]}" "${sql_password_descriptions[$i]}" "Devrait être bloqué"
done

# Tests d'injection NoSQL (MongoDB, etc.)
echo "[3] Tests d'injection NoSQL..." | tee -a "$OUTPUT_FILE"

nosql_payloads=(
  '{"identifier":{"$ne":null},"password":{"$ne":null}}'
  '{"identifier":{"$gt":""},"password":{"$gt":""}}'
  '{"identifier":{"$regex":".*"},"password":{"$regex":".*"}}'
  '{"identifier":"admin","password":{"$ne":"wrongpassword"}}'
  '{"identifier":{"$where":"return true"},"password":"anything"}'
  '{"identifier":"admin","password":{"$exists":true}}'
)

nosql_descriptions=(
  "Injection NoSQL avec \$ne (not equal)"
  "Injection NoSQL avec \$gt (greater than)"
  "Injection NoSQL avec \$regex"
  "Injection NoSQL bypass password avec \$ne"
  "Injection NoSQL avec \$where"
  "Injection NoSQL avec \$exists"
)

for i in "${!nosql_payloads[@]}"; do
  run_test "${nosql_payloads[$i]}" "${nosql_descriptions[$i]}" "Devrait être bloqué"
done

# Tests XSS dans les champs
echo "[4] Tests d'attaques XSS..." | tee -a "$OUTPUT_FILE"

xss_payloads=(
  '{"identifier":"<script>alert(1)</script>","password":"test"}'
  '{"identifier":"javascript:alert(1)","password":"test"}'
  '{"identifier":"<img src=x onerror=alert(1)>","password":"test"}'
  '{"identifier":"<svg onload=alert(1)>","password":"test"}'
  '{"identifier":"test@example.com","password":"<script>alert(1)</script>"}'
  '{"identifier":"test@example.com","password":"javascript:alert(1)"}'
)

xss_descriptions=(
  "XSS avec balise script dans identifier"
  "XSS avec protocole javascript dans identifier"
  "XSS avec balise img dans identifier"
  "XSS avec balise svg dans identifier"
  "XSS avec balise script dans password"
  "XSS avec protocole javascript dans password"
)

for i in "${!xss_payloads[@]}"; do
  run_test "${xss_payloads[$i]}" "${xss_descriptions[$i]}" "Devrait être bloqué/échappé"
done

# Tests de pollution de prototype
echo "[5] Tests de pollution de prototype..." | tee -a "$OUTPUT_FILE"

prototype_payloads=(
  '{"__proto__":{"admin":true},"identifier":"test@example.com","password":"test"}'
  '{"constructor":{"prototype":{"admin":true}},"identifier":"test@example.com","password":"test"}'
  '{"identifier":"test@example.com","password":"test","__proto__":{"isAdmin":true}}'
  '{"prototype":{"admin":true},"identifier":"test@example.com","password":"test"}'
)

prototype_descriptions=(
  "Pollution de prototype avec __proto__"
  "Pollution de prototype avec constructor"
  "Pollution de prototype dans les données utilisateur"
  "Pollution de prototype avec prototype"
)

for i in "${!prototype_payloads[@]}"; do
  run_test "${prototype_payloads[$i]}" "${prototype_descriptions[$i]}" "Devrait être bloqué"
done

# Tests de validation des types de données
echo "[6] Tests de validation des types..." | tee -a "$OUTPUT_FILE"

type_payloads=(
  '{"identifier":123,"password":"test"}'
  '{"identifier":"test@example.com","password":123}'
  '{"identifier":null,"password":"test"}'
  '{"identifier":"test@example.com","password":null}'
  '{"identifier":true,"password":"test"}'
  '{"identifier":"test@example.com","password":false}'
  '{"identifier":[],"password":"test"}'
  '{"identifier":"test@example.com","password":{}}'
)

type_descriptions=(
  "Identifier en tant que nombre"
  "Password en tant que nombre"
  "Identifier null"
  "Password null"
  "Identifier en tant que boolean"
  "Password en tant que boolean"
  "Identifier en tant qu'array"
  "Password en tant qu'objet"
)

for i in "${!type_payloads[@]}"; do
  run_test "${type_payloads[$i]}" "${type_descriptions[$i]}" "Devrait être rejeté par validation"
done

# Tests de champs manquants
echo "[7] Tests de champs manquants..." | tee -a "$OUTPUT_FILE"

missing_field_payloads=(
  '{}'
  '{"identifier":"test@example.com"}'
  '{"password":"testpassword"}'
  '{"identifier":""}'
  '{"password":""}'
  '{"identifier":"","password":""}'
)

missing_field_descriptions=(
  "Aucun champ"
  "Seulement identifier"
  "Seulement password"
  "Identifier vide"
  "Password vide"
  "Les deux champs vides"
)

for i in "${!missing_field_payloads[@]}"; do
  run_test "${missing_field_payloads[$i]}" "${missing_field_descriptions[$i]}" "Devrait être rejeté"
done

# Tests de format d'email invalide
echo "[8] Tests de formats d'email invalides..." | tee -a "$OUTPUT_FILE"

email_format_payloads=(
  '{"identifier":"notanemail","password":"test"}'
  '{"identifier":"@example.com","password":"test"}'
  '{"identifier":"test@","password":"test"}'
  '{"identifier":"test@@example.com","password":"test"}'
  '{"identifier":"test@example","password":"test"}'
  '{"identifier":"test@.com","password":"test"}'
  '{"identifier":"test space@example.com","password":"test"}'
)

email_format_descriptions=(
  "Email sans @"
  "Email commençant par @"
  "Email se terminant par @"
  "Email avec double @"
  "Email sans TLD"
  "Email avec point avant domaine"
  "Email avec espace"
)

for i in "${!email_format_payloads[@]}"; do
  run_test "${email_format_payloads[$i]}" "${email_format_descriptions[$i]}" "Devrait être rejeté par validation email"
done

# Tests de longueur excessive
echo "[9] Tests de longueur excessive..." | tee -a "$OUTPUT_FILE"

long_string_1000=$(printf 'a%.0s' {1..1000})
long_string_10000=$(printf 'b%.0s' {1..10000})

length_payloads=(
  "{\"identifier\":\"${long_string_1000}@example.com\",\"password\":\"test\"}"
  "{\"identifier\":\"test@example.com\",\"password\":\"${long_string_1000}\"}"
  "{\"identifier\":\"${long_string_10000}@example.com\",\"password\":\"test\"}"
  "{\"identifier\":\"test@example.com\",\"password\":\"${long_string_10000}\"}"
)

length_descriptions=(
  "Identifier très long (1000 chars)"
  "Password très long (1000 chars)"
  "Identifier extrêmement long (10000 chars)"
  "Password extrêmement long (10000 chars)"
)

for i in "${!length_payloads[@]}"; do
  run_test "${length_payloads[$i]}" "${length_descriptions[$i]}" "Devrait être rejeté ou tronqué"
done

# Test avec des credentials potentiellement valides (à éviter en production!)
echo "[10] Tests avec formats valides (credentials factices)..." | tee -a "$OUTPUT_FILE"

valid_payloads=(
  '{"identifier":"test@example.com","password":"ValidPassword123"}'
  '{"identifier":"user@domain.com","password":"AnotherPassword456"}'
  '{"identifier":"admin@test.com","password":"AdminPass789"}'
)

valid_descriptions=(
  "Format valide - test@example.com"
  "Format valide - user@domain.com"
  "Format valide - admin (attention!)"
)

for i in "${!valid_payloads[@]}"; do
  run_test "${valid_payloads[$i]}" "${valid_descriptions[$i]}" "Devrait échouer l'authentification mais être bien formaté"
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
echo "TEST DE SÉCURITÉ AUTHENTIFICATION TERMINÉ!"
echo "=============================================="
echo "Rapport complet sauvegardé: $OUTPUT_FILE"
echo
echo "📊 RÉSUMÉ RAPIDE DES TESTS:"
echo "$(printf '%s ' "${RESULTS_SUMMARY[@]}")"
echo
echo "🔍 LÉGENDE:"
echo "✅ = Sécurisé (validation fonctionnelle)"
echo "⚠️ = Attention (validation non effective)"  
echo "🚨 = Vulnérabilité critique"
echo "❌ = Erreur technique"
echo "❓ = À analyser manuellement"
echo "⚡ = Rate limiting actif"
echo
echo "⚠️  ATTENTION: Ce script teste des vulnérabilités sur un endpoint d'authentification."
echo "    Assurez-vous d'avoir l'autorisation et surveillez les logs pour éviter"
echo "    les blocages de sécurité ou les alertes de brute force."

# Compter les résultats
SECURE_COUNT=$(printf '%s\n' "${RESULTS_SUMMARY[@]}" | grep -c "✅")
WARNING_COUNT=$(printf '%s\n' "${RESULTS_SUMMARY[@]}" | grep -c "⚠️")
CRITICAL_COUNT=$(printf '%s\n' "${RESULTS_SUMMARY[@]}" | grep -c "🚨")
ERROR_COUNT=$(printf '%s\n' "${RESULTS_SUMMARY[@]}" | grep -c "❌")
UNKNOWN_COUNT=$(printf '%s\n' "${RESULTS_SUMMARY[@]}" | grep -c "❓")

echo
echo "📈 STATISTIQUES:"
echo "Tests sécurisés: $SECURE_COUNT/$TEST_COUNT"
echo "Tests avec attention: $WARNING_COUNT/$TEST_COUNT"
echo "Vulnérabilités critiques: $CRITICAL_COUNT/$TEST_COUNT"
echo "Erreurs techniques: $ERROR_COUNT/$TEST_COUNT"
echo "Tests ambigus: $UNKNOWN_COUNT/$TEST_COUNT"

if [ "$CRITICAL_COUNT" -gt 0 ]; then
  echo
  echo "🚨 ALERTE: $CRITICAL_COUNT vulnérabilité(s) critique(s) détectée(s)!"
elif [ "$WARNING_COUNT" -gt 0 ]; then
  echo
  echo "⚠️ ATTENTION: $WARNING_COUNT test(s) où la validation n'est pas effective!"
else
  echo
  echo "✅ Aucune vulnérabilité critique détectée dans ces tests."
fi

exit 0