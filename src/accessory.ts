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

  private readonly serviceEco: Service | undefined;
  private readonly onEco: Characteristic | undefined;

  private readonly serviceTurbo: Service | undefined;
  private readonly onTurbo: Characteristic | undefined;

  private readonly serviceNight: Service | undefined;
  private readonly onNight: Characteristic | undefined;

  private nextPollAt = Date.now();
  private isPendingRotationSpeed: boolean = false;

  constructor(
    private readonly platform: ArgoPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly api: ArgoApi,
    private readonly name: string,
    private readonly offset: number = 0,
    private readonly modeToggles: boolean = false,
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


    if (modeToggles) {
      // Setup the Switch service for Eco mode
      this.serviceEco = this.accessory.getService('Turbo Mode')
        || this.accessory.addService(this.platform.Service.Switch, 'Eco Mode', 'Eco Mode');
      this.serviceEco.setCharacteristic(this.platform.Characteristic.Name, 'Eco Mode');
      this.serviceEco.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
      this.serviceEco.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.name + ' Eco Mode');
      this.onEco = this.serviceEco.getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setOnEco.bind(this));

      // Setup the Switch service for Turbo mode
      this.serviceTurbo = this.accessory.getService('Turbo Mode')
                || this.accessory.addService(this.platform.Service.Switch, 'Turbo Mode', 'Turbo Mode');
      this.serviceTurbo.setCharacteristic(this.platform.Characteristic.Name, 'Turbo Mode');
      this.serviceTurbo.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
      this.serviceTurbo.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.name + ' Turbo Mode');
      this.onTurbo = this.serviceTurbo.getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setOnTurbo.bind(this));

      // Setup the Switch service for Night mode
      this.serviceNight = this.accessory.getService('Night Mode')
            || this.accessory.addService(this.platform.Service.Switch, 'Night Mode', 'Night Mode');
      this.serviceNight.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
      this.serviceNight.setCharacteristic(this.platform.Characteristic.Name, 'Night Mode');
      this.serviceNight.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.name + ' Night Mode');
      this.onNight = this.serviceNight.getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setOnNight.bind(this));
    } else {
      // Remove the services if they are not needed
      this.serviceEco = this.accessory.getService('Eco Mode');
      if (this.serviceEco) {
        this.accessory.removeService(this.serviceEco);
      }
      this.serviceTurbo = this.accessory.getService('Turbo Mode');
      if (this.serviceTurbo) {
        this.accessory.removeService(this.serviceTurbo);
      }
      this.serviceNight = this.accessory.getService('Night Mode');
      if (this.serviceNight) {
        this.accessory.removeService(this.serviceNight);
      }
    }

    // Start the polling loop
    this.syncDevice();
  }

  async setActive(value: CharacteristicValue): Promise<void> {
    // HomeKit sends a setActive request with 0 when the RotationSpeed is set to 0, so we need to ignore it
    if (this.isPendingRotationSpeed) {
      return;
    }

    const operatingMode = value === this.platform.Characteristic.Active.ACTIVE ? 1 : 0;

    this.api.setOperatingMode(operatingMode);
    this.platform.log.success(`${this.name}: SetActive ->`, value, operatingMode);
  }

  async setCoolingThresholdTemperature(value: CharacteristicValue): Promise<void> {
    const targetTemperature = ((value as number) - this.offset) * 10;

    this.api.setTargetTemperature(targetTemperature);
    this.platform.log.success(`${this.name}: CoolingThresholdTemperature ->`, value, targetTemperature);
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue): Promise<void> {
    const operationMode = value === this.platform.Characteristic.TargetHeaterCoolerState.COOL ? 1 : 5;

    this.api.setOperationMode(operationMode);
    this.platform.log.success(`${this.name}: TargetHeaterCoolerState ->`, value, operationMode);
  }

  async setRotationSpeed(value: CharacteristicValue): Promise<void> {
    this.isPendingRotationSpeed = true;
    const fanMode = value as 1 | 2 | 3 | 4 | 5 | 6;

    this.api.setFanMode(fanMode);
    this.platform.log.success(`${this.name}: RotationSpeed ->`, value, fanMode);
  }

  async setOnEco(value: CharacteristicValue): Promise<void> {
    const ecoMode = value ? 1 : 0;
    // Only one mode can be active at a time
    if (ecoMode === 1) {
      this.api.setTurboMode(0);
      this.api.setNightMode(0);
    }

    this.api.setEcoMode(ecoMode);
    this.platform.log.success(`${this.name}: OnEco ->`, value, ecoMode);
  }

  async setOnTurbo(value: CharacteristicValue): Promise<void> {
    const turboMode = value ? 1 : 0;
    // Only one mode can be active at a time
    if (turboMode === 1) {
      this.api.setEcoMode(0);
      this.api.setNightMode(0);
    }

    this.api.setTurboMode(turboMode);
    this.platform.log.success(`${this.name}: OnTurbo ->`, value, turboMode);
  }

  async setOnNight(value: CharacteristicValue): Promise<void> {
    const nightMode = value ? 1 : 0;
    // Only one mode can be active at a time
    if (nightMode === 1) {
      this.api.setEcoMode(0);
      this.api.setTurboMode(0);
    }

    this.api.setNightMode(nightMode);
    this.platform.log.success(`${this.name}: OnNight ->`, value, nightMode);
  }

  updateState(hmi: string): void {
    this.platform.log.info(`${this.name}: UpdateState ->`, hmi);
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

    // Update the mode toggles if they are enabled
    if (this.modeToggles) {
      this.onEco?.updateValue(parseInt(parts[8]) === 1);
      this.onTurbo?.updateValue(parseInt(parts[9]) === 1);
      this.onNight?.updateValue(parseInt(parts[10]) === 1);
    }

    this.information.setCharacteristic(this.platform.Characteristic.FirmwareRevision, parseInt(parts[23]).toFixed(0));
  }

  private async syncDevice(): Promise<void> {
    // Store if an update was pending
    const needsUpdate = this.api.pending();

    // If there are pending updates, sync the device
    if (needsUpdate){
      await this.api.sync()
        .catch(() => this.platform.log.error(`${this.name}: Failed to sync state`));

      // Set the next poll to 5 seconds from now
      this.nextPollAt = Date.now() + 5000;

      // Reset the pending rotation speed flag
      this.isPendingRotationSpeed = false;
    } else if (Date.now() >= this.nextPollAt) {
      await this.api.sync()
        .then((hmi) => this.updateState(hmi))
        .catch(() => this.platform.log.error(`${this.name}: Failed to update state`));

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
