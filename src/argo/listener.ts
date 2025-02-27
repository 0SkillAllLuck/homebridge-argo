import { Server } from 'http';
import express, { Express, Response, Request } from 'express';
import { format } from 'date-fns';
import { Logging } from 'homebridge';

export class ArgoListener {
  private app: Express;
  private server: Server | undefined;

  constructor(
    private readonly log: Logging,
    private readonly port: number,
    private readonly host: string,
    private readonly updateHandler: (ip: string, hmi: string) => void,
  ) {
    this.app = express();
    this.app.get('*', this.handleGET.bind(this));
    this.app.post('*', this.handlePOST.bind(this));
  }

  public start(): void {
    this.server = this.app.listen(this.port, this.host, () => {
      this.log.info(`Listener started ${this.host}:${this.port}`);
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close(() => {
        this.log.info('Listener stopped');
      });
    }
  }

  private handleGET(req: Request, res: Response): void {
    if (req.query.CM === 'UI_NTP') {
      this.log.debug('Listener UI_NTP', req.query);
      res.send(`NTP ${format(new Date(), 'yyyy-MM-dd\'T\'HH:mm:ssXXX')} UI SERVER (M.A.V. srl)`);
      return;
    }
    if (req.query.CM === 'UI_FLG') {
      this.log.debug('Listener UI_FLG', req.query);
      res.send('{|1|0|1|0|0|0|N,N,N,N,1,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N|}[|0|||]ACN_FREE <br>\t\t');

      this.updateHandler(req.query.IP as string, req.query.HMI as string);
      return;
    }

    this.log.debug('Listener GET', req.query);
    res.send('|}|}\t\t');
  }

  private handlePOST(req: Request, res: Response): void {
    this.log.debug('Listener POST', req.query, req.body);
    res.send('|}|}\t\t');
  }
}