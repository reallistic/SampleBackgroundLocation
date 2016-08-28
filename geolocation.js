// @flow

'use strict';

import Immutable from 'immutable';
import BackgroundGeolocation from 'react-native-background-geolocation';
import {EventEmitter} from 'fbemitter';
import {Logger} from './logger';
const {RNBackgroundGeolocation} = require('react-native').NativeModules;


class ConfigStore {
  constructor(): void {
    this.__isConfigured = false;
    this.__harvester = null;
    this.__preferences = new Immutable.Map();
    this.__harvestCallbacks = new Immutable.List();
    this.__eventSubscriptions = new Immutable.List();
  }

  update(data: Object): void {
    this.__preferences = this.__preferences.merge(data);
  }

  isConfigured(): boolean {
    return this.__isConfigured;
  }

  setEventSubscriptions(...var_args) {
    this.__eventSubscriptions = this.__eventSubscriptions.push(...var_args);
  }

  getEventSubscriptions() {
    return this.__eventSubscriptions;
  }

  setConfigured(flag: boolean): void {
    this.__isConfigured = flag;
  }

  setHarvester(harvester: Object): void {
    this.__harvester = harvester;
    this.__harvestCallbacks.forEach(cb => cb(harvester));
    this.__harvestCallbacks = new Immutable.List();
  }

  onHarvesterReady(cb: Function): void {
    if (this.__harvester != null) {
      cb(this.__harvester);
    }
    else {
      this.__harvestCallbacks = this.__harvestCallbacks.push(cb);
    }
  }

  getDatumId(): string {
    return this.__preferences.get('datum_id');
  }

  getDatumType(): string {
    return this.__preferences.get('datum_type');
  }
}


const Preferences = new ConfigStore();


function getConfig(): Object {
  let rv = {
    /** Geolocation Config **/
    desiredAccuracy: 0,
    stationaryRadius: 25,
    distanceFilter: 20,
    stopAfterElapsedMinutes: 0,
    stationaryRadius: 10,
    activityType: 'Other',
    disableElasticity: false,
    /** Activity Recognition **/
    activityRecognitionInterval: 10000,
    // Allow 1 minutes of still before turning off GPS
    stopTimeout: 1,
    stopDetectionDelay: 0,
    /** Application config **/
    debug: true,
    preventSuspend: false,
    // Allow background tracking when user closes the app.
    stopOnTerminate: false,
    // Auto start tracking when device is powered-up.
    startOnBoot: true,
    heartbeatInterval: 60,
    maxRecordsToPersist: -1,
    maxDaysToPersist: 1,

    /** HTTP Settings */
    url: 'http://posttestserver.com/post.php?dir=ionic-cordova-background-geolocation',
    autoSync: true,
    batchSync: false,
    maxBatchSync: 250,
  };
  Logger.debug('geolocation getConfig', rv);
  return rv;
}


function log_log(): void {
  BackgroundGeolocation.getLog(log => {
    Logger.debug('background geo log:', {log});
  });
}


function beginBackgroundTask(cb: Function): void {
  RNBackgroundGeolocation.beginBackgroundTask(cb);
}


function finish(taskId: string): void {
  // Ask for an additional 1sec so promises and async actions
  // can finish firing
  Logger.debug('finishing background task ' + taskId + 'calling finish in 20ms');
  setTimeout(() => {
    Logger.debug('calling background task finish');
    BackgroundGeolocation.finish(taskId);
  }, 20);
}


function configure(opt_cb: ?Function): void {
  BackgroundGeolocation.configure(getConfig(), state => {
    Preferences.setConfigured(true);
    if (opt_cb != null) {
      opt_cb();
    }
  });
}


function getCurrentLocation(): EventEmitter {
  let action = new EventEmitter();
  BackgroundGeolocation.getCurrentPosition(location => {
    action.location = location;
    action.emit('change');
  },
  errorCode => {
    Logger.warn('get current position failed', {errorCode});
    action.error = errorCode;
    action.emit('change');
  });
  return action;
}


