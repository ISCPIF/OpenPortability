#!/bin/bash

# Script de test pour l'endpoint /api/migrate/send_follow
# Usage: ./send_follow_test.sh
# Requires: export AUTH_COOKIE='next-auth.session-token=your_cookie_value'

TARGET="http://localhost:3000"
ENDPOINT="/api/migrate/send_follow"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="send_follow_test_${TIMESTAMP}.txt"

echo "=== SEND_FOLLOW ENDPOINT TESTING ===" | tee $OUTPUT_FILE
echo "Date: $(date)" | tee -a $OUTPUT_FILE
echo "Target: $TARGET$ENDPOINT" | tee -a $OUTPUT_FILE
echo "Format: EMOJI / TEST# / HTTP_CODE / ERROR / DETAILS" | tee -a $OUTPUT_FILE
echo

# Check if AUTH_COOKIE environment variable is set
if [ -z "$AUTH_COOKIE" ]; then
    echo "❌ ERROR: AUTH_COOKIE environment variable not set" | tee -a $OUTPUT_FILE
    echo "Usage: export AUTH_COOKIE='next-auth.session-token=your_cookie_value'" | tee -a $OUTPUT_FILE
    exit 1
else
    echo "[✓] Authentication cookie found in environment variable" | tee -a $OUTPUT_FILE
fi

# Check if target is accessible
echo "[0] Checking if $TARGET$ENDPOINT is accessible..." | tee -a $OUTPUT_FILE
response=$(curl -s -w "HTTP:%{http_code}" $TARGET$ENDPOINT 2>/dev/null)
http_code=$(echo "$response" | tail -1 | grep -o "HTTP:[0-9]*" | cut -d: -f2)
echo "Connectivity test - HTTP Code: $http_code" | tee -a $OUTPUT_FILE
echo

echo "[1] Testing VALID PAYLOADS..." | tee -a $OUTPUT_FILE
echo "[2] Testing INVALID PAYLOADS..." | tee -a $OUTPUT_FILE  
echo "[3] Testing SECURITY PAYLOADS..." | tee -a $OUTPUT_FILE

# Define test payloads
declare -a all_payloads
declare -a payload_descriptions

# Valid payloads (should succeed)
all_payloads[0]='{
  "accounts": [
    {
      "target_twitter_id": "123456789",
      "bluesky_handle": "user1.bsky.social",
      "mastodon_username": "user1",
      "mastodon_instance": "mastodon.social",
      "mastodon_id": "123",
      "has_follow_bluesky": false,
      "has_follow_mastodon": false
    }
  ]
}'
payload_descriptions[0]="Valid MatchingTarget payload"

all_payloads[1]='{
  "accounts": [
    {
      "source_twitter_id": "987654321",
      "bluesky_handle": "user2.bsky.social",
      "mastodon_username": "user2",
      "mastodon_instance": "mastodon.social",
      "mastodon_id": "456",
      "has_been_followed_on_bluesky": false,
      "has_been_followed_on_mastodon": false
    }
  ]
}'
payload_descriptions[1]="Valid MatchedFollower payload"

all_payloads[2]='{
  "accounts": [
    {
      "target_twitter_id": "123456789",
      "bluesky_handle": "user1.bsky.social",
      "mastodon_username": "user1",
      "mastodon_instance": "mastodon.social",
      "mastodon_id": "123",
      "has_follow_bluesky": false,
      "has_follow_mastodon": false
    },
    {
      "source_twitter_id": "987654321",
      "bluesky_handle": "user2.bsky.social",
      "mastodon_username": "user2",
      "mastodon_instance": "mastodon.social",
      "mastodon_id": "456",
      "has_been_followed_on_bluesky": false,
      "has_been_followed_on_mastodon": false
    }
  ]
}'
payload_descriptions[2]="Mixed MatchingTarget and MatchedFollower"

# Invalid structure payloads (should fail)
all_payloads[3]='{
  "accounts": "not_an_array"
}'
payload_descriptions[3]="Invalid - accounts not array"

all_payloads[4]='{
  "accounts": [
    {
      "invalid_field": "value",
      "bluesky_handle": "user.bsky.social"
    }
  ]
}'
payload_descriptions[4]="Invalid - wrong structure"

all_payloads[5]='{
  "accounts": []
}'
payload_descriptions[5]="Invalid - empty accounts array"

all_payloads[6]='{
  "other_field": "value"
}'
payload_descriptions[6]="Invalid - missing accounts field"

# Security test payloads (should be blocked)
all_payloads[7]='{
  "accounts": [
    {
      "target_twitter_id": "123456789",
      "bluesky_handle": "user'"'"' OR 1=1--",
      "mastodon_username": "user1",
      "mastodon_instance": "mastodon.social",
      "mastodon_id": "123",
      "has_follow_bluesky": false,
      "has_follow_mastodon": false
    }
  ]
}'
payload_descriptions[7]="SQL Injection in bluesky_handle"

