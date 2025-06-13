#!/bin/bash

# Script pour exécuter tous les tests API d'OpenPortability avec affichage en temps réel
# Créé le $(date +"%Y-%m-%d")

# Définition des couleurs pour une meilleure lisibilité
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Création d'un dossier pour les logs avec horodatage
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_DIR="test_results_${TIMESTAMP}"
mkdir -p $LOG_DIR

# Fichier de résumé
SUMMARY_FILE="${LOG_DIR}/summary.txt"

# Liste des scripts de test à exécuter
TEST_SCRIPTS=(
    "test_api_auth_bluesky.sh"
    "test_xss.sh"
    "test-automatic-reconnect.sh"
    "test-consent.sh"
    "test-send-follow.sh"
    "test-share.sh"
    "test-sql.sh"
    "test-stats.sh"
    "test-update-stats.sh"
    "test-upload-files.sh"
    "test-user-language.sh"
)

# Fonction pour afficher un séparateur avec couleur
print_separator() {
    local color=$1
    local char=${2:-"="}
    local length=${3:-60}
    echo -e "${color}$(printf "%*s" $length | tr ' ' $char)${NC}"
}

# Fonction pour afficher un header de test
print_test_header() {
    local script=$1
    local index=$2
    local total=$3
    
    echo
    print_separator $BLUE "="
    echo -e "${YELLOW}[$index/$total] Exécution de: ${CYAN}$script${NC}"
    echo -e "${PURPLE}Démarré à: ${NC}$(date +"%H:%M:%S")"
    print_separator $BLUE "="
}

# Fonction pour afficher le footer du test
print_test_footer() {
    local script=$1
    local exit_code=$2
    local log_file=$3
    local duration=$4
    
    print_separator $BLUE "-"
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✅ $script terminé avec succès${NC} (durée: ${duration}s)"
    else
        echo -e "${RED}❌ $script terminé avec des erreurs${NC} (code: $exit_code, durée: ${duration}s)"
    fi
    echo -e "${CYAN}📁 Log complet sauvegardé: $log_file${NC}"
    print_separator $BLUE "="
    echo
}

# Fonction pour exécuter un test avec affichage en temps réel
run_test() {
    local script=$1
    local index=$2
    local total=$3
    local log_file="${LOG_DIR}/$(basename $script .sh).log"
    
    print_test_header $script $index $total
    
    # Vérifier si le script existe et est exécutable
    if [ ! -x "$script" ]; then
        echo -e "${RED}ERREUR: $script n'existe pas ou n'est pas exécutable${NC}"
        echo "❌ $script - ÉCHEC (script non exécutable)" >> $SUMMARY_FILE
        echo -e "${RED}ERREUR: $script n'existe pas ou n'est pas exécutable${NC}" > $log_file
        print_test_footer $script 1 $log_file "0"
        return 1
    fi
    
    # Mesurer le temps d'exécution
    start_time=$(date +%s)
    
    # Exécuter le script avec tee pour affichage temps réel ET sauvegarde
    # Utiliser un pipe nommé pour capturer le code de sortie
    PIPE=$(mktemp -u)
    mkfifo $PIPE
    
    # Lancer le script en arrière-plan et rediriger vers le pipe
    (./$script 2>&1; echo $? > ${PIPE}.exit) | tee $log_file &
    script_pid=$!
    
    # Attendre que le script se termine
    wait $script_pid
    
    # Récupérer le code de sortie
    exit_code=$(cat ${PIPE}.exit 2>/dev/null || echo "1")
    
    # Nettoyage
    rm -f $PIPE ${PIPE}.exit
    
    # Calculer la durée
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    # Enregistrer dans le résumé
    if [ $exit_code -eq 0 ]; then
        echo "✅ $script - SUCCÈS (${duration}s)" >> $SUMMARY_FILE
    else
        echo "❌ $script - ÉCHEC (code: $exit_code, ${duration}s)" >> $SUMMARY_FILE
    fi
    
    print_test_footer $script $exit_code $log_file $duration
    
    return $exit_code
}

