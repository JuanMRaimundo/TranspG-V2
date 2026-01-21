import express from 'express';
import cors from 'cors';
import passport from 'passport';
import helmet from 'helmet'; 
import routes from './routes/index.js';

const app = express();

// 1. Middlewares Esenciales
app.use(helmet());
app.use(cors()); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Seguridad e Inicialización
app.use(passport.initialize());
// Aquí iría tu configuración de estrategia JWT (passport.use...)

// 3. Inyección de dependencias (Opcional, pero útil para Sockets)
app.use((req, res, next) => {
    // req.io se asignará en el server.js
    next();
});

// 4. Rutas API (Versionadas)
app.use('/api/v1', routes);

// 5. Manejo de Errores Global (Siempre devuelve JSON)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Internal Server Error', 
        error: process.env.NODE_ENV === 'dev' ? err.message : {} 
    });
});

export default app;