import { Router } from "express";
import passport from "passport";
import {
	createTripRequest,
	assignDriver,
	driverResponse,
	getAllTrips,
	getSortedTrips,
	finishTrip,
	getTripById,
	updateTrip,
	cancelTrip,
} from "../../controllers/trip.controller.js";

const router = Router();

// --- 1. Rutas Estáticas (Primero) ---

// GET /api/v1/trips/ -> Obtener todos los viajes (según rol)
router.get(
	"/", // Esto equivale a /api/v1/trips porque el router ya está montado ahí
	passport.authenticate("jwt", { session: false }),
	getAllTrips,
);
router.get(
	"/",
	passport.authenticate("jwt", { session: false }),
	getSortedTrips,
);
router.get(
	"/:tripId",
	passport.authenticate("jwt", { session: false }),
	getTripById,
);

// POST /api/v1/trips/request -> Crear solicitud
router.post(
	"/request",
	passport.authenticate("jwt", { session: false }),
	createTripRequest,
);
(router.put(
	"/:tripId",
	passport.authenticate("jwt", { session: false }),
	updateTrip,
),
	// --- 2. Rutas Dinámicas (Después) ---
	// PUT /api/v1/trips/:tripId/assign -> Admin asigna chofer (Propuesta)
	router.put(
		"/:tripId/assign",
		passport.authenticate("jwt", { session: false }),
		assignDriver,
	));

// POST /api/v1/trips/:tripId/response -> Chofer responde (Acepta/Rechaza)
router.patch(
	"/:tripId/responseDriver",
	passport.authenticate("jwt", { session: false }),
	driverResponse,
);

// PUT /api/v1/trips/:tripId/status -> Chofer actualiza estado (En curso, Finalizado)
router.post(
	"/:tripId/finish",
	passport.authenticate("jwt", { session: false }),
	finishTrip,
);
router.patch(
	"/:tripId/cancel",
	passport.authenticate("jwt", { session: false }),
	cancelTrip,
);

export default router;
