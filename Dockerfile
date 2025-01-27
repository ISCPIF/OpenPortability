FROM node:18-alpine
WORKDIR /app

# On ne copie que le package.json pour profiter du cache de Docker
COPY package*.json ./
RUN npm install

# Le reste des fichiers sera monté via le volume dans docker-compose
EXPOSE 3000

CMD ["npm", "run", "dev"]