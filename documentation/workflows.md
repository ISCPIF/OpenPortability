# Workflows Détaillés - OpenPortability

## 1. Workflow Utilisateur Principal

```mermaid
flowchart TD
    Start([👤 Utilisateur visite le site]) --> Auth{Authentifié ?}
    
    Auth -->|Non| Login[🔐 Page de connexion<br/>NextAuth + Supabase]
    Auth -->|Oui| CheckOnboard{Onboardé ?}
    
    Login --> AuthChoice{Type d'auth ?}
    AuthChoice -->|Twitter/Mastodon| OAuthProvider[🔐 OAuth Provider<br/>Twitter ou Mastodon<br/>Interface selon auth.config.ts]
    AuthChoice -->|Bluesky| BlueskyCredentials[🦋 Credentials Bluesky<br/>Handle + App Password]
    
    OAuthProvider --> OAuthProfile[📝 Récupération profil OAuth<br/>ID, username, image, instance]
    BlueskyCredentials --> BlueskyProfile[📝 Récupération profil Bluesky<br/>DID, handle, image]
    
    OAuthProfile --> UpdateUsers[🔄 Update next-auth.users<br/>Colonnes spécifiques par provider]
    BlueskyProfile --> UpdateUsers2[🔄 Update next-auth.users<br/>bluesky_id, bluesky_username, bluesky_image]
    
    UpdateUsers --> TriggerSync[⚡ Triggers automatiques<br/>sync_twitter_bluesky_users<br/>sync_twitter_mastodon_users]
    UpdateUsers2 --> TriggerSync
    
    TriggerSync --> UpdateCache[📦 Update Cache Redis<br/>Mappings automatiques]
    UpdateCache --> CheckOnboard
    
    CheckOnboard -->|Non onboardé| Dashboard[📊 Dashboard<br/>Utilisateurs sans archive<br/>ou sans 3 services]
    CheckOnboard -->|Onboardé| CheckArchiveOrTwitter{Archive ou Twitter ?}
    
    CheckArchiveOrTwitter -->|Oui| Reconnect[🔄 Page /reconnect<br/>Reconnexion automatique]
    CheckArchiveOrTwitter -->|Non| Dashboard
    
    Dashboard --> Import{Import Twitter ?}
    Import -->|Oui| Upload[📁 Upload archive Twitter<br/>.zip ou .tar.gz]
    Import -->|Non| Connect[🔗 Connecter autres comptes]
    
    Upload --> Validate[✅ Validation du fichier]
    Validate -->|Erreur| UploadError[❌ Erreur d'upload<br/>Format invalide]
    Validate -->|OK| Queue[⏳ Ajout à la file d'attente]
    
    UploadError --> Upload
    Queue --> Processing[⚙️ Traitement en cours<br/>Worker indexation]
    
    Processing --> CreateSource[📊 Création Source<br/>Archive Twitter uploadée]
    CreateSource --> ExtractNodes[🕸️ Extraction Nodes<br/>Utilisateurs de l'archive]
    ExtractNodes --> CreateTargets[🎯 Création Sources_targets<br/>Comptes suivis]
    CreateTargets --> CreateFollowers[👥 Création Sources_followers<br/>Comptes qui suivent]
    
    CreateFollowers --> Progress{Statut ?}
    Progress -->|En cours| Wait[⏱️ Attente<br/>Polling status]
    Progress -->|Terminé| Complete[✅ Import terminé]
    Progress -->|Erreur| ProcessError[❌ Erreur de traitement]
    
    Wait --> Progress
    ProcessError --> Retry{Retry ?}
    Retry -->|Oui| Queue
    Retry -->|Non| Dashboard
    
    Complete --> Reconnect
    Connect --> AddService{Ajouter service ?}
    AddService -->|Oui| AuthChoice
    AddService -->|Non| CheckArchiveOrTwitter
    
    Reconnect --> GetFollowable[🔍 get_followable_targets.sql<br/>Récupération followings<br/>avec matching]
    GetFollowable --> MatchingRepo[📊 matchingRepository.ts<br/>Traitement des données<br/>pour le front]
    MatchingRepo --> DisplayMatches[📱 Affichage des matches<br/>Interface utilisateur]
    
    DisplayMatches --> SelectFollows[👆 Sélection des comptes<br/>à suivre/reconnecter]
    SelectFollows --> SendFollow[🚀 /api/migrate/send_follow<br/>Exécution des follows<br/>Bluesky + Mastodon]
    
    SendFollow --> FollowResults[✅ Résultats des follows<br/>Succès/Échecs]
    FollowResults --> Stats[📈 Mise à jour statistiques]
    Stats --> Dashboard
    
    classDef userAction fill:#e3f2fd
    classDef systemProcess fill:#f3e5f5
    classDef decision fill:#fff3e0
    classDef error fill:#ffebee
    classDef database fill:#e8f5e8
    classDef trigger fill:#fce4ec
    classDef reconnect fill:#e8f5e8
    
    class Start,Upload,Connect,SelectFollows,DisplayMatches userAction
    class Queue,Processing,CreateSource,ExtractNodes,CreateTargets,CreateFollowers,GetFollowable,MatchingRepo,SendFollow systemProcess
    class Auth,AuthChoice,CheckOnboard,Import,Progress,Retry,AddService,CheckArchiveOrTwitter decision
    class UploadError,ProcessError error
    class UpdateUsers,UpdateUsers2,UpdateCache database
    class TriggerSync trigger
    class Reconnect,FollowResults,Stats reconnect
```

