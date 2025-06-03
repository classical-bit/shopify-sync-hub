FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN mkdir -p /app/logs && chmod -R 777 /app/logs
VOLUME ["/app/logs"]

CMD ["npm", "run", "start"]
