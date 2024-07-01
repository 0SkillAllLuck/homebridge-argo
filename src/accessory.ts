import { Service, PlatformAccessory, CharacteristicValue, Units, Characteristic } from 'homebridge';

import { ArgoPlatform } from './platform.js';
import { ArgoApi } from './argo/api.js';

export class ArgoAccessory {
  private readonly service: Service;
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
    name: string,
  ) {
    // Setup the base accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Argo')
      .setCharacteristic(this.platform.Characteristic.Model, 'Ulisse 13 DCI Eco WiFi')
      .setCharacteristic(this.platform.Characteristic.Name, name)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-SerialNumber')
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, 'Default-FirmwareRevision');

    // Setup the HeaterCooler service
    this.service = this.accessory.getService(this.platform.Service.HeaterCooler)
      || this.accessory.addService(this.platform.Service.HeaterCooler);
    this.active = this.service
      .getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActive.bind(this));
    this.currentTemperature = this.service
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .setProps({
        unit: Units.CELSIUS,
        minValue: 0,
        maxValue: 100,
        minStep: 0.1,
      });
    this.coolingThresholdTemperature = this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .setProps({
        unit: Units.CELSIUS,
        minValue: 16,
        maxValue: 30,
        minStep: 1,
      })
      .onSet(this.setCoolingThresholdTemperature.bind(this));
    this.targetHeaterCoolerState = this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .setProps({
        validValues: [
          this.platform.Characteristic.TargetHeaterCoolerState.COOL,
        ],
      })
      .onSet(this.setTargetHeaterCoolerState.bind(this));
    this.currentHeaterCoolerState = this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState);
    this.rotationSpeed = this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .setProps({
        minValue: 0,
        maxValue: 6,
        minStep: 1,
      })
      .onSet(this.setRotationSpeed.bind(this));

    // If the device is not using push updates, poll the device every 15 seconds
    // if it is check for pending updates every second
    setInterval(async () => {
      if (!platform.config.usePush || this.api.pending()) {
        this.api.sync()
          .then((hmi) => this.updateState(hmi))
          .catch(() => null);
      }
    }, !platform.config.usePush ? 15000 : 1000);
  }

  async setActive(value: CharacteristicValue): Promise<void> {
    const operatingMode = value === this.platform.Characteristic.Active.ACTIVE ? 1 : 0;

    this.api.setOperatingMode(operatingMode);
    this.platform.log.debug('setActive ->', value, operatingMode);
  }

  async setCoolingThresholdTemperature(value: CharacteristicValue): Promise<void> {
    const targetTemperature = value as number * 10;

    this.api.setTargetTemperature(targetTemperature);
    this.platform.log.debug('setCoolingThresholdTemperature ->', value, targetTemperature);
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue): Promise<void> {
    const operationMode = value === this.platform.Characteristic.TargetHeaterCoolerState.COOL ? 1 : 5;

    this.api.setOperationMode(operationMode);
    this.platform.log.debug('setTargetHeaterCoolerState ->', value, operationMode);
  }

  async setRotationSpeed(value: CharacteristicValue): Promise<void> {
    const fanMode = value as 1 | 2 | 3 | 4 | 5 | 6;

    this.api.setFanMode(fanMode);
    this.platform.log.debug('setRotationSpeed ->', value, fanMode);
  }

  updateState(hmi: string): void {
    this.platform.log.debug('updateState ->', hmi);
    const parts = hmi.split(',');

    this.active.updateValue(parseInt(parts[2]) === 1
      ? this.platform.Characteristic.Active.ACTIVE
      : this.platform.Characteristic.Active.INACTIVE,
    );
    this.currentTemperature.updateValue(parseInt(parts[1]) / 10);
    this.coolingThresholdTemperature.updateValue(parseInt(parts[0]) / 10);
    this.targetHeaterCoolerState.updateValue(parseInt(parts[3]) === 1
      ? this.platform.Characteristic.TargetHeaterCoolerState.COOL
      : this.platform.Characteristic.TargetHeaterCoolerState.AUTO);
    this.currentHeaterCoolerState.updateValue(parseInt(parts[2]) === 1
      ? parseInt(parts[1]) > parseInt(parts[0])
        ? this.platform.Characteristic.CurrentHeaterCoolerState.COOLING
        : this.platform.Characteristic.CurrentHeaterCoolerState.IDLE
      : this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE);
    this.rotationSpeed.updateValue(parseInt(parts[4]));
  }
}