## 2. Workflow des Données (Data Pipeline)

```mermaid
flowchart LR
    subgraph "Client Phase"
        FileUpload["📁 Upload fichier Twitter<br/>zip ou tar.gz"]
        ClientUnzip["📂 Dézip côté client<br/>@zip.js/zip.js"]
        ClientValidation["✅ Validation côté client<br/>validateTwitterData"]
    end
    
    subgraph "API Phase"
        APIUpload["🚀 /api/upload/large-files<br/>Création tâche DB + Redis"]
        TempStorage["💾 Stockage /app/tmp<br/>Fichiers extraits"]
        JobCreation["📋 Création import_jobs<br/>+ Redis queue"]
    end
    
    subgraph "Worker Phase"
        WorkerConsume["⚙️ worker/src/index.ts<br/>BRPOP Redis"]
        CSVDump["📄 Dump CSV depuis stdin<br/>Tables temporaires"]
        NodesInsert["🕸️ Insertion Nodes<br/>Utilisateurs extraits"]
        SourcesInsert["🎯 Insertion Sources_targets<br/>+ Sources_followers"]
    end
    
    subgraph "Completion Phase"
        WorkerComplete["✅ Worker set completed<br/>Statut job terminé"]
        OnboardTrigger["⚡ has_onboarded = true<br/>Trigger user_onboard_trigger"]
        StatsRefresh["📊 update_source_targets_on_onboard<br/>refresh_user_stats_cache"]
    end
    
    subgraph "Reconnect Phase"
        GetFollowable["🔍 get_followable_targets.sql<br/>Cast bigint→string"]
        MatchingRepo["📊 matchingRepository.ts<br/>Redis-first + SQL fallback"]
        FrontDisplay["📱 Affichage matches<br/>Interface utilisateur"]
    end
    
    FileUpload --> ClientUnzip
    ClientUnzip --> ClientValidation
    ClientValidation -->|Valid| APIUpload
    ClientValidation -->|Invalid| Error1["❌ Erreur validation client"]
    
    APIUpload --> TempStorage
    APIUpload --> JobCreation
    JobCreation --> WorkerConsume
    
    WorkerConsume --> CSVDump
    CSVDump --> NodesInsert
    NodesInsert --> SourcesInsert
    
    SourcesInsert --> WorkerComplete
    WorkerComplete --> OnboardTrigger
    OnboardTrigger --> StatsRefresh
    OnboardTrigger --> GetFollowable
    
    GetFollowable --> MatchingRepo
    MatchingRepo --> FrontDisplay
    
    classDef client fill:#e3f2fd
    classDef api fill:#fff3e0
    classDef worker fill:#e8f5e8
    classDef completion fill:#f3e5f5
    classDef reconnect fill:#fce4ec
    
    class FileUpload,ClientUnzip,ClientValidation client
    class APIUpload,TempStorage,JobCreation api
    class WorkerConsume,CSVDump,NodesInsert,SourcesInsert worker
    class WorkerComplete,OnboardTrigger,StatsRefresh completion
    class GetFollowable,MatchingRepo,FrontDisplay reconnect
```

