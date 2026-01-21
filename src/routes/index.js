import { Router } from 'express';
// Importamos las rutas específicas (que crearemos en el siguiente paso)
import tripRoutes from './trip.routes.js'; 
// import userRoutes from './user.routes.js'; // (Futuro)

const router = Router();

/**
 * RUTAS PRINCIPALES
 * Aquí prefijamos las rutas.
 * Ejemplo: Todas las rutas de 'tripRoutes' empezarán con /trips
 */
router.use('/trips', tripRoutes);
// router.use('/users', userRoutes);

// Ruta de salud (Health Check) - Útil para saber si la API vive
router.get('/health', (req, res) => {
    res.json({ status: 'OK', server: 'Transportes G API' });
});

export default router;