function addListeners(): void {
  // This handler fires whenever bgGeo receives a location update.
  let locationSub = BackgroundGeolocation.onLocation(location => {
    let payload = {
      datum_id: Preferences.getDatumId(),
      datum_type: Preferences.getDatumType(),
      lat: location.coords.latitude,
      lon: location.coords.longitude,
    };
    Logger.debug('on background location', {lat: payload.lat, lon: payload.lon});
  });
  Preferences.setEventSubscriptions(locationSub);

  // This handler fires whenever bgGeo receives an error
  let errorSub = BackgroundGeolocation.onError(error => {
    var type = error.type;
    var code = error.code;
    //TODO: Send this error somewhere
    Logger.warn('Error with background geolocation', {type, code});
  });
  Preferences.setEventSubscriptions(errorSub);

  // This event fires when a chnage in motion activity is detected
  let activitySub = BackgroundGeolocation.on('activitychange', activityName => {
    // eg: 'on_foot', 'still', 'in_vehicle'
    Logger.debug('- Current motion activity: ', {activityName});
  });
  Preferences.setEventSubscriptions(activitySub);

  // This event fires when the user toggles location-services
  let providerSub = BackgroundGeolocation.on('providerchange', provider => {
    Logger.debug('- Location provider changed: ',
                 {providerEnabled: provider.enabled});
    // TODO: Need to figure out how to handle this
  });
  Preferences.setEventSubscriptions(providerSub);

  // This event fires when the motion changes
  let motionSub = BackgroundGeolocation.onMotionChange(motion => {
    Logger.debug('- Location motion changed: ',
                 {motion: motion});
  });
  Preferences.setEventSubscriptions(motionSub);

  // This event fires when the geoFence changes
  let geoFenceSub = BackgroundGeolocation.onGeofence(fence => {
    Logger.debug('- Location geofence changed: ', {fence});
  });
  Preferences.setEventSubscriptions(geoFenceSub);
}

function removeListeners(): void {
  let subs = Preferences.getEventSubscriptions();
  subs.forEach(sub => sub.remove());
}


function startTracking(opt_flowAction): void {
  BackgroundGeolocation.start(() => {
    if (opt_flowAction != null) {
      opt_flowAction.gotoNextStep();
    }
  });
}


function reconfigure(opt_flowAction): void {
  BackgroundGeolocation.setConfig(getConfig(), state => {
    Logger.debug('backgroundgeolocation enabled -> ' + state.enabled);
    if (!state.enabled) {
      Logger.debug('preferences want tracking but geolocation disabled, starting');
      startTracking(opt_flowAction);
    }
    else if (opt_flowAction != null) {
      opt_flowAction.gotoNextStep();
    }
  });
}


function stopTracking(opt_flowAction): void {
  BackgroundGeolocation.stop(() => {
    Logger.debug('********background location stop callback');
  });
  if (opt_flowAction != null) {
    opt_flowAction.gotoNextStep();
  }
}


function getLocationDBCount(opt_flowAction): void {
  BackgroundGeolocation.getCount((count) => {
    Logger.debug('********background location count ' + count);
  });
  if (opt_flowAction != null) {
    opt_flowAction.gotoNextStep();
  }
}


function clearLocationDB(opt_flowAction): void {
  BackgroundGeolocation.clearDatabase(() => {
    Logger.debug('********background location db cleared');
    if (opt_flowAction != null) {
      opt_flowAction.gotoNextStep();
    }
  });
}


function getState(cb) {
  BackgroundGeolocation.getState(cb);
}


function toggleTracking(enabled: boolean, opt_flowAction): void {
  BackgroundGeolocation.getState(state => {
    Logger.debug('toggleTracking state to ' + enabled + ' current state ' + state.enabled);
    let idx = (enabled + '__' + state.enabled);
    switch(idx) {
      case 'true__false': // Preference enabled, state disabled
        reconfigure(opt_flowAction);
      break;
      case 'true__true': // Preference enabled, state enabled
        //reconfigure(opt_flowAction);
        if (opt_flowAction) {
          opt_flowAction.gotoNextStep();
        }
      break;
      case 'false__true': // Preference disabled, state enabled
        stopTracking(opt_flowAction);
      break;
    }
  });
}


export default {
  addListeners,
  removeListeners,
  toggleTracking,
  isConfigured: Preferences.isConfigured.bind(Preferences),
  setConfigured: Preferences.setConfigured.bind(Preferences),
  setHarvester: Preferences.setHarvester.bind(Preferences),
  updatePreferences: Preferences.update.bind(Preferences),
  configure,
  finish,
  getCurrentLocation,
  beginBackgroundTask,
  log_log,
  getLocationDBCount,
  clearLocationDB,
  getState,
}
