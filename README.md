### 1. Install Supabase & Run Locally

#### 1. Install Docker

You will need to install Docker to run Supabase locally. You can download it [here](https://docs.docker.com/get-docker) for free.

#### 2. Install Supabase CLI

**MacOS/Linux**

```bash
brew install supabase/tap/supabase
```

**Windows**

```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### 3. Start Supabase

Dans le terminal du repo Git cloné, run les commandes suivantes :

```bash
supabase start
```

Appliquer la migration lors du premier lancement et pour redémarrer la base de donnees en appliquant les modifications des migrations

```bash
supabase db reset
```

#### 4. Environment Variables

In your terminal at the root of your local Chatbot UI repository, run:

```bash
cp .example.env.local .env.local
```

Get the required values by running:

```bash
supabase status
```

On doit récupérer les valeurs suivantes :
- API URL = NEXT_PUBLIC_SUPABASE_URL
- anon key = NEXT_PUBLIC_SUPABASE_ANON_KEY
- service_role key = SUPABASE_SERVICE_ROLE_KEY

#### 4. Install dependencies

```bash
npm install
```

### 2. Getting Started

### 1. Créer une application Twitter sur : 
``` https://developer.twitter.com/en/portal/dashboard ```

- Sélectionner la version de l'API Twitter : OAuth 2.0
- Remplir les champs obligatoires 
- Dans la rubrique Keys and Tokens : en bas de la page, il y a la "OAuth 2.0 Client ID and Client Secret", on veut récupérer les valeurs suivantes :
    - TWITTER_CLIENT_ID = CLIENT_ID
    - TWITTER_CLIENT_SECRET =  CLIENT_SECRET


Pour les autres variables d'environnement :

NEXTAUTH_URL= l'URL de l'application qui doit être externe pour permettre la connexion avec l'API Twitter 

### 2. Lancer l'application en mode développement

```
nm run dev
```

### 3. Lancer le tunnel pour obtenir l'URL de l'application

Install [cloudflared](https://github.com/cloudflare/cloudflared) (Mac/Linux)

```bash
brew install cloudflared
```

Ensuite créer le tunnel pour obtenir l'URL de l'application :

```bash
cloudflared tunnel --url http://localhost:3000
```

Récupérer l'URL obtenue et l'ajouter à l'env variable `NEXTAUTH_URL` dans `.env.local`

### 4. Se connecter au developer Portal de Twitter et copier l'url de l'application dans les champs suivants :

User Authentification Settings :
- Callback URI/ Redirect URL :
```
[URL TUNNEL]/api/auth/callback/twitter

```

- Website URL :
```
[URL TUNNEL]
```

### 5. Générer une clé de cryptage

```shell
openssl rand -hex 16
```

Et l'ajouter au fichier `.env.local`

```
ENCRYPTION_KEY=abcd1234…
```

### 6. L'application devrait être accessible !

sur http://localhost:3000/
