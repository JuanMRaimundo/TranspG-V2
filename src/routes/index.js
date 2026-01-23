import { Router } from "express";
import tripRoutes from "./allRouters/trip.routes.js";
import authRoutes from "./allRouters/auth.routes.js";
import userRoutes from "./allRouters/user.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/trips", tripRoutes);
router.use("/users", userRoutes);

// Ruta de salud (Health Check) - Útil para saber si la API vive
router.get("/health", (req, res) => {
	res.json({ status: "OK", server: "Transportes G API" });
});

export default router;