all_payloads[8]='{
  "accounts": [
    {
      "target_twitter_id": "123456789",
      "bluesky_handle": "user1.bsky.social",
      "mastodon_username": "<script>alert(\"XSS\")</script>",
      "mastodon_instance": "mastodon.social",
      "mastodon_id": "123",
      "has_follow_bluesky": false,
      "has_follow_mastodon": false
    }
  ]
}'
payload_descriptions[8]="XSS in mastodon_username"

all_payloads[9]='{
  "accounts": [
    {
      "target_twitter_id": "'"'"'UNION SELECT * FROM users--",
      "bluesky_handle": "user1.bsky.social",
      "mastodon_username": "user1",
      "mastodon_instance": "mastodon.social",
      "mastodon_id": "123",
      "has_follow_bluesky": false,
      "has_follow_mastodon": false
    }
  ]
}'
payload_descriptions[9]="SQL Injection in target_twitter_id"

all_payloads[10]='{
  "accounts": [
    {
      "source_twitter_id": "987654321",
      "bluesky_handle": "user2.bsky.social",
      "mastodon_username": "user2",
      "mastodon_instance": "<img src=x onerror=alert(1)>",
      "mastodon_id": "456",
      "has_been_followed_on_bluesky": false,
      "has_been_followed_on_mastodon": false
    }
  ]
}'
payload_descriptions[10]="XSS in mastodon_instance"

# Execute tests
total_payloads=${#all_payloads[@]}
successful_tests=0
failed_tests=0
blocked_tests=0
server_errors=0
results_summary=()

echo "Testing $total_payloads total payloads..." | tee -a $OUTPUT_FILE
echo "========================================" | tee -a $OUTPUT_FILE

for i in "${!all_payloads[@]}"; do
    payload="${all_payloads[$i]}"
    payload_num=$((i+1))
    description="${payload_descriptions[$i]}"

    # Measure response time and capture response properly
    start_time=$(date +%s.%N)
    
    # Use temporary files to capture response body separately from headers
    temp_response="/tmp/curl_response_$$"
    temp_headers="/tmp/curl_headers_$$"
    
    http_code=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "User-Agent: Mozilla/5.0 (compatible; APITest/1.0)" \
        -H "Cookie: $AUTH_COOKIE" \
        -d "$payload" \
        -w "%{http_code}" \
        -o "$temp_response" \
        -D "$temp_headers" \
        -m 10 \
        $TARGET$ENDPOINT 2>/dev/null)
    
    end_time=$(date +%s.%N)
    response_time=$(echo "$end_time - $start_time" | bc)
    
    # Read response content
    content=""
    if [ -f "$temp_response" ]; then
        content=$(cat "$temp_response")
    fi
    
    # Clean up temp files
    rm -f "$temp_response" "$temp_headers"

    # Debug info
    echo "DEBUG Test $payload_num ($description) - HTTP: $http_code, Content: '$content'" >> "${OUTPUT_FILE}.debug"

    # Extract error and details from JSON response
    error_msg=""
    details_msg=""
    
    # Check if we have content
    if [ -z "$content" ]; then
        error_msg="(empty response)"
    else
        # Try to extract error field
        if echo "$content" | grep -q '"error"'; then
            error_msg=$(echo "$content" | sed -n 's/.*"error" *: *"\([^"]*\)".*/\1/p')
        fi
        
        # Try to extract details array
        if echo "$content" | grep -q '"details"'; then
            details_raw=$(echo "$content" | sed -n 's/.*"details" *: *\[\([^]]*\)\].*/\1/p')
            if [ -n "$details_raw" ]; then
                details_msg=$(echo "$details_raw" | sed 's/"//g' | sed 's/, */ | /g')
            fi
        fi
        
        # Try to extract message field (for other error types)
        if [ -z "$error_msg" ] && echo "$content" | grep -q '"message"'; then
            error_msg=$(echo "$content" | sed -n 's/.*"message" *: *"\([^"]*\)".*/\1/p')
        fi
        
        # If still no structured data, show raw content
        if [ -z "$error_msg" ] && [ -z "$details_msg" ]; then
            error_msg=$(echo "$content" | tr -d '\n\r' | cut -c1-80)
        fi
    fi

    # Determine emoji based on test type and response
    emoji=""
    expected_behavior=""
    
    if [ $i -le 2 ]; then
        # Valid payloads (tests 1-3) - should succeed (HTTP 200-299)
        expected_behavior="SUCCESS"
        if [[ $http_code -ge 200 ]] && [[ $http_code -lt 300 ]]; then
            emoji="✅"
            successful_tests=$((successful_tests + 1))
        elif [[ $http_code -ge 400 ]] && [[ $http_code -lt 500 ]]; then
            emoji="❌"  # Should have succeeded but got client error
            failed_tests=$((failed_tests + 1))
        elif [[ $http_code -ge 500 ]]; then
            emoji="🚨"  # Server error
            server_errors=$((server_errors + 1))
        else
            emoji="❓"
        fi
    elif [ $i -le 6 ]; then
        # Invalid structure payloads (tests 4-7) - should fail (HTTP 400)
        expected_behavior="VALIDATION_ERROR"
        if [[ $http_code -eq 400 ]]; then
            emoji="✅"  # Correctly rejected
            blocked_tests=$((blocked_tests + 1))
        elif [[ $http_code -ge 200 ]] && [[ $http_code -lt 300 ]]; then
            emoji="🚨"  # Should have failed but succeeded
            failed_tests=$((failed_tests + 1))
        elif [[ $http_code -ge 500 ]]; then
            emoji="⚠️"   # Server error on invalid input
            server_errors=$((server_errors + 1))
        else
            emoji="❓"
        fi
    else
        # Security payloads (tests 8+) - should be blocked (HTTP 400)
        expected_behavior="SECURITY_BLOCK"
        if [[ $http_code -eq 400 ]] && echo "$content" | grep -qi "security\|validation\|injection\|xss\|dangerous"; then
            emoji="✅"  # Correctly blocked with security message
            blocked_tests=$((blocked_tests + 1))
        elif [[ $http_code -eq 400 ]]; then
            emoji="⚠️"   # Blocked but unclear if for security reasons
            blocked_tests=$((blocked_tests + 1))
        elif [[ $http_code -ge 200 ]] && [[ $http_code -lt 300 ]]; then
            emoji="🚨"  # Security vulnerability - accepted malicious input
            failed_tests=$((failed_tests + 1))
        elif [[ $http_code -ge 500 ]]; then
            emoji="🚨"  # Server error might indicate injection success
            server_errors=$((server_errors + 1))
        else
            emoji="❓"
        fi
    fi

    # Format output based on available data
    if [ -n "$error_msg" ] && [ -n "$details_msg" ]; then
        echo "$emoji / $payload_num / $http_code / $error_msg / $details_msg" | tee -a $OUTPUT_FILE
    elif [ -n "$error_msg" ]; then
        echo "$emoji / $payload_num / $http_code / $error_msg" | tee -a $OUTPUT_FILE
    else
        echo "$emoji / $payload_num / $http_code / (no response data)" | tee -a $OUTPUT_FILE
    fi
    
    results_summary+=("$payload_num.$emoji")

    # Add delay to avoid rate limiting
    sleep 0.5
