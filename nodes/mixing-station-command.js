module.exports = function(RED) {
    const WebSocket = require('ws');
    const axios = require('axios');
    
    function MixingStationCommand(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Get the Mixing Station configuration
        node.server = RED.nodes.getNode(config.server);
        node.method = config.method || "GET";
        node.path = config.path;
        node.useWebSocket = config.useWebSocket || false;
        
        if (!node.server) {
            node.error("Missing Mixing Station server configuration");
            return;
        }
        
        node.status({});
        
        // Helper function to get a WebSocket connection
        async function getWebSocket() {
            // If we already have an active connection, use it
            for (const clientId in node.server.wsConnections) {
                const ws = node.server.wsConnections[clientId];
                if (ws.readyState === WebSocket.OPEN) {
                    return ws;
                }
            }
            
            // Otherwise create a new connection
            return new Promise((resolve, reject) => {
                const ws = new WebSocket(node.server.wsUrl);
                
                ws.on('open', function() {
                    const clientId = Date.now();
                    node.server.wsConnections[clientId] = ws;
                    resolve(ws);
                });
                
                ws.on('error', function(error) {
                    reject(error);
                });
                
                // Set a timeout in case connection takes too long
                setTimeout(() => {
                    if (ws.readyState !== WebSocket.OPEN) {
                        reject(new Error("WebSocket connection timeout"));
                    }
                }, 5000);
            });
        }
        
        // Handle incoming messages
        node.on('input', async function(msg) {
            const path = msg.path || node.path;
            const method = msg.method || node.method;
            const body = msg.payload;
            const useWs = msg.useWebSocket !== undefined ? msg.useWebSocket : node.useWebSocket;
            
            if (!path) {
                node.error("No path specified");
                node.status({fill: "red", shape: "dot", text: "missing path"});
                return;
            }
            
            node.status({fill: "blue", shape: "dot", text: "sending"});
            
            try {
                let response;
                
                if (useWs) {
                    // Use WebSocket for command
                    const ws = await getWebSocket();
                    
                    const wsRequest = {
                        path: path,
                        method: method,
                        body: body
                    };
                    
                    // Create a promise to wait for the response
                    const responsePromise = new Promise((resolve, reject) => {
                        const messageHandler = (data) => {
                            try {
                                const message = JSON.parse(data);
                                
                                // Check if this is the response to our request
                                if (message.path === path && message.method === method) {
                                    // Remove the listener
                                    ws.removeListener('message', messageHandler);
                                    
                                    if (message.error) {
                                        reject(new Error(message.error));
                                    } else {
                                        resolve(message);
                                    }
                                }
                            } catch (error) {
                                // Ignore parsing errors
                            }
                        };
                        
                        // Listen for the response
                        ws.on('message', messageHandler);
                        
                        // Set a timeout
                        setTimeout(() => {
                            ws.removeListener('message', messageHandler);
                            reject(new Error("WebSocket response timeout"));
                        }, 5000);
                    });
                    
                    // Send the request
                    ws.send(JSON.stringify(wsRequest));
                    
                    // Wait for the response
                    response = await responsePromise;
                } else {
                    // Use HTTP REST API
                    const url = `${node.server.baseUrl}${path}`;
                    
                    switch (method.toUpperCase()) {
                        case 'GET':
                            response = await axios.get(url);
                            break;
                        case 'POST':
                            response = await axios.post(url, body);
                            break;
                        case 'PUT':
                            response = await axios.put(url, body);
                            break;
                        case 'DELETE':
                            response = await axios.delete(url);
                            break;
                        default:
                            throw new Error(`Unsupported method: ${method}`);
                    }
                    
                    // Extract just the data part
                    response = response.data;
                }
                
                node.status({fill: "green", shape: "dot", text: "success"});
                
                // Send the response
                msg.payload = response;
                node.send(msg);
                
                // Reset status after a delay
                setTimeout(() => {
                    node.status({});
                }, 2000);
            } catch (error) {
                node.error(`Error sending command: ${error.message}`, msg);
                node.status({fill: "red", shape: "dot", text: error.message});
                
                // Reset status after a delay
                setTimeout(() => {
                    node.status({});
                }, 5000);
            }
        });
    }
    
    RED.nodes.registerType("mixing-station-command", MixingStationCommand);
}