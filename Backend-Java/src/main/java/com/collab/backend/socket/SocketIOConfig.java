package com.collab.backend.socket;

import com.corundumstudio.socketio.Configuration;
import com.corundumstudio.socketio.SocketIOServer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;

/**
 * Boots a netty-socketio server so the frontend's socket.io-client connects
 * unchanged. Runs on its own port (SOCKETIO_PORT) alongside the Spring MVC
 * server. Origin is left open (like the Node `cors: { origin: '*' }`); auth is
 * enforced by the JWT handshake in SocketAuthListener.
 */
@org.springframework.context.annotation.Configuration
public class SocketIOConfig {

    @Bean
    public SocketIOServer socketIOServer(@Value("${app.socketio.port}") int port) {
        Configuration config = new Configuration();
        config.setPort(port);
        config.setOrigin(null); // allow all origins (matches Node origin:'*')
        // Long-poll + websocket both supported by default.
        return new SocketIOServer(config);
    }
}
