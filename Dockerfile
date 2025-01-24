# Stage de développement
FROM node:18-alpine AS dev
WORKDIR /app

ENV NODE_ENV development

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "run", "dev"]