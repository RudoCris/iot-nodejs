/**
 *****************************************************************************
 Copyright (c) 2014, 2015 IBM Corporation and other Contributors.
 All rights reserved. This program and the accompanying materials
 are made available under the terms of the Eclipse Public License v1.0
 which accompanies this distribution, and is available at
 http://www.eclipse.org/legal/epl-v10.html
 Contributors:
 Tim-Daniel Jacobi - Initial Contribution
 *****************************************************************************
 *
 */
import format from 'format';
import xhr from 'axios';
import Promise from 'bluebird';
import nodeBtoa from 'btoa';
const btoa = btoa || nodeBtoa; // if browser btoa is available use it otherwise use node module

import { isDefined, isString, isNode } from '../util/util.js';
import { default as BaseClient } from './BaseClient.js';

const WILDCARD_TOPIC = 'iot-2/cmd/+/fmt/+';
const CMD_RE = /^iot-2\/cmd\/(.+)\/fmt\/(.+)$/;
const QUICKSTART_ORG_ID = "quickstart";

export default class DeviceClient extends BaseClient {

  constructor(config){
    super(config);

    if(!isDefined(config.type)){
      throw new Error('config must contain type');
    }
    else if(!isString(config.type)){
      throw new Error('type must be a string');
    }

    if(config.org !== QUICKSTART_ORG_ID){
      if(!isDefined(config['auth-method'])){
        throw new Error('config must contain auth-method');
      }
      else if(!isString(config['auth-method'])){
        throw new Error('auth-method must be a string');
      }
      else if(config['auth-method'] !== 'token'){
        throw new Error('unsupported authentication method' + config['auth-method']);
      }

      this.mqttConfig.username = 'use-token-auth';
    }

    this.org = config.org;
    this.typeId = config.type;
    this.deviceId = config.id;
    this.deviceToken = config['auth-token'];
    this.mqttConfig.clientId = "d:" + config.org + ":" + config.type + ":" + config.id;

    console.info("IBMIoTF.DeviceClient initialized for organization : " + config.org);
  }

  connect(){
    super.connect();

    var mqtt = this.mqtt;

    this.mqtt.on('connect', () => {
      this.isConnected = true;

      if(this.retryCount === 0){
        this.emit('connect');
      }

      if(!this.isQuickstart){
        mqtt.subscribe(WILDCARD_TOPIC, { qos: 2 }, function(){});
      }
    });

    this.mqtt.on('message', (topic, payload) => {
      console.info("Message received on topic : "+ topic + " with payload : "+ payload);
      
      let match = CMD_RE.exec(topic);

      if(match){
        this.emit('command', {
          command: match[1],
          format: match[2],
          payload,
          topic
        });
      }
    });
  }

  publish(eventType, eventFormat, payload, qos){
    if (!this.isConnected) {
      console.error("Client is not connected");
      throw new Error("Client is not connected");
    }

    let topic = format("iot-2/evt/%s/fmt/%s", eventType, eventFormat);
    let QOS = qos || 0;

    console.info("Publishing to topic : "+ topic + " with payload : "+payload);

    this.mqtt.publish(topic,payload,{qos: QOS});

    return this;
  }

  publishHTTPS(eventType, eventFormat, payload){
    console.info("Publishing event of Type: "+ eventType + " with payload : "+payload);
    return new Promise((resolve, reject) => {
      let uri = format("https://%s.internetofthings.ibmcloud.com/api/v0002/device/types/%s/devices/%s/events/%s", this.org, this.typeId, this.deviceId, eventType);

      let xhrConfig = {
        url: uri,
        method: 'POST',
        data : payload,
        headers : {

        }
      };

      if(eventFormat === 'json') {
        xhrConfig.headers['Content-Type'] = 'application/json';
      }

      if(this.org !== QUICKSTART_ORG_ID) {
        xhrConfig.headers['Authorization'] = 'Basic ' + btoa('use-token-auth' + ':' + this.deviceToken);
      }
      console.log(xhrConfig);

      xhr(xhrConfig).then(resolve, reject);
    });
  }
}