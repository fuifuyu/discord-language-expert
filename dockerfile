FROM node:latest

# Create the directory!
RUN mkdir -p /usr/src/bot/translation-bot
WORKDIR /usr/src/bot/translation-bot

# Copy and Install our bot
COPY package.json /usr/src/bot/translation-bot
RUN npm install

# Our precious bot
COPY . /usr/src/bot/translation-bot

CMD ["npm", "start"]