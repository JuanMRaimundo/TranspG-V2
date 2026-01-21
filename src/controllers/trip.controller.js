import Trip from '../models/Trip.js';
import User from '../models/User.js';

export const createTripRequest = async (req, res) => {
    try {
        const io = req.app.get('io');
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

        if (io) {
            io.to('role_admin').emit('new_trip_request', {
                tripId: newTrip.id,
                origin,
                destination,
                clientName: req.user.firstName 
            });
            console.log('Evento new_trip_request emitido a Admins');
        } else {
            console.error('Error: Socket.io no inicializado en el controller');
        }

        // 3. Respuesta
        return res.status(201).json({
            success: true,
            data: newTrip,
            message: 'Solicitud creada exitosamente'
        });

    } catch (error) {
        console.error("ERROR EN CREATE TRIP:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const updateTripStatus = async (req, res) => {
    try {
        const io = req.app.get('io'); // Recuperamos socket
        const { tripId } = req.params;
        const { status } = req.body; // Ej: 'IN_PROGRESS', 'FINISHED'
        const driverId = req.user.id; // El chofer que hace la petición

        const trip = await Trip.findByPk(tripId);

        if (!trip) return res.status(404).json({ message: 'Viaje no encontrado' });

        // Validación de seguridad: Solo el chofer asignado puede tocar este viaje
        if (trip.driverId !== driverId) {
            return res.status(403).json({ message: 'No tienes permiso para modificar este viaje' });
        }

        // 1. Actualizar DB
        trip.status = status;
        await trip.save();

        // 2. Notificar al Cliente (Real-Time)
        // Le avisamos al pasajero: "Tu viaje ha finalizado" o "Tu chofer está en camino"
        if (io) {
            io.to(`user_${trip.clientId}`).emit('trip_status_update', {
                tripId: trip.id,
                status: status,
                message: `El estado de tu viaje cambió a: ${status}`
            });
        }

        return res.json({ success: true, data: trip });

    } catch (error) {
        console.error("ERROR EN UPDATE STATUS:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const assignDriver = async (req, res) => {
    try {
        const io = req.app.get('io');
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
        if (io) {
            // Notificar al Chofer
            io.to(`user_${driverId}`).emit('trip_assigned', {
                tripId: trip.id,
                origin: trip.origin,
                destination: trip.destination,
                message: '¡Tienes un nuevo viaje asignado!'
            });

            // Notificar al Cliente
            io.to(`user_${trip.clientId}`).emit('trip_status_update', {
                tripId: trip.id,
                status: 'CONFIRMED'
            });
        }

        return res.json({ success: true, data: trip });

    } catch (error) {
        console.error("ERROR EN ASSIGN DRIVER:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

