FROM node:18-alpine
WORKDIR /app

# Install bash
RUN apk add --no-cache bash

COPY package*.json ./
COPY . .

RUN npm install
RUN npm run build
RUN chmod +x start-workers.sh

ENV NODE_ENV=production

CMD ["/bin/bash", "./start-workers.sh"]