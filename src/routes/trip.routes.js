import { Router } from 'express';
import passport from 'passport';
import { 
    createTripRequest, 
    assignDriver, 
    updateTripStatus, 
    driverResponse 
} from '../controllers/trip.controller.js';

const router = Router();

// --- 1. Rutas Estáticas (Primero) ---
// POST /api/v1/trips/request -> Crear solicitud
router.post(
    '/request',
    passport.authenticate('jwt', { session: false }), 
    createTripRequest
);

// --- 2. Rutas Dinámicas (Después) ---
// PUT /api/v1/trips/:tripId/assign -> Admin asigna chofer (Propuesta)
router.put(
    '/:tripId/assign', 
    passport.authenticate('jwt', { session: false }), 
    assignDriver
);

// POST /api/v1/trips/:tripId/response -> Chofer responde (Acepta/Rechaza)
router.post(
    '/:tripId/response', 
    passport.authenticate('jwt', { session: false }), 
    driverResponse
);

// PUT /api/v1/trips/:tripId/status -> Chofer actualiza estado (En curso, Finalizado)
router.put(
    '/:tripId/status',
    passport.authenticate('jwt', { session: false }),
    updateTripStatus
);

export default router;