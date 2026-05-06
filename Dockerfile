FROM ghcr.io/puppeteer/puppeteer:latest

# Voltamos para root para garantir permissões de rede e sistema
USER root
WORKDIR /workspace

# Copia apenas o necessário primeiro para otimizar o cache
COPY package.json ./
RUN npm install

# Copia o restante do código
COPY . .

# Garante que a porta 8080 seja a usada pelo sistema
ENV PORT=8080
EXPOSE 8080

# Comando de inicialização direto
CMD ["node", "index.js"]
