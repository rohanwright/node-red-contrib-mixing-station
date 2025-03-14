# Node-RED Mixing Station Integration

A Node-RED module to interact with Mixing Station's APIs, allowing you to control audio mixers through Mixing Station.

## Overview

This module provides nodes for Node-RED that connect to Mixing Station's REST API and WebSocket interface. It allows you to:

- Subscribe to mixer parameters and receive real-time updates
- Send commands to get or set mixer parameters
- Create automation and integration with other systems

## Prerequisites

- Node-RED (version 2.0.0 or later)
- Mixing Station (Desktop version recommended for full API support)
- Network connectivity between Node-RED and Mixing Station

## Installation

Install via the Node-RED Palette Manager or run the following command in your Node-RED user directory:

```bash
npm install node-red-contrib-mixing-station
```

## Configuration

Before using the nodes, you need to:

1. Enable the REST API in Mixing Station:
   - Open Mixing Station
   - Go to global app settings
   - Enable "HTTP REST"
   - Note the port number (default: 8080)

2. Configure the Mixing Station server in Node-RED:
   - Add a "Mixing Station Config" node
   - Set the host (e.g., "localhost" if running on the same machine)
   - Set the port to match the one configured in Mixing Station

## Nodes

### Mixing Station Config

Configuration node that stores connection details for the Mixing Station server.

- **Host**: The hostname or IP address of the machine running Mixing Station
- **Port**: The port number for the REST API (default: 8080)
- **Reconnect Interval**: Time in milliseconds to wait before attempting to reconnect (default: 5000)

### MS Subscribe

Subscribes to parameter updates from Mixing Station via WebSocket.

- **Server**: The Mixing Station Config node to use
- **Path**: The parameter path to subscribe to (e.g., "ch.*.mix.lvl" for all channel faders)
- **Format**: Value format - "val" for plain values (e.g., -5dB) or "norm" for normalized values (0-1)

The node outputs messages containing parameter updates, with the parameter values in the `payload` property.

You can also dynamically change the subscription by sending a message with:
- `path`: The new parameter path to subscribe to
- `format`: Optional. The value format to use ("val" or "norm")

### MS Command

Sends commands to Mixing Station via REST API or WebSockets.

- **Server**: The Mixing Station Config node to use
- **Path**: The API endpoint path (e.g., "/console/data/ch.0.mix.lvl")
- **Method**: HTTP method to use (GET, POST, PUT, DELETE)
- **Use WebSocket**: Whether to use WebSockets instead of HTTP

The node accepts messages with:
- `payload`: The body of the request (for POST/PUT)
- `path`: Optional. Overrides the configured path
- `method`: Optional. Overrides the configured method
- `useWebSocket`: Optional. Overrides whether to use WebSocket

## Parameter Paths

Mixing Station uses a unified path format for all mixer parameters. Some examples:

- `ch.0.mix.lvl` - Channel 1 fader level
- `ch.*.mix.lvl` - All channel fader levels (using wildcard)
- `ch.0.mix.on` - Channel 1 mute state (inverted - true means unmuted)
- `ch.0.name` - Channel 1 name
- `ch.0.eq.0.gain` - Channel 1 EQ band 1 gain
- `bus.0.mix.lvl` - Bus 1 fader level

For a complete list of available parameters, use the REST API documentation page in Mixing Station:
- Enable the REST API in Mixing Station
- Open `http://localhost:<port>` in a web browser
- Explore the available endpoints and parameter paths

## Examples

Here are some common usage examples:

### Example 1: Monitor all channel faders

1. Add an "MS Subscribe" node
2. Configure it with path `ch.*.mix.lvl` and format `val`
3. Connect to a Debug node to see the values

### Example 2: Set a channel fader level

1. Add an Inject node with payload = `-6` (for -6dB)
2. Set the Inject node's `path` property to `/console/data/ch.0.mix.lvl`
3. Connect to an "MS Command" node configured with method = POST
4. The Command node will set Channel 1's fader to -6dB when triggered

### Example 3: Mute/unmute a channel

1. Add an Inject node with payload = `false` (for muted)
2. Set the Inject node's `path` property to `/console/data/ch.0.mix.on`
3. Connect to an "MS Command" node configured with method = POST
4. The Command node will mute Channel 1 when triggered

## Troubleshooting

- **Connection Issues**: Ensure Mixing Station has the REST API enabled and the port matches your configuration
- **No Data Received**: Check that you're using the correct parameter paths and that the mixer is connected
- **Command Errors**: Verify that you're sending the correct data type for the parameter

## License

This project is licensed under the MIT License - see the LICENSE file for details.