# Fonction pour afficher le résumé en temps réel
print_running_summary() {
    local current=$1
    local total=$2
    local successful=$3
    local failed=$4
    
    echo -e "\n${CYAN}📊 PROGRESSION: [$current/$total] - ✅ $successful réussis, ❌ $failed échoués${NC}\n"
}

# Initialisation
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 SUITE DE TESTS OPENPORTABILITY              ║${NC}"
echo -e "${GREEN}║                     Affichage temps réel                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo -e "${PURPLE}Démarré le: ${NC}$(date)"
echo -e "${CYAN}Dossier de logs: ${YELLOW}$LOG_DIR${NC}"
echo

# Initialisation du fichier de résumé
cat > $SUMMARY_FILE << EOF
RÉSUMÉ DES TESTS OPENPORTABILITY - $(date)
===========================================
Dossier de logs: $LOG_DIR

DÉTAILS DES TESTS:
EOF

# Compteurs pour le résumé
total_tests=${#TEST_SCRIPTS[@]}
successful_tests=0
failed_tests=0
current_test=0

echo -e "${GREEN}🚀 Démarrage de l'exécution de $total_tests tests...${NC}"

# Exécution de tous les tests
for script in "${TEST_SCRIPTS[@]}"; do
    ((current_test++))
    
    # Afficher la progression avant chaque test
    print_running_summary $current_test $total_tests $successful_tests $failed_tests
    
    # Exécuter le test
    run_test $script $current_test $total_tests
    test_result=$?
    
    # Mettre à jour les compteurs
    if [ $test_result -eq 0 ]; then
        ((successful_tests++))
    else
        ((failed_tests++))
    fi
    
    # Petite pause pour la lisibilité (optionnel)
    sleep 1
done

# Affichage du résumé final
echo
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                      RÉSUMÉ FINAL                           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo -e "${BLUE}Terminé le: ${NC}$(date)"
echo -e "${BLUE}Durée totale: ${NC}$(date -d@$(($(date +%s) - $(date -d"$TIMESTAMP" +%s 2>/dev/null || echo 0))) -u +%H:%M:%S 2>/dev/null || echo "N/A")"
echo
echo -e "${CYAN}📊 STATISTIQUES:${NC}"
echo -e "   Total des tests: ${YELLOW}$total_tests${NC}"
echo -e "   Tests réussis: ${GREEN}$successful_tests${NC}"
echo -e "   Tests échoués: ${RED}$failed_tests${NC}"

# Calcul du pourcentage de réussite
if [ $total_tests -gt 0 ]; then
    success_rate=$((successful_tests * 100 / total_tests))
    echo -e "   Taux de réussite: ${YELLOW}$success_rate%${NC}"
fi

echo
echo -e "${CYAN}📁 FICHIERS GÉNÉRÉS:${NC}"
echo -e "   Dossier de logs: ${YELLOW}$LOG_DIR${NC}"
echo -e "   Résumé détaillé: ${YELLOW}$SUMMARY_FILE${NC}"

# Afficher les échecs s'il y en a
if [ $failed_tests -gt 0 ]; then
    echo
    echo -e "${RED}⚠️  TESTS ÉCHOUÉS:${NC}"
    grep "❌" $SUMMARY_FILE | while read line; do
        echo -e "   ${RED}$line${NC}"
    done
    echo
    echo -e "${YELLOW}💡 Consultez les logs individuels pour plus de détails.${NC}"
fi

# Ajouter le résumé final au fichier
cat >> $SUMMARY_FILE << EOF

===========================================
RÉSUMÉ FINAL - $(date)
===========================================
Total des tests: $total_tests
Tests réussis: $successful_tests
Tests échoués: $failed_tests
Taux de réussite: $success_rate%
===========================================
EOF

# Message final avec couleur selon le résultat
if [ $failed_tests -eq 0 ]; then
    echo -e "${GREEN}🎉 Tous les tests ont réussi ! 🎉${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Certains tests ont échoué. Consultez les logs pour plus d'informations.${NC}"
    exit 1
fi
