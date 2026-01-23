import { Router } from "express";
import passport from "passport";
import {
	getDrivers,
	createDriver,
	getClients,
	createClient,
} from "../../controllers/user.controller.js";

const router = Router();

// Middleware de seguridad: Solo Admins pueden tocar estas rutas
const requireAdmin = (req, res, next) => {
	if (req.user.role !== "ADMIN") {
		return res
			.status(403)
			.json({ message: "Acceso denegado. Requiere rol ADMIN." });
	}
	next();
};

// Todas las rutas requieren estar logueado (JWT) y ser ADMIN!!!!!!!!!!!!!!!!!
router.use(passport.authenticate("jwt", { session: false }), requireAdmin);

// GET /api/v1/users/drivers -> Listar
router.get("/drivers", getDrivers);
router.get("/clients", getClients);

// POST /api/v1/users/drivers -> Crear
router.post("/drivers", createDriver);
router.post("/clients", createClient);

export default router;
