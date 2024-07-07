
import { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service, Characteristic, Logger } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { ArgoAccessory } from './accessory.js';
import { ArgoListener } from './argo/listener.js';
import { ArgoApi } from './argo/api.js';

export class ArgoPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  private readonly listener: ArgoListener | undefined;
  private readonly accessories: PlatformAccessory[] = [];
  private readonly argoAccessories: Map<string, ArgoAccessory> = new Map();

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.listener = config.usePush
      ? new ArgoListener(log, this.config.port, this.config.host, this.onPushUpdate.bind(this))
      : undefined;

    api.on('didFinishLaunching', this.onDidFinishLaunching.bind(this));
    api.on('shutdown', this.onShutdown.bind(this));
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.accessories.push(accessory);
  }

  private onDidFinishLaunching() {
    this.syncConfiguredDevices();
    this.listener?.start();
  }

  private onShutdown() {
    this.listener?.stop();
  }

  // Synchronize the configured devices with the cached accessories, creating new ones if necessary and removing old ones
  private syncConfiguredDevices() {
    // Iterate over the configured devices, adding them to the list of configured UUIDs and argo accessories
    for (const device of this.config.devices) {
      // Calculate the UUID for the configured device
      const uuid = this.api.hap.uuid.generate(device.ip);

      // Create the ArgoApi instance for the device
      const api = new ArgoApi(device.ip);

      // Check if the device already exists, if so only add the device to the list of argo accessories
      const existing = this.accessories.find(accessory => accessory.UUID === uuid);
      if (existing) {
        this.log.info('Restoring existing accessory from cache:', existing.displayName);
        this.argoAccessories.set(uuid, new ArgoAccessory(this, existing, api, device.name, device.offset));
        continue;
      }

      // If the device does not exist yet, create a new accessory and register it
      this.log.info('Registering new accessory:', device.name);
      const accessory = new this.api.platformAccessory(device.name, uuid);
      this.argoAccessories.set(uuid, new ArgoAccessory(this, accessory, api, device.name, device.offset));
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }

    // Iterate over the cached accessories, removing those that are no longer configured
    const uuids = Array.from(this.argoAccessories.keys());
    for (const accessory of this.accessories) {
      if (!uuids.includes(accessory.UUID)) {
        this.log.info('Removing obsolete accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }

  // Handle updates from the Argo listener
  private onPushUpdate(ip: string, hmi: string): void {
    // Generate the UUID for the device
    const uuid = this.api.hap.uuid.generate(ip);

    // Find the accessory for the device and update its state
    const accessory = this.argoAccessories.get(uuid);

    // If the accessory does not exist, log a warning
    if (!accessory) {
      this.log.warn('Received update for unknown device:', ip);
      return;
    }

    // Update the accessory state
    accessory.updateState(hmi);
  }
}
