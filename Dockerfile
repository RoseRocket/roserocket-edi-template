FROM node:10
WORKDIR /usr/local/src/github/RoseRocket/roserocket-edi-template
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 5100
CMD ["node", "app.js"]

