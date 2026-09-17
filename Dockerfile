FROM node:12

RUN echo "deb http://archive.debian.org/debian/ stretch main" > /etc/apt/sources.list \
    && echo "deb http://archive.debian.org/debian-security stretch/updates main" >> /etc/apt/sources.list
RUN apt-get update && apt-get install -y vim

WORKDIR /usr/src/app

COPY package*.json ./
# COPY tsconfig.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production
RUN npm ci

# Bundle app source
COPY . .
# COPY ./src/ ./

# COPY ../webapp/vue-js-client-crud/dist/ public

EXPOSE 9001 

ADD start.sh /
RUN chmod +x /start.sh
CMD ["/start.sh"]

