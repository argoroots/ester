FROM node:8-slim

ADD ./ /usr/src/entu-ester
RUN apt-get update && apt-get install -y yaz
RUN cd /usr/src/entu-ester && npm --silent --production install

CMD ["node", "/usr/src/entu-ester/master.js"]
