// @flow

'use strict';

import Immutable from 'immutable';
import {EventEmitter} from 'fbemitter';

const APP_LOG = 'app-log';

const LevelType = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warning',
  ERROR: 'error',
  NORSERROR: 'warn_error',
};

const AllLevels = new Immutable.Set(Object.keys(LevelType).map(l => LevelType[l]));
const DefaultConsole = (...var_args) => {};
const Log = (level, func = 'log') => {
  return (...var_args) => console[func](level, ...var_args);
};
const Consoles = {
  [LevelType.DEBUG]: console.debug ? console.debug : Log(LevelType.DEBUG),
  [LevelType.INFO]: console.info ? console.info : Log(LevelType.INFO),
  [LevelType.WARN]: console.warn ? console.warn : Log(LevelType.WARN),
  [LevelType.ERROR]: console.error ? console.error : Log(LevelType.ERROR),
  [LevelType.NORSERROR]: console.warn ? Log(LevelType.ERROR, 'warn') : Log(LevelType.ERROR),
};

export default class LogReporter {

  static LevelType = LevelType;

  constructor() {
    this.__enabled = false;
    this.setLevel(LevelType.DEBUG);
    this.setConsoleLevel(LevelType.DEBUG);
    this.bypassRSOD(true);
    this.__emitter = new EventEmitter();
    this.__db = new Immutable.List();
  }

  start(): void {
    this.__enabled = true;
  }

  shutdown(): void {
    this.__enabled = false;
  }

  on(...var_args) {
    return this.__emitter.addListener('change', ...var_args);
  }

  /**
   * In dev mode, calling console.error produces a red screen of death
   * Enable this to use console.warn instead
   */
  bypassRSOD(flag) {
    this.__bypassRSOD = flag;
  }

  setLevel(level) {
    switch (level) {
      case (LevelType.DEBUG):
        this.__levels = AllLevels;
        break;
      case (LevelType.INFO):
        this.__levels = AllLevels.subtract([LevelType.DEBUG]);
        break;
      case (LevelType.WARN):
        this.__levels = AllLevels.subtract([LevelType.DEBUG, LevelType.INFO]);
        break;
      case (LevelType.ERROR):
        this.__levels = AllLevels.subtract([LevelType.DEBUG, LevelType.INFO,
                                            LevelType.WARN]);
        break;
    }
  }

  setConsoleLevel(level) {
    switch (level) {
      case (LevelType.DEBUG):
        this.__consoleLevels = AllLevels;
        break;
      case (LevelType.INFO):
        this.__consoleLevels = AllLevels.subtract([LevelType.DEBUG]);
        break;
      case (LevelType.WARN):
        this.__consoleLevels = AllLevels.subtract([LevelType.DEBUG, LevelType.INFO]);
        break;
      case (LevelType.ERROR):
        this.__consoleLevels = AllLevels.subtract([LevelType.DEBUG, LevelType.INFO,
                                            LevelType.WARN]);
        break;
    }
  }

  error(message: string, opt_extras: ?Object, noSend: ?boolean): void {
    this.report(message, opt_extras, LevelType.ERROR, noSend);
  }

  warn(message: string, opt_extras: ?Object, noSend: ?boolean): void {
    this.report(message, opt_extras, LevelType.WARN, noSend);
  }

  info(message: string, opt_extras: ?Object, noSend: ?boolean): void {
    this.report(message, opt_extras, LevelType.INFO, noSend);
  }

  debug(message: string, opt_extras: ?Object, noSend: ?boolean): void {
    this.report(message, opt_extras, LevelType.DEBUG, noSend);
  }

  /**
   * For ease of transition
   */
  log(message: string, opt_extras: ?Object, noSend: ?boolean): void {
    this.report(message, opt_extras, LevelType.INFO, noSend);
  }

  isLevelEnabled(level) {
    return this.__levels.has(level);
  }

  isConsoleLevelEnabled(level) {
    return this.__consoleLevels.has(level);
  }

  getConsoleForLevel(level) {
    if (!this.isConsoleLevelEnabled(level) || console == null) {
      return DefaultConsole;
    }

    switch (level) {
      case (LevelType.DEBUG):
      case (LevelType.INFO):
      case (LevelType.WARN):
        return Consoles[level];
      case (LevelType.ERROR):
        if (this.__bypassRSOD) {
          return Consoles[LevelType.NORSERROR];
        }
        return Consoles[level];
    }
  }

  report(message: string, opt_extras: ?Object, opt_level: ?string,
         noSend: ?boolean): void {
    let level = opt_level ? opt_level : LevelType.INFO;
    let meth = this.getConsoleForLevel(level);
    if (opt_extras != null) {
      meth(message, opt_extras);
      this.__db = this.__db.push(message + ' ' + JSON.stringify(opt_extras));
    }
    else {
      meth(message);
      this.__db = this.__db.push(message);
    }
    this.__emitter.emit('change');
    return true;
  }

  getLogs() {
    return this.__db;
  }
}

const Logger = new LogReporter();

export {Logger};
