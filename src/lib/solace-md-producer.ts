import { SolaceClient } from './solace-client';
import { log } from './logger';
import { Message } from 'solclientjs';

class MarketDataEvent {
  ticker: string;
  bid: number;
  mid: number;
  ask: number;

  constructor(ticker: string, bid: number, mid: number, ask: number){
    this.ticker = ticker;
    this.bid = bid;
    this.ask = ask;
    this.mid = mid;
  }
}

export class SolaceMarketDataProducer {

  private static VOLATILITY = .15;
  private static MARKETDATA_TOPIC = 'tkthetechie/price/solly';
  private static NEW_TRADING_SESSION_TOPIC = 'tkthetechie/new/trading/session';
  private static BID_ASK_SPREAD = .5;


  private solaceClient: SolaceClient;
  private endCycleTime: number;
  private currentPrice = 100.00;
  

  constructor(solaceClient: SolaceClient) {
    this.solaceClient = solaceClient;
    this.endCycleTime = new Date().getTime();
    //attempt to produce market data every 200ms
    log.info("Starting pub cycle..");
    setInterval(() => this.produceMarketData(), 200);
    this.solaceClient.subscribe(SolaceMarketDataProducer.NEW_TRADING_SESSION_TOPIC, (msg:Message) => {
      log.info("Received a trading session request: " + msg.dump() +". Extending market data distribution by 5 minutes...");
      this.endCycleTime = new Date().getTime() + 360000;
    });
  }

  private produceMarketData() {
    let currentTime = new Date();
    if (currentTime.getTime() < this.endCycleTime) {
      this.generateNewPrice();
      let marketDataEvent = new MarketDataEvent("SOLLY", this.currentPrice - SolaceMarketDataProducer.BID_ASK_SPREAD, this.currentPrice, this.currentPrice + SolaceMarketDataProducer.BID_ASK_SPREAD);
      this.solaceClient.publishDirect(SolaceMarketDataProducer.MARKETDATA_TOPIC, JSON.stringify(marketDataEvent));
    } else {
      this.currentPrice = 100;
    }
  }

  private  generateNewPrice(){
    let rnd = Math.random(); // generate number, 0 <= x < 1.0
    let change_percent = 2 * SolaceMarketDataProducer.VOLATILITY * rnd;
    if (change_percent > SolaceMarketDataProducer.VOLATILITY)
        change_percent -= (2 * SolaceMarketDataProducer.VOLATILITY);
    this.currentPrice += this.currentPrice * change_percent;  
  }

}