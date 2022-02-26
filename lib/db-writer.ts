
import StormDB from 'stormdb';
import { log } from './logger';


export class LeaderEntry {
  initials: string;
  ip_address: string;
  score: number;
  timestamp: Date;

  constructor(initials: string, ip_address: string, score: number, timestamp: Date) {
    this.initials = initials;
    this.ip_address = ip_address;
    this.score = score;
    this.timestamp = this.timestamp
  }
}

export class DBWriter {

  private engine = new StormDB.localFileEngine("./db/leaderboard.db");
  private db = new StormDB(this.engine);

  constructor() {
    this.db.default({});
  }

  public getLeaderBoard(numberOfEntries: number): LeaderEntry[] {
    let leaderboard: LeaderEntry[] = this.db.get("leaderboard").value();
    return leaderboard.slice(0, numberOfEntries);
  }

  public writeEntry(leaderEntry: LeaderEntry) {
    leaderEntry.timestamp = new Date();
    this.db.get("leaderboard").push(leaderEntry);
    this.db.get("leaderboard").sort((l1: LeaderEntry, l2: LeaderEntry) => l2.score - l1.score).save();
  }

  

}