done

echo "========================================" | tee -a $OUTPUT_FILE
echo
echo "📊 RÉSUMÉ RAPIDE DES TESTS:" | tee -a $OUTPUT_FILE
echo "$(printf '%s ' "${results_summary[@]}")" | tee -a $OUTPUT_FILE
echo | tee -a $OUTPUT_FILE

echo "🔍 LÉGENDE:" | tee -a $OUTPUT_FILE
echo "✅ = Comportement attendu (validation fonctionnelle)" | tee -a $OUTPUT_FILE
echo "⚠️ = Attention (comportement inattendu)" | tee -a $OUTPUT_FILE
echo "🚨 = Problème critique (vulnérabilité ou échec)" | tee -a $OUTPUT_FILE
echo "❌ = Erreur (comportement incorrect)" | tee -a $OUTPUT_FILE
echo "❓ = À analyser manuellement" | tee -a $OUTPUT_FILE
echo | tee -a $OUTPUT_FILE

echo "📈 STATISTIQUES:" | tee -a $OUTPUT_FILE
echo "- Total payloads testés: $total_payloads" | tee -a $OUTPUT_FILE
echo "- Tests réussis (attendus): $successful_tests" | tee -a $OUTPUT_FILE
echo "- Validations bloquées: $blocked_tests" | tee -a $OUTPUT_FILE
echo "- Échecs critiques: $failed_tests" | tee -a $OUTPUT_FILE
echo "- Erreurs serveur: $server_errors" | tee -a $OUTPUT_FILE
echo "📋 Rapport sauvegardé: $OUTPUT_FILE" | tee -a $OUTPUT_FILE

echo "📊 DÉTAIL PAR CATÉGORIE:" | tee -a $OUTPUT_FILE
echo "- Payloads valides (1-3): 3 tests" | tee -a $OUTPUT_FILE
echo "- Payloads structure invalide (4-7): 4 tests" | tee -a $OUTPUT_FILE
echo "- Payloads de sécurité (8-11): 4 tests" | tee -a $OUTPUT_FILE

# Security assessment
critical_issues=$((failed_tests))
if [ "$critical_issues" -gt 0 ]; then
    echo | tee -a $OUTPUT_FILE
    echo "🚨 ALERTE: $critical_issues problème(s) critique(s) détecté(s)!" | tee -a $OUTPUT_FILE
    echo "   → Vérifiez les tests marqués 🚨" | tee -a $OUTPUT_FILE
    echo "   → Possibles vulnérabilités de sécurité" | tee -a $OUTPUT_FILE
else
    echo | tee -a $OUTPUT_FILE
    echo "✅ Aucun problème critique détecté dans ces tests." | tee -a $OUTPUT_FILE
fi

echo "=============================================="