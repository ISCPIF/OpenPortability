#!/bin/bash

log_file="/home/ubuntu/cleanup/cleanup.log"

echo "$(date) - Début du nettoyage" >> $log_file

while true; do
   COUNT=$(docker exec supabase_db_goodbyex psql -U postgres -t -c "
       SELECT COUNT(*) FROM public.targets t
       WHERE NOT EXISTS (
           SELECT 1 FROM public.sources_targets st
           WHERE st.target_twitter_id = t.twitter_id
       );"
   )
   echo "$(date) - Comptage : $COUNT targets à supprimer" >> $log_file
   
   if [ "$COUNT" -eq "0" ]; then
       echo "$(date) - Terminé - Plus de targets à supprimer" >> $log_file
       break
   fi
   
   echo "$(date) - Début suppression batch de 1000" >> $log_file
   docker exec supabase_db_goodbyex psql -U postgres -c "
       DELETE FROM public.targets
       WHERE twitter_id IN (
           SELECT t.twitter_id
           FROM public.targets t
           WHERE NOT EXISTS (
               SELECT 1 FROM public.sources_targets st
               WHERE st.target_twitter_id = t.twitter_id
           )
           LIMIT 1000
       );" >> $log_file 2>&1
       
   echo "$(date) - Fin batch - $COUNT restants" >> $log_file
   sleep 1
done

echo "$(date) - Script terminé" >> $log_file
