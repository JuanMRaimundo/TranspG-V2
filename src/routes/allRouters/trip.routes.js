import { Router } from "express";
import passport from "passport";
import {
	createTripRequest,
	assignDriver,
	getAllTrips,
	getSortedTrips,
	getTripById,
	updateTrip,
	cancelTrip,
	acknowledgeTrip,
	startTrip,
	unloadTrip,
	returnContainer,
	invoiceTrip,
	exportTripsToExcel,
} from "../../controllers/trip.controller.js";

const router = Router();

const auth = passport.authenticate("jwt", { session: false });

// 1. Lectura y Exportación (OJO: Poner 'export' ANTES de ':tripId' para evitar conflictos)
router.get("/export", auth, exportTripsToExcel); // /api/v1/trips/export
router.get("/", auth, getAllTrips);
router.get("/", auth, getSortedTrips);
router.get("/:tripId", auth, getTripById);

// 2. Creación y Edición
router.post("/request", auth, createTripRequest);
router.put("/:tripId", auth, updateTrip); // Edición general (Auditoría)

// 3. Flujo de Estados (Botones específicos)
router.put("/:tripId/assign", auth, assignDriver); // Admin asigna
router.put("/:tripId/acknowledge", auth, acknowledgeTrip); // Chofer OK
router.put("/:tripId/start", auth, startTrip); // Chofer Inicia
router.put("/:tripId/unload", auth, unloadTrip); // Chofer Descarga
router.put("/:tripId/return", auth, returnContainer); // Chofer Playo
router.put("/:tripId/invoice", auth, invoiceTrip); // Admin Factura

//4.Si se llega a cancelar el viaje
router.patch("/:tripId/cancel", auth, cancelTrip);

export default router;
