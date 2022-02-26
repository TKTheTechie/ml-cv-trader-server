
import { default as pino } from "pino";


export const log = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: true
    }
  },
  name: 'app-name',
  level: 'info'
});