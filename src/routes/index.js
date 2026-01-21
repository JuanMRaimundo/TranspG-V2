import { Router } from 'express';
import tripRoutes from './trip.routes.js'; 
import authRoutes from './auth.routes.js';


const router = Router();


router.use('/auth',authRoutes)
router.use('/trips', tripRoutes);


// Ruta de salud (Health Check) - Útil para saber si la API vive
router.get('/health', (req, res) => {
    res.json({ status: 'OK', server: 'Transportes G API' });
});

export default router;