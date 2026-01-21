import Trip from '../models/Trip.js';
import User from '../models/User.js';

export const createTripRequest = async (req, res) => {
    try {
        const io = req.app.get('io');
        const { 
            origin, destination, pickupDate, 
            cargoDetails, reference, containerNumber, 
            expirationDate, notes,
            targetClientId 
        } = req.body;
        
        let finalClientId;

        // --- LÓGICA DE ASIGNACIÓN DE DUEÑO ---
        if (req.user.role === 'ADMIN') {
            // Si es Admin, DEBE decirnos de quién es el viaje
            if (!targetClientId) {
                return res.status(400).json({ 
                    message: 'Como Admin, debes especificar el targetClientId (ID del Cliente dueño de la carga).' 
                });
            }
            const targetUser = await User.findByPk(targetClientId);
    
        if (!targetUser) {
             return res.status(404).json({ message: 'El cliente especificado no existe' });
              }
        finalClientId = targetClientId;
        } else {
            // Si es Cliente, el dueño es él mismo (Token)
            finalClientId = req.user.id;
        }

        // Crear el viaje
        const newTrip = await Trip.create({
            origin,
            destination,
            pickupDate, 
            cargoDetails,
            reference,
            containerNumber, 
            expirationDate,
            notes,
            clientId: finalClientId, // Aquí usamos el ID decidido arriba
            status: 'PENDING'
        });

        // Notificar
        if (io) {
            io.to('role_admin').emit('new_trip_request', {
                tripId: newTrip.id,
                origin,
                container: containerNumber,
                // Si lo creó un Admin, mostramos "Creado por Admin para Cliente X"
                creator: req.user.role === 'ADMIN' ? 'Admin' : 'Cliente' 
            });
        }

        return res.status(201).json({ success: true, data: newTrip });

    } catch (error) {
        console.error("ERROR:", error);
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
        const { driverId } = req.body; 

        // --- SEGURIDAD: SOLO ADMIN PUEDE ASIGNAR ---
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Acceso denegado. Solo Admins pueden asignar viajes.' });
        }
        // -------------------------------------------

        const trip = await Trip.findByPk(tripId);
        if (!trip) return res.status(404).json({ message: 'Viaje no encontrado' });

        // Validación extra: Verificar que el viaje esté en estado PENDING o REJECTED
        // Para no reasignar un viaje que ya está en curso
        if (trip.status !== 'PENDING' && trip.status !== 'REJECTED_BY_DRIVER') {
             return res.status(400).json({ message: 'El viaje no está disponible para asignación' });
        }

        // ... (El resto de tu código sigue igual)
        trip.driverId = driverId;
        trip.status = 'WAITING_DRIVER'; 
        await trip.save();

        if (io) {
            io.to(`user_${driverId}`).emit('trip_offer', {
                tripId: trip.id,
                origin: trip.origin,
                destination: trip.destination,
                cargo: trip.cargoDetails,
                container: trip.containerNumber,
                message: 'Tienes una nueva propuesta de viaje. ¿Aceptas?'
            });
        }

        return res.json({ success: true, message: 'Propuesta enviada al chofer', data: trip });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export const driverResponse = async (req, res) => {
    try {
        const io = req.app.get('io');
        const { tripId } = req.params;
        const { response } = req.body; // Esperamos 'ACCEPT' o 'REJECT'
        const driverId = req.user.id;

        const trip = await Trip.findByPk(tripId);
        if (!trip) return res.status(404).json({ message: 'Viaje no encontrado' });

        // Seguridad: Verificar que sea el chofer asignado
        if (trip.driverId !== driverId) {
            return res.status(403).json({ message: 'No eres el chofer asignado a este viaje' });
        }

        if (response === 'ACCEPT') {
            trip.status = 'CONFIRMED';
            await trip.save();
            
            // Avisar al Admin y al Cliente que el chofer aceptó
            if(io) io.to(`user_${trip.clientId}`).emit('trip_status', { status: 'CONFIRMED', tripId });

            return res.json({ success: true, message: 'Viaje confirmado exitosamente' });

        } else if (response === 'REJECT') {
            // Si rechaza, devolvemos el viaje al estado PENDING y quitamos al chofer
            // para que el Admin pueda asignarlo a otro.
            trip.status = 'PENDING';
            trip.driverId = null; 
            await trip.save();

            // Avisar al Admin que el chofer rechazó (¡Alerta!)
            if(io) io.to('role_admin').emit('driver_rejected', { 
                tripId, 
                message: `El chofer rechazó el viaje ${trip.reference}` 
            });

            return res.json({ success: true, message: 'Viaje rechazado. Vuelve a lista de pendientes.' });
        }

        return res.status(400).json({ message: 'Respuesta inválida (Use ACCEPT o REJECT)' });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

