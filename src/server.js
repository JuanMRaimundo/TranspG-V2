import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app.js";
import { sequelize } from "./models/index.js";
import socketHandler from "./sockets/socketHandler.js";

const httpServer = createServer(app);
const io = new Server(httpServer, {
	cors: {
		origin: "*", // Ajustar para producción (ej: tu frontend React)
		methods: ["GET", "POST", "PUT", "PATCH"],
	},
});

app.set("io", io);

// Inicializar lógica de Sockets
io.on("connection", (socket) => {
	console.log("Cliente conectado:", socket.id);
	socketHandler(io, socket);
});

const PORT = process.env.PORT || 3000;

// Sincronizar DB y levantar servidor
async function main() {
	try {
		await sequelize.sync({
			force: process.env.NODE_ENV === "development",
		}); /* await sequelize.sync({ alter: true }); */
		console.log("Base de datos sincronizada correctamente.");

		httpServer.listen(PORT, () => {
			console.log(`Servidor corriendo en puerto ${PORT}`);
		});
	} catch (error) {
		console.error("Error al iniciar servidor:", error);
	}
}

main();
