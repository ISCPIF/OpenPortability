# python_worker/Dockerfile
FROM node:20-alpine

# Installer Python et pip
RUN apk add --no-cache python3 py3-pip

# Créer un environnement virtuel Python
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /app

# Copier le fichier requirements.txt et installer les dépendances Python
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copier les scripts Python et s'assurer qu'ils sont exécutables
COPY testDm_bluesky.py testDm_mastodon.py ./
RUN chmod +x *.py

# Copier les fichiers package.json et installer les dépendances Node
COPY package.json ./
RUN npm install

# Copier le reste des fichiers du worker
COPY . .

# Rendre le script de démarrage exécutable
RUN chmod +x start-py-workers.sh

# Compiler le code TypeScript
RUN npm run build # Ou la commande de build spécifique de votre projet

# Exposer les variables d'environnement
ENV PYTHON_WORKER_ID="python-worker-01"
ENV PYTHON_WORKER_POLLING_INTERVAL=5000
ENV PYTHON_WORKER_STALLED_TASK_TIMEOUT=300000

# S'assurer que l'environnement virtuel est accessible au processus Node.js
ENV NODE_ENV=production

# Commande de démarrage du worker
CMD ["./start-py-workers.sh"]