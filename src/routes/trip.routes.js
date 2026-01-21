import { Router } from 'express';
import passport from 'passport'
// Importamos el controlador que creamos antes
import { createTripRequest, assignDriver, updateTripStatus } from '../controllers/trip.controller.js';

// Si tuvieras middleware de autenticación, lo importarías aquí
// import { verifyToken } from '../middlewares/auth.js'; 

const router = Router();

// Definición de Endpoints para /api/v1/trips

// POST /api/v1/trips/request -> Crea una solicitud
// (Para probar rápido, he comentado el middleware de seguridad por ahora)
router.post('/request',passport.authenticate('jwt',{session:false}) ,createTripRequest);

router.put(
    '/:tripId/status',
    passport.authenticate('jwt', { session: false }),
    updateTripStatus
);
router.put('/:tripId/assign', passport.authenticate('jwt', { session: false }), assignDriver);

export default router;