## 3. Workflow de Migration des Données

```mermaid
sequenceDiagram
    participant User as 👤 Utilisateur
    participant App as 📱 Next.js App
    participant MatchingRepo as 📊 matchingRepository.ts
    participant Redis as 📦 Redis
    participant DB as 🗄️ PostgreSQL
    participant SendFollowAPI as 🚀 /api/migrate/send_follow
    participant Bluesky as 🦋 Bluesky API
    participant Mastodon as 🐘 Mastodon API
    
    Note over User,Mastodon: Phase 1: Accès à la Reconnexion
    User->>App: Accès page /reconnect
    App->>DB: get_followable_targets.sql
    DB-->>App: Targets avec matching (bigint→string)
    
    Note over User,Mastodon: Phase 2: Récupération des Matches
    App->>MatchingRepo: getFollowableTargets()
    MatchingRepo->>Redis: Tentative Redis-first
    alt Redis disponible
        Redis-->>MatchingRepo: Données cached
    else Redis indisponible
        MatchingRepo->>DB: Fallback SQL function
        DB-->>MatchingRepo: Données from PostgreSQL
    end
    MatchingRepo-->>App: Liste des targets matchés
    
    Note over User,Mastodon: Phase 3: Sélection Utilisateur
    App->>User: Affichage interface matches
    User->>App: Sélection comptes à suivre
    
    Note over User,Mastodon: Phase 4: Exécution des Follows
    App->>SendFollowAPI: POST avec comptes sélectionnés
    SendFollowAPI->>DB: Vérification credentials utilisateur
    
    par Follows Bluesky
        SendFollowAPI->>Bluesky: Follow requests batch
        Bluesky-->>SendFollowAPI: Résultats follows
    and Follows Mastodon
        SendFollowAPI->>Mastodon: Follow requests batch
        Mastodon-->>SendFollowAPI: Résultats follows
    end
    
    Note over User,Mastodon: Phase 5: Mise à jour et Retour
    SendFollowAPI->>DB: Update sources_targets (has_follow_*)
    SendFollowAPI->>Redis: Mise à jour cache mappings
    SendFollowAPI-->>App: Résultats complets
    App->>User: Affichage résultats (succès/échecs)
```

## 4. Workflow de Gestion des Erreurs

```mermaid
flowchart TD
    Error[❌ Erreur détectée] --> Classify{Type d'erreur ?}
    
    Classify -->|Network| NetworkRetry[🔄 Retry avec backoff<br/>Max 3 tentatives]
    Classify -->|Validation| ValidationError[📝 Log erreur validation<br/>Retour utilisateur]
    Classify -->|Processing| ProcessingRetry[⚙️ Retry job processing<br/>Circuit breaker]
    Classify -->|API Rate Limit| RateLimit[⏱️ Attente quota<br/>Exponential backoff]
    
    NetworkRetry --> RetrySuccess{Succès ?}
    RetrySuccess -->|Oui| Success[✅ Traitement réussi]
    RetrySuccess -->|Non| DeadLetter[💀 Dead letter queue<br/>Investigation manuelle]
    
    ProcessingRetry --> CircuitBreaker{Circuit ouvert ?}
    CircuitBreaker -->|Oui| Fallback[🔄 Mode dégradé<br/>Notification utilisateur]
    CircuitBreaker -->|Non| RetryProcess[🔄 Nouvelle tentative]
    
    RetryProcess --> RetrySuccess
    
    RateLimit --> WaitQuota[⏳ Attente quota API]
    WaitQuota --> RetryAPI[🔄 Retry API call]
    RetryAPI --> RetrySuccess
    
    ValidationError --> UserNotification[📬 Notification utilisateur<br/>Action corrective]
    DeadLetter --> AdminAlert[🚨 Alerte administrateur<br/>Investigation requise]
    Fallback --> UserNotification
    
    Success --> UpdateStats[📊 Mise à jour métriques]
    UserNotification --> Dashboard[📊 Retour dashboard]
    
    classDef error fill:#ffebee
    classDef retry fill:#fff3e0
    classDef success fill:#e8f5e8
    classDef fallback fill:#f3e5f5
    
    class Error,ValidationError,DeadLetter,AdminAlert error
    class NetworkRetry,ProcessingRetry,RateLimit,RetryProcess,RetryAPI retry
    class Success,UpdateStats success
    class Fallback,UserNotification,Dashboard fallback
```

