import { Router } from 'express';
// Importamos el controlador que creamos antes
import { createTripRequest, assignDriver } from '../controllers/trip.controller.js';

// Si tuvieras middleware de autenticación, lo importarías aquí
// import { verifyToken } from '../middlewares/auth.js'; 

const router = Router();

// Definición de Endpoints para /api/v1/trips

// POST /api/v1/trips/request -> Crea una solicitud
// (Para probar rápido, he comentado el middleware de seguridad por ahora)
router.post('/request', /* verifyToken, */ createTripRequest);

// POST /api/v1/trips/:tripId/assign -> Asigna chofer
router.put('/:tripId/assign', /* verifyToken, verifyAdmin, */ assignDriver);

export default router;