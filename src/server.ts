import solace,{  LogImpl, Message } from 'solclientjs';
import express from 'express';

import { SolaceMarketDataProducer } from './lib/solace-md-producer';
import { SolaceClient } from './lib/solace-client';
import { DBWriter, LeaderEntry } from './lib/db-writer';
import { Blob } from 'buffer';

import  cors  from 'cors';
import { log } from './lib/logger'



const allowedOrigins = ['http://localhost:3000','https://tkthetechie.github.io'];

const options: cors.CorsOptions = {
  origin: allowedOrigins
};

const app = express();
app.use(cors(options));
const port = 3001;
const solaceClient = new SolaceClient();
const dbWriter = new DBWriter();

class LeaderboardRequest {
  initials: string;
  numberOfEntries: number;
}


app.listen(port, () => {
  log.info(`Starting cv-ml-trader-server on ${port}.`);
  solaceClient.connect().then((message: string) => {
    log.info("Connected to Solace!");

    //instantiate the market data producer
    let solaceMdProducer = new SolaceMarketDataProducer(solaceClient);

    //setup a subscription to the leader entry queue
    solaceClient.consumeFromQueue("LEADER-ENTRY-QUEUE", new Array("tkthetechie/leader/entry/*"), (msg: Message) => {
      const blob = new Blob([msg.getBinaryAttachment()], { type: 'text/plain; charset=utf-8' });
      blob.text().then(text => {
        log.info('Received score: ' + text);
        let leaderEntry: LeaderEntry = JSON.parse(text);
        dbWriter.writeEntry(leaderEntry);
      });
    });

    //setup a subscription for leader requests(
    solaceClient.subscribe("tkthetechie/leaderboard/request",  (msg: Message):Promise<Message> => {
     return new Promise(
       (resolve, reject) => {
          const blob = new Blob([msg.getBinaryAttachment()], { type: 'text/plain; charset=utf-8' });
          blob.text().then(text => {
            let lbr: LeaderboardRequest = JSON.parse(text);
            log.info("Received a leaderboard request")
            let leaderboard: LeaderEntry[] = dbWriter.getLeaderBoard(lbr.numberOfEntries);
            const binaryAttachment = new Blob([JSON.stringify(leaderboard)], { type: 'text/plain; charset=utf-8' }).arrayBuffer();
            let message = solace.SolclientFactory.createMessage();
            binaryAttachment.then(buffer => {
              message.setBinaryAttachment(new Uint8Array(buffer));
              resolve(message);
            });
          });
        });
    } , true);

  })
});

app.get('/get-leader-board', (req, res) => {
  let leaderboard: LeaderEntry[] = dbWriter.getLeaderBoard(parseInt(req.query.numberOfEntries as string,10));
  res.send(leaderboard);
})