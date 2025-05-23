import axios, { AxiosInstance } from 'axios';

const DEFAULT_HMI = 'N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N';

export class ArgoApi {
  private readonly request: AxiosInstance;

  private nextHMI = DEFAULT_HMI;
  private debounce = Date.now();

  constructor(
    ip: string,
  ) {
    this.request = axios.create({
      baseURL: `http://${ip}:1001`,
      headers: {
        'Content-Type': 'text/html',
      },
      timeout: 15000,
    });
  }

  // Check if there is a pending HMI update
  pending(): boolean {
    return this.nextHMI !== DEFAULT_HMI && Date.now() >= this.debounce;
  }

  // Sync the HMI from the device, if required also update the HMI
  sync(): Promise<string> {
    return this.request.get<string>('', {
      params: {
        HMI: this.nextHMI,
        UPD: this.pending() ? '1' : '0',
      },
    }).then((res) => {
      // Only update here to prevent not sending updates on errors
      this.nextHMI = DEFAULT_HMI;
      return res.data;
    });
  }

  // Set the target temperature
  setTargetTemperature(temperature: number): void {
    this.setHMI(temperature.toString(), 0);
  }

  // Set the operating mode to either OFF (0) or ON (1)
  setOperatingMode(mode: 0 | 1): void {
    this.setHMI(mode.toString(), 2);
  }

  // Set the operation mode to either COOL (1), DRY (2), HEAT (3), FAN (4), or AUTO (5)
  setOperationMode(mode: 1 | 2 | 3 | 4 | 5): void {
    this.setHMI(mode.toString(), 3);
  }

  // Set the fan mode to either AUTO (0), LOWEST (1), LOW (2), MEDIUM (3), HIGH (4), HIGHER (5), or HIGHEST (6)
  setFanMode(mode: 0 | 1 | 2 | 3 | 4 | 5 | 6): void {
    this.setHMI(mode.toString(), 4);
  }

  // Turns off (0) or on (1) the eco mode
  setEcoMode(mode: 0 | 1): void {
    this.setHMI(mode.toString(), 8);
  }

  // Turns off (0) or on (1) the turbo mode
  setTurboMode(mode: 0 | 1): void {
    this.setHMI(mode.toString(), 9);
  }

  // Turns off (0) or on (1) the night mode
  setNightMode(mode: 0 | 1): void {
    this.setHMI(mode.toString(), 10);
  }

  private setHMI(value: string, index: number) {
    // Increase the debounce time to help bundling write requests
    this.debounce = Date.now() + 250;

    // Update the HMI with the new value
    const parts = this.nextHMI.split(',');
    parts[index] = value;
    this.nextHMI = parts.join(',');
  }
}