## 5. Workflow de Monitoring et Observabilité

```mermaid
flowchart LR
    subgraph "Collecte Métriques"
        AppMetrics[📊 App Metrics<br/>Response time, errors]
        WorkerMetrics[⚙️ Worker Metrics<br/>Jobs processed, failures]
        RedisMetrics[📦 Redis Metrics<br/>Queue length, memory]
        DBMetrics[🗄️ DB Metrics<br/>Query time, connections]
    end
    
    subgraph "Logs Centralisés"
        AppLogs[📋 App Logs<br/>JSON structured]
        WorkerLogs[📋 Worker Logs<br/>Processing events]
        ErrorLogs[❌ Error Logs<br/>Stack traces]
        AccessLogs[🌐 Access Logs<br/>Nginx requests]
    end
    
    subgraph "Health Checks"
        AppHealth[💚 App Health<br/>/api/health]
        RedisHealth[💚 Redis Health<br/>PING command]
        DBHealth[💚 DB Health<br/>Connection test]
        WorkerHealth[💚 Worker Health<br/>Process monitoring]
    end
    
    subgraph "Alerting"
        ErrorThreshold[🚨 Error Rate > 5%]
        QueueBacklog[⚠️ Queue > 1000 jobs]
        ResponseTime[⏱️ Response > 2s]
        DiskSpace[💾 Disk > 80%]
    end
    
    AppMetrics --> Dashboard[📈 Monitoring Dashboard]
    WorkerMetrics --> Dashboard
    RedisMetrics --> Dashboard
    DBMetrics --> Dashboard
    
    AppLogs --> LogAggregation[📊 Log Aggregation]
    WorkerLogs --> LogAggregation
    ErrorLogs --> LogAggregation
    AccessLogs --> LogAggregation
    
    AppHealth --> HealthDashboard[💚 Health Dashboard]
    RedisHealth --> HealthDashboard
    DBHealth --> HealthDashboard
    WorkerHealth --> HealthDashboard
    
    Dashboard --> ErrorThreshold
    Dashboard --> QueueBacklog
    Dashboard --> ResponseTime
    Dashboard --> DiskSpace
    
    ErrorThreshold --> Notification[📧 Admin Notification]
    QueueBacklog --> Notification
    ResponseTime --> Notification
    DiskSpace --> Notification
    
    classDef metrics fill:#e3f2fd
    classDef logs fill:#f3e5f5
    classDef health fill:#e8f5e8
    classDef alerts fill:#ffebee
    
    class AppMetrics,WorkerMetrics,RedisMetrics,DBMetrics metrics
    class AppLogs,WorkerLogs,ErrorLogs,AccessLogs logs
    class AppHealth,RedisHealth,DBHealth,WorkerHealth health
    class ErrorThreshold,QueueBacklog,ResponseTime,DiskSpace alerts
```

## 6. Workflow des Mappings d'Identités

