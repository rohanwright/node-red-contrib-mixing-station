module.exports = function(RED) {
    function MixingStationConfig(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.host = config.host || 'localhost';
        node.port = config.port || 8080;
        node.reconnectInterval = config.reconnectInterval || 5000;
        
        // Store the base URL for HTTP requests
        node.baseUrl = `http://${node.host}:${node.port}`;
        
        // Store the WebSocket URL
        node.wsUrl = `ws://${node.host}:${node.port}`;
        
        // Keep track of WebSocket connections and subscriptions
        node.wsConnections = {};
        node.subscriptions = {};
        
        // Clean up connections when node is closed
        node.on('close', function(done) {
            for (const clientId in node.wsConnections) {
                if (node.wsConnections[clientId]) {
                    node.wsConnections[clientId].close();
                }
            }
            node.wsConnections = {};
            node.subscriptions = {};
            done();
        });
    }
    
    RED.nodes.registerType("mixing-station-config", MixingStationConfig, {
        settings: {
            mixingStationConfigDefaults: {
                value: {
                    host: { value: "localhost", required: true },
                    port: { value: 8080, required: true },
                    reconnectInterval: { value: 5000, required: true }
                }
            }
        }
    });
}