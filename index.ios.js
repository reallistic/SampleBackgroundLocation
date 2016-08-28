/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 * @flow
 */

import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  ListView,
  Switch,
  View
} from 'react-native';

import {Logger} from './logger';
import Geolocation from './geolocation';

class SampleBackgroundLocation extends Component {
  constructor(props) {
    super(props);
    this.state = {
      items: new ListView.DataSource({
        rowHasChanged: (r1, r2) => r1 !== r2,
        sectionHeaderHasChanged : (s1, s2) => s1 !== s2,
      }),
      enabled: false
    }
  }

  _renderRow: Function = (message: string, sectionId: string, rowId: string) => {
    console.log('render row', message);
    return <View style={styles.row}><Text>{message}</Text></View>;
  }

  componentWillMount() {
    this._sub = Logger.on(this._onMessage, this);
    Geolocation.getState(state => {
      this.setState({enabled: state.enabled});
    });
    Geolocation.addListeners();
  }

  componentWillUnmount() {
    this._sub.remove();
  }

  _onMessage() {
    let items = {Logs: Logger.getLogs().toJS()};
    this.setState({items: this.state.items.cloneWithRowsAndSections(items)});
  }

  _toggleEnabled(value) {
    Geolocation.toggleTracking(value);
    this.setState({enabled: value});
  }

  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>
          Testing background geolocation
        </Text>
        <Switch
          value={this.state.enabled}
          onValueChange={(value) => this._toggleEnabled(value)}
          />
        <ListView
          style={styles.list}
          scrollEnabled={true}
          dataSource={this.state.items}
          renderRow={this._renderRow} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    borderWidth: 1,
  },
  list: {
    alignSelf: 'stretch',
    flex: 1,
    borderWidth: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
});

AppRegistry.registerComponent('SampleBackgroundLocation', () => SampleBackgroundLocation);