```mermaid
sequenceDiagram
    participant Init as 🚀 init-redis-mappings.js
    participant Redis as 📦 Redis Cache
    participant DB as 🗄️ PostgreSQL
    participant User as 👤 Utilisateur
    participant NextAuth as 🔐 NextAuth
    participant Trigger as ⚡ SQL Triggers
    participant Webhook as 🔗 Webhook API
    
    Note over Init,Webhook: Phase 1: Initialisation au Démarrage
    Init->>+DB: SELECT twitter_bluesky_users
    DB-->>-Init: Mappings Bluesky existants
    Init->>+DB: SELECT twitter_mastodon_users  
    DB-->>-DB: Mappings Mastodon existants
    Init->>+Redis: Batch SET twitter_to_bluesky:ID
    Init->>+Redis: Batch SET twitter_to_mastodon:ID
    Redis-->>-Init: Cache initialisé
    
    Note over Init,Webhook: Phase 2: Connexion Utilisateur
    User->>+NextAuth: Connexion OAuth/Credentials
    NextAuth->>+DB: INSERT/UPDATE next-auth.users
    Note over DB: twitter_id, bluesky_id, mastodon_id
    
    Note over Init,Webhook: Phase 3: Déclenchement des Triggers
    DB->>+Trigger: sync_twitter_bluesky_users()
    alt User a Twitter + Bluesky
        Trigger->>+DB: INSERT/UPDATE twitter_bluesky_users
        Trigger->>+Webhook: POST /api/internal/sync-redis-mapping
        Webhook->>+Redis: SET twitter_to_bluesky:ID
        Redis-->>-Webhook: Mapping mis à jour
        Webhook-->>-Trigger: Succès
    end
    
    DB->>+Trigger: sync_twitter_mastodon_users()
    alt User a Twitter + Mastodon
        Trigger->>+DB: INSERT/UPDATE twitter_mastodon_users
        Trigger->>+Webhook: POST /api/internal/sync-redis-mapping
        Webhook->>+Redis: SET twitter_to_mastodon:ID
        Redis-->>-Webhook: Mapping mis à jour
        Webhook-->>-Trigger: Succès
    end
    
    Note over Init,Webhook: Phase 4: Matching Global Disponible
    Note over Redis: Tous les nouveaux utilisateurs<br/>peuvent maintenant être matchés<br/>avec tous les utilisateurs existants
    
    User->>NextAuth: Accès /reconnect
    NextAuth->>Redis: Recherche mappings disponibles
    Redis-->>NextAuth: Correspondances trouvées
    NextAuth->>User: Affichage des matches possibles
```

### Détails du Workflow des Mappings

#### 🚀 **Phase 1: Initialisation Redis**
- **Script** : `redis/init-redis-mappings.js`
- **Déclenchement** : Au démarrage de l'application
- **Action** : Chargement en masse des mappings existants depuis PostgreSQL vers Redis
- **Format clés** : `twitter_to_bluesky:123456789`, `twitter_to_mastodon:123456789`

#### 🔐 **Phase 2: Mise à jour Utilisateur**
- **Trigger** : Connexion ou mise à jour de profil utilisateur
- **Table** : `next-auth.users` (colonnes twitter_id, bluesky_id, mastodon_id)
- **Contraintes** : Une seule connexion Twitter par utilisateur (unique constraint)

#### ⚡ **Phase 3: Synchronisation Automatique**
- **Triggers PostgreSQL** :
  - `sync_twitter_bluesky_users_string.sql`
  - `sync_twitter_mastodon_users_string.sql`
- **Action** : Mise à jour des tables de mapping + appel webhook
- **Webhook** : `/api/internal/sync-redis-mapping` pour actualiser Redis

#### 🎯 **Phase 4: Matching Global**
- **Bénéfice** : Chaque nouvel utilisateur peut être matché avec tous les utilisateurs existants
- **Performance** : Recherche ultra-rapide via Redis cache
- **Fallback** : PostgreSQL en cas d'indisponibilité Redis

## Optimisations et Bonnes Pratiques

### Performance
- **Batch Processing**: Traitement par lots pour réduire la charge DB
- **Connection Pooling**: Pool de connexions PostgreSQL
- **Redis Pipelining**: Commandes groupées pour Redis
- **Lazy Loading**: Chargement différé des données volumineuses

### Fiabilité
- **Circuit Breaker**: Protection contre les cascades d'erreurs
- **Retry Logic**: Tentatives avec backoff exponentiel
- **Dead Letter Queue**: Gestion des jobs irrécupérables
- **Health Checks**: Surveillance continue des services

### Sécurité
- **Input Validation**: Validation stricte des données
- **Rate Limiting**: Protection contre les abus
- **Secrets Management**: Variables d'environnement sécurisées
- **Network Isolation**: Réseaux Docker séparés

### Scalabilité
- **Horizontal Scaling**: Multiplication des workers
- **Load Balancing**: Distribution via Nginx
- **Cache Strategy**: Stratégie de cache multi-niveaux
- **Database Sharding**: Partitionnement si nécessaire
