// Sonoff-Tasmota Relative Humidity (and temperature) Sensor Accessory plugin for HomeBridge
// Jaromir Kopp @MacWyznawca

var Service, Characteristic;
var mqtt    = require('mqtt');

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-mqtt-humidity-tasmota", "mqtt-humidity-tasmota", RelativeHumidityTasmotaAccessory);
}

function RelativeHumidityTasmotaAccessory(log, config) {
  this.log = log;
	this.name = config["name"] || "Sonoff";
  	this.manufacturer = config['manufacturer'] || "ITEAD";
	this.model = config['model'] || "Sonoff";
	this.serialNumberMAC = config['serialNumberMAC'] || "";
	
	this.sensorPropertyName = config["sensorPropertyName"] || "Sensor";
	
  	this.url = config['url'];
  	this.topic = config['topic'];
  	if (config["activityTopic"] !== undefined) {
		this.activityTopic = config["activityTopic"];
	  	this.activityParameter = config["activityParameter"];
	}
	else {
		this.activityTopic = "";
	  	this.activityParameter = "";
	}
  this.options = {
    keepalive: 10,
    clientId: this.client_Id,
    protocolId: 'MQTT',
    protocolVersion: 4,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
    will: {
      topic: 'WillMsg',
      payload: 'Connection Closed abnormally..!',
      qos: 0,
      retain: false
    },
    username: config["username"],
    password: config["password"],
    rejectUnauthorized: false
  };

	this.service = new Service.HumiditySensor(this.name);
	this.service.addCharacteristic(Characteristic.CurrentTemperature); // Also temperature
	if(this.activityTopic !== "") {
		this.service.addOptionalCharacteristic(Characteristic.StatusActive)
	}

  this.client  = mqtt.connect(this.url, this.options);
  
    this.client.on('error', function () {
		that.log('Error event on MQTT');
	});

 	this.client.on('connect', function () {
		if (config["startCmd"] !== undefined) {
			that.client.publish(config["startCmd"], config["startParameter"]);
		}
	});

  var that = this;
  this.client.subscribe(this.topic);
  if(this.activityTopic !== ""){
	  this.client.subscribe(this.activityTopic);
  }

  this.client.on('message', function (topic, message) {
    if (topic == that.topic) {
		try {
			data = JSON.parse(message);
		}
		catch (e) {
		  that.log("JSON problem");
		}
		that.humidity = 0.0;
		that.temperature = -49.0;
		if (data === null) {
			that.temperature = parseFloat(message);
		} else if (data.hasOwnProperty("DHT")) {
			that.humidity = parseFloat(data.DHT.Humidity);
			that.temperature = parseFloat(data.DHT.Temperature);
		} else if (data.hasOwnProperty("DHT22")) {
			that.humidity = parseFloat(data.DHT22.Humidity);
			that.temperature = parseFloat(data.DHT22.Temperature);
		} else if (data.hasOwnProperty("AM2301")) {
			that.humidity = parseFloat(data.AM2301.Humidity);
			that.temperature = parseFloat(data.AM2301.Temperature);
		} else if (data.hasOwnProperty("DHT11")) {
			that.humidity = parseFloat(data.DHT11.Humidity);
			that.temperature = parseFloat(data.DHT11.Temperature);
		} else if (data.hasOwnProperty("HTU21")) {
			that.humidity = parseFloat(data.HTU21.Humidity);
			that.temperature = parseFloat(data.HTU21.Temperature);
		} else if (data.hasOwnProperty("BME280")) {
			that.humidity = parseFloat(data.BME280.Humidity);
			that.temperature = parseFloat(data.BME280.Temperature);
		} else if (data.hasOwnProperty(that.sensorPropertyName)) {
				that.humidity = parseFloat(data[that.sensorPropertyName].Humidity);
				that.temperature = parseFloat(data[that.sensorPropertyName].Temperature);
		} else {return null}
		that.service.setCharacteristic(Characteristic.CurrentTemperature, that.temperature);
		that.service.setCharacteristic(Characteristic.CurrentRelativeHumidity, that.humidity);
    } else if (topic == that.activityTopic) {
    	var status = message.toString(); 	
    	that.activeStat = status == that.activityParameter;
    	that.service.setCharacteristic(Characteristic.StatusActive, that.activeStat);
    }

  });

	this.service
	    .getCharacteristic(Characteristic.CurrentRelativeHumidity)
	    .on('get', this.getState.bind(this));
    
	this.service
	    .getCharacteristic(Characteristic.CurrentTemperature)
	    .on('get', this.getTemperature.bind(this));
    
	this.service
	    .getCharacteristic(Characteristic.CurrentTemperature)
	    .setProps({minValue: -50});
                                                
	this.service
	    .getCharacteristic(Characteristic.CurrentTemperature)
	    .setProps({maxValue: 100});
    
	    if(this.activityTopic !== "") {
			this.service
				.getCharacteristic(Characteristic.StatusActive)
				.on('get', this.getStatusActive.bind(this));
	    }
}

RelativeHumidityTasmotaAccessory.prototype.getState = function(callback) {
    callback(null, this.humidity);
}

RelativeHumidityTasmotaAccessory.prototype.getTemperature = function(callback) {
    callback(null, this.temperature);
}

RelativeHumidityTasmotaAccessory.prototype.getStatusActive = function(callback) {
    callback(null, this.activeStat);
}


RelativeHumidityTasmotaAccessory.prototype.getServices = function() {

	var informationService = new Service.AccessoryInformation();

	informationService
		.setCharacteristic(Characteristic.Name, this.name)
		.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
		.setCharacteristic(Characteristic.Model, this.model)
		.setCharacteristic(Characteristic.SerialNumber, this.serialNumberMAC);

	return [informationService, this.service];
}