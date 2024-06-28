import axios, { AxiosInstance, AxiosResponse } from 'axios';

export class ArgoApi {
  private readonly request: AxiosInstance;

  constructor(
    ip: string,
  ) {
    this.request = axios.create({
      baseURL: `http://${ip}:1001`,
      headers: {
        'Content-Type': 'text/html',
      },
      timeout: 5000,
    });
  }

  get = () => this.request.get<string>('', {
    params: {
      HMI: '',
      UPD: '0',
    },
  }).then((res) => this.handleResponse(res));

  // Set the target temperature
  setTargetTemperature = (temperature: number) => this.request.get<string>('', {
    params: {
      HMI: this.buildHMI(temperature.toString(), 0),
      UPD: '1',
    },
  }).then((res) => this.handleResponse(res));

  // Set the operating mode to either OFF (0) or ON (1)
  setOperatingMode = (mode: 0 | 1) => this.request.get<string>('', {
    params: {
      HMI: this.buildHMI(mode.toString(), 2),
      UPD: '1',
    },
  }).then((res) => this.handleResponse(res));

  // Set the operation mode to either COOL (1), DRY (2), HEAT (3), FAN (4), or AUTO (5)
  setOperationMode = (mode: 1 | 2 | 3 | 4 | 5) => this.request.get<string>('', {
    params: {
      HMI: this.buildHMI(mode.toString(), 3),
      UPD: '1',
    },
  }).then((res) => this.handleResponse(res));

  // Set the fan mode to either AUTO (0), LOWEST (1), LOW (2), MEDIUM (3), HIGH (4), HIGHER (5), or HIGHEST (6)
  setFanMode = (mode: 0 |1 | 2 | 3 | 4 | 5 | 6) => this.request.get<string>('', {
    params: {
      HMI: this.buildHMI(mode.toString(), 4),
      UPD: '1',
    },
  }).then((res) => this.handleResponse(res));

  private handleResponse(res: AxiosResponse<string>): string {
    return res.data;
  }

  private buildHMI(value: string, index: number): string {
    let hmi = '';
    for (let i = 0; i < 36; i++) {
      hmi += i === index ? value : 'N';
      hmi += i === 35 ? '' : ',';
    }
    return hmi;
  }
}