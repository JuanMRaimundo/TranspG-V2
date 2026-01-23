import express from "express";
import cors from "cors";
import passport from "passport";
import helmet from "helmet";
import routes from "./routes/index.js";
import jwtStrategy from "./auth/passport.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());
passport.use(jwtStrategy);
// 3. Inyección de dependencias (Opcional, pero útil para Sockets)
app.use((req, res, next) => {
	// req.io se asignará en el server.js
	next();
});

// 4. Rutas API (Versionadas)
app.use("/api/v1", routes);

// 5. Manejo de Errores Global (Siempre devuelve JSON)
app.use((err, req, res, next) => {
	console.error("Error global:", error);

	if (err.name === "SequelizeValidationError") {
		return res.status(400).json({
			message: "Datos inválidos",
			errors: err.errors.map((e) => e.message),
		});
	}

	res.status(500).json({
		message: "Error interno del servidor",
	});
});

export default app;
