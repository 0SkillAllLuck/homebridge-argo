import { Service, PlatformAccessory, CharacteristicValue, Units, Characteristic } from 'homebridge';
import { ArgoPlatform } from './platform.js';
import { ArgoApi } from './argo/api.js';

export class ArgoAccessory {
  private readonly information: Service;
  private readonly heaterCooler: Service;
  private readonly active: Characteristic;
  private readonly currentTemperature: Characteristic;
  private readonly coolingThresholdTemperature: Characteristic;
  private readonly targetHeaterCoolerState: Characteristic;
  private readonly currentHeaterCoolerState: Characteristic;
  private readonly rotationSpeed: Characteristic;

  constructor(
    private readonly platform: ArgoPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly api: ArgoApi,
    private readonly name: string,
    private readonly offset: number = 0,
  ) {
    // Setup the base accessory information
    this.information = this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Argo')
      .setCharacteristic(this.platform.Characteristic.Model, 'Ulisse 13 DCI Eco WiFi')
      .setCharacteristic(this.platform.Characteristic.Name, name)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-SerialNumber');

    // Setup the HeaterCooler service
    this.heaterCooler = this.accessory.getService(this.platform.Service.HeaterCooler)
      || this.accessory.addService(this.platform.Service.HeaterCooler);
    this.active = this.heaterCooler
      .getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActive.bind(this));
    this.currentTemperature = this.heaterCooler
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .setProps({
        unit: Units.CELSIUS,
        minValue: 0,
        maxValue: 100,
        minStep: 0.1,
      });
    this.coolingThresholdTemperature = this.heaterCooler.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .setProps({
        unit: Units.CELSIUS,
        minValue: 10 + this.offset,
        maxValue: 32 + this.offset,
        minStep: 1,
      })
      .onSet(this.setCoolingThresholdTemperature.bind(this));
    this.targetHeaterCoolerState = this.heaterCooler.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .setProps({
        validValues: [
          this.platform.Characteristic.TargetHeaterCoolerState.COOL,
        ],
      })
      .onSet(this.setTargetHeaterCoolerState.bind(this));
    this.currentHeaterCoolerState = this.heaterCooler.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState);
    this.rotationSpeed = this.heaterCooler.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .setProps({
        minValue: 0,
        maxValue: 6,
        minStep: 1,
      })
      .onSet(this.setRotationSpeed.bind(this));

    // Start the polling loop
    this.syncDevice();
  }

  async setActive(value: CharacteristicValue): Promise<void> {
    const operatingMode = value === this.platform.Characteristic.Active.ACTIVE ? 1 : 0;

    this.api.setOperatingMode(operatingMode);
    this.platform.log.info('setActive ->', value, operatingMode);
  }

  async setCoolingThresholdTemperature(value: CharacteristicValue): Promise<void> {
    const targetTemperature = (value as number) - this.offset * 10;

    this.api.setTargetTemperature(targetTemperature);
    this.platform.log.info('setCoolingThresholdTemperature ->', value, targetTemperature);
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue): Promise<void> {
    const operationMode = value === this.platform.Characteristic.TargetHeaterCoolerState.COOL ? 1 : 5;

    this.api.setOperationMode(operationMode);
    this.platform.log.info('setTargetHeaterCoolerState ->', value, operationMode);
  }

  async setRotationSpeed(value: CharacteristicValue): Promise<void> {
    const fanMode = value as 1 | 2 | 3 | 4 | 5 | 6;

    this.api.setFanMode(fanMode);
    this.platform.log.info('setRotationSpeed ->', value, fanMode);
  }

  updateState(hmi: string): void {
    this.platform.log.info('updateState ->', hmi);
    const parts = hmi.split(',');

    this.active.updateValue(parseInt(parts[2]) === 1
      ? this.platform.Characteristic.Active.ACTIVE
      : this.platform.Characteristic.Active.INACTIVE,
    );
    this.currentTemperature.updateValue((parseInt(parts[1]) / 10) + this.offset);
    this.coolingThresholdTemperature.updateValue((parseInt(parts[0]) / 10) + this.offset);
    this.targetHeaterCoolerState.updateValue(parseInt(parts[3]) === 1
      ? this.platform.Characteristic.TargetHeaterCoolerState.COOL
      : this.platform.Characteristic.TargetHeaterCoolerState.AUTO);
    this.currentHeaterCoolerState.updateValue(parseInt(parts[2]) === 1
      ? parseInt(parts[1]) > parseInt(parts[0])
        ? this.platform.Characteristic.CurrentHeaterCoolerState.COOLING
        : this.platform.Characteristic.CurrentHeaterCoolerState.IDLE
      : this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE);
    this.rotationSpeed.updateValue(parseInt(parts[4]));

    this.information.setCharacteristic(this.platform.Characteristic.FirmwareRevision, parseInt(parts[23]).toFixed(0));
  }

  private nextPollAt = Date.now();
  private async syncDevice(): Promise<void> {
    // Store if an update was pending
    const needsUpdate = this.api.pending();

    // If there are pending updates, sync the device
    if (needsUpdate){
      await this.api.sync()
        .catch(() => null);

      // Set the next poll to 5 seconds from now
      this.nextPollAt = Date.now() + 5000;
    } else if (Date.now() >= this.nextPollAt) {
      await this.api.sync()
        .then((hmi) => this.updateState(hmi))
        .catch(() => null);

      // Set the next poll to 15 seconds from now
      this.nextPollAt = Date.now() + 15000;
    }

    // If push is in use, set the next poll to 1 minute from now
    if (this.platform.config.usePush) {
      this.nextPollAt += + 60000;
    }

    // Schedule the next poll 1 second
    setTimeout(this.syncDevice.bind(this), 1000);
  }
}
