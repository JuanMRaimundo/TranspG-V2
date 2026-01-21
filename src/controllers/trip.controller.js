import Trip from '../models/Trip.js';
import User from '../models/User.js';

export const createTripRequest = async (req, res) => {
    try {
        const { origin, destination, cargoDetails } = req.body;
        const clientId = req.user.id; // Asumiendo que JWT middleware populó req.user

        // 1. Persistencia DB
        const newTrip = await Trip.create({
            origin,
            destination,
            cargoDetails,
            clientId,
            status: 'PENDING'
        });

        // 2. Real-Time: Notificar a TODOS los Admins
        // Usamos req.io que inyectamos en server.js
        req.io.to('role_admin').emit('new_trip_request', {
            tripId: newTrip.id,
            origin,
            destination,
            clientName: req.user.firstName // Dato útil para el dashboard
        });

        // 3. Respuesta JSON (Sin redirección)
        return res.status(201).json({
            success: true,
            data: newTrip,
            message: 'Solicitud creada exitosamente'
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const assignDriver = async (req, res) => {
    try {
        const { tripId } = req.params;
        const { driverId } = req.body; // ID del chofer seleccionado por el Admin

        const trip = await Trip.findByPk(tripId);
        if (!trip) return res.status(404).json({ message: 'Viaje no encontrado' });

        // 1. Actualizar DB
        trip.driverId = driverId;
        trip.status = 'CONFIRMED';
        await trip.save();

        // 2. Real-Time: Notificar al Chofer específico
        // Asumimos que el chofer está en una sala con su propio ID: 'user_UUID'
        req.io.to(`user_${driverId}`).emit('trip_assigned', {
            tripId: trip.id,
            origin: trip.origin,
            destination: trip.destination,
            message: '¡Tienes un nuevo viaje asignado!'
        });

        // Opcional: Notificar al cliente que su viaje fue confirmado
        req.io.to(`user_${trip.clientId}`).emit('trip_status_update', {
            tripId: trip.id,
            status: 'CONFIRMED'
        });

        return res.json({ success: true, data: trip });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};