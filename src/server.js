import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import sequelize from './config/database.js'; // Tu instancia Sequelize
import socketHandler from './sockets/socketHandler.js'; // Lógica de sockets separada

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Ajustar para producción (ej: tu frontend React)
        methods: ["GET", "POST"]
    }
});

app.set('io', io);

// Inicializar lógica de Sockets
io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    socketHandler(io, socket);
});

const PORT = process.env.PORT || 3000;

// Sincronizar DB y levantar servidor
sequelize.sync({ force: false }).then(() => {
    console.log('Base de datos conectada.');
    httpServer.listen(PORT, () => {
        console.log(`Servidor corriendo en puerto ${PORT}`);
    });
});