# Homebridge Argo

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![Downloads](https://img.shields.io/npm/dt/homebridge-argo.svg)](https://www.npmjs.com/package/homebridge-argo)
[![Version](https://img.shields.io/npm/v/homebridge-argo.svg)](https://www.npmjs.com/package/homebridge-argo)
[![GitHub issues](https://img.shields.io/github/issues/0skillallluck/homebridge-argo)](https://github.com/0skillallluck/homebridge-argo/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/0skillallluck/homebridge-argo)](https://github.com/0skillallluck/homebridge-argo/pulls)

</span>

## Homebridge plugin for Argo air conditioners

This [Homebridge](https://github.com/homebridge/homebridge) plugin exposes [Argo](https://www.argoclima.com/en/) air conditioners,
capable of WiFi, to Apple's [HomeKit](https://www.apple.com/ios/home/).

*Currently only the **Ulisse 13 DCI Eco WiFi** is confirmed to work*

### Configuration

To configure the plugin simply install it and use the config UI to configure.

Alternatively you can configure it using the `config.json` file of Homebridge. Simply add the **Argo** platform to the platforms and configure your devices.
 
```json
  "platforms": [
    {
      "platform": "Argo",
      "devices": [
        {
          "name": "Example Display Name",
          "ip": "192.168.5.30"
        }
      ]
    }
  ]
```

### Advanced device settings

In some cases Argo devices don't accurately report the temperate. In those cases you can set a offset in the device configuration to
help compensate for the inaccuracy.

```json
  "platforms": [
    {
      "platform": "Argo",
      "devices": [
        {
          "name": "Example Display Name",
          "ip": "192.168.5.30",
          "offset": 2.5,
        }
      ]
    }
  ]
```

In the above example the temperature would be adjusted by 2.5 degrees. Meaning that the read temperature will be 2.5 degrees higher
and all settings will be 2.5 degrees lower to compensate. *this also affects min/max setpoints*

### Advanced settings

Argo devices have a lot of issues with their connectivity as they seem to require a connection to their home server.
To help with this we can let the device push updates to Homebridge instead of polling the device constantly.
As the device is configured to only communicate with its home serverwe need to redirect traffic to that server to our Homebridge instance instead.

To achieve this first we need to start the listener build into this plugin, you can do so by setting the `usePush` flag to true and defining a `port` to use.
After changing the config restart homebridge.

```json
  "platforms": [
    {
      "platform": "Argo",
      "devices": [
        {
          "name": "Example Display Name",
          "ip": "192.168.5.30"
        }
      ],
      "usePush": true,
      "port": 42420
    }
  ]
```

Afterwards you need to tell your router to redirect traffic to your Homebridge instance. You can do so by running:

```bash
iptables -t nat -I PREROUTING -s 0.0.0.0/0 -d 31.14.128.210 -p tcp -j DNAT --to-destination <your-homebridge-ip>:<your-port>
```

After this the Plugin will no longer poll but will listen for updates from the device instead.


To remove the traffic redirect in the future just run:
```bash
iptables -t nat -D PREROUTING -s 0.0.0.0/0 -d 31.14.128.210 -p tcp -j DNAT --to-destination <your-homebridge-ip>:<your-port>
```

#### Alternative setup

You can alternatively configure the homebridge server with the IP `31.14.128.210` and tell your router to statically route `31.14.128.210`
to your homebridge instance.

If you decide to do so please configure the listener to listen on port 80 and 31.14.128.210

```json
  "platforms": [
    {
      "platform": "Argo",
      "devices": [
        {
          "name": "Example Display Name",
          "ip": "192.168.5.30"
        }
      ],
      "usePush": true,
      "port": 80,
      "host": "31.14.128.210",
    }
  ]
```