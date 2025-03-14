module.exports = function(RED) {
    const WebSocket = require('ws');
    
    function MixingStationSubscribe(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Get the Mixing Station configuration
        node.server = RED.nodes.getNode(config.server);
        node.path = config.path;
        node.format = config.format || "val"; // "val" for plain values, "norm" for normalized values
        node.connected = false;
        node.connecting = false;
        node.clientId = Date.now();
        
        if (!node.server) {
            node.error("Missing Mixing Station server configuration");
            return;
        }
        
        function connectWebSocket() {
            if (node.connected || node.connecting) return;
            
            node.connecting = true;
            node.status({fill: "yellow", shape: "dot", text: "connecting"});
            
            const ws = new WebSocket(node.server.wsUrl);
            let heartbeatInterval;
            
            ws.on('open', function() {
                node.connected = true;
                node.connecting = false;
                node.status({fill: "green", shape: "dot", text: "connected"});
                
                // Store the connection in the config node
                node.server.wsConnections[node.clientId] = ws;
                
                // Subscribe to the specified path
                if (node.path) {
                    subscribe(node.path, node.format);
                }
                
                // Setup the heartbeat/keep-alive message - CRITICAL for maintaining connection
                // Send the keep-alive message every 4 seconds (the API requires at least once every 5 seconds)
                clearInterval(heartbeatInterval);
                heartbeatInterval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        // Send heartbeat message based on format
                        const heartbeatFormat = node.format === "norm" ? "n" : "v";
                        const heartbeatMsg = {
                            path: "/hi/" + heartbeatFormat,
                            method: "GET",
                            body: null
                        };
                        try {
                            ws.send(JSON.stringify(heartbeatMsg));
                            node.debug("Sent heartbeat to Mixing Station");
                        } catch (err) {
                            node.error("Failed to send heartbeat: " + err.message);
                        }
                    }
                }, 4000);
            });
            
            ws.on('message', function(data) {
                try {
                    const message = JSON.parse(data);
                    
                    // Update status with last received timestamp
                    const now = new Date();
                    node.status({
                        fill: "green", 
                        shape: "dot", 
                        text: `connected (last msg: ${now.toLocaleTimeString()})`
                    });
                    
                    // Only forward the body of the response if it's not a heartbeat response
                    if (message.body && !message.path.startsWith("/hi/")) {
                        node.send({
                            topic: message.path,
                            payload: message.body,
                            _rawMessage: message
                        });
                    }
                    
                    // Log heartbeat responses at debug level
                    if (message.path.startsWith("/hi/")) {
                        node.debug("Received heartbeat response");
                    }
                } catch (error) {
                    node.error("Error parsing WebSocket message: " + error.message, {
                        rawData: data.toString(),
                        parseError: error.message,
                        stack: error.stack
                    });
                }
            });
            
            ws.on('close', function() {
                node.connected = false;
                node.status({fill: "red", shape: "ring", text: "disconnected"});
                delete node.server.wsConnections[node.clientId];
                
                // Clear heartbeat interval on connection close
                clearInterval(heartbeatInterval);
                
                // Try to reconnect after an interval
                node.log("WebSocket connection closed. Attempting to reconnect in " + 
                    node.server.reconnectInterval + "ms");
                setTimeout(connectWebSocket, node.server.reconnectInterval);
            });
            
            ws.on('error', function(error) {
                node.error("WebSocket error: " + error.message, {
                    websocketError: error.message,
                    stack: error.stack
                });
                node.status({fill: "red", shape: "dot", text: "error: " + error.message});
                
                // Clear heartbeat interval on error
                clearInterval(heartbeatInterval);
                
                // Close the connection on error
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            });
        }
        
        function subscribe(path, format) {
            if (!node.connected) return;
            
            const subscriptionId = `${path}:${format}`;
            
            // Check if already subscribed
            if (node.server.subscriptions[subscriptionId]) {
                return;
            }
            
            const subscriptionRequest = {
                path: "/console/data/subscribe",
                method: "POST",
                body: {
                    path: path,
                    format: format
                }
            };
            
            node.server.wsConnections[node.clientId].send(JSON.stringify(subscriptionRequest));
            
            // Store the subscription
            node.server.subscriptions[subscriptionId] = {
                path: path,
                format: format,
                timestamp: Date.now()
            };
        }
        
        // Connect when the node is initialized
        connectWebSocket();
        
        // Handle input to change subscription dynamically
        node.on('input', function(msg) {
            if (msg.path) {
                // Update subscription path
                node.path = msg.path;
                
                // Update format if provided
                if (msg.format === "val" || msg.format === "norm") {
                    node.format = msg.format;
                }
                
                if (node.connected) {
                    subscribe(node.path, node.format);
                }
            }
        });
        
        // Add more verbose debug logging
        node.on('input', function(msg) {
            node.debug("Received input message: " + JSON.stringify(msg));
            if (msg.debug === true) {
                const status = {
                    connected: node.connected,
                    connecting: node.connecting,
                    path: node.path,
                    format: node.format,
                    wsUrl: node.server.wsUrl,
                    connectionState: node.server.wsConnections[node.clientId] 
                        ? node.server.wsConnections[node.clientId].readyState 
                        : 'no connection'
                };
                node.log("Connection status: " + JSON.stringify(status));
                node.send({
                    topic: "connection-status",
                    payload: status
                });
            }
        });

        // Clean up on node removal
        node.on('close', function(done) {
            if (node.server.wsConnections[node.clientId]) {
                node.log("Closing WebSocket connection on node removal");
                node.server.wsConnections[node.clientId].close();
                delete node.server.wsConnections[node.clientId];
            }
            done();
        });
    }
    
    RED.nodes.registerType("mixing-station-subscribe", MixingStationSubscribe);
}