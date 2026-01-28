import Trip from "../models/Trip.js";
import User from "../models/User.js";

export const getTripById = async (req, res) => {
	try {
		const { tripId } = req.params;
		const trip = await Trip.findByPk(tripId);
		res.json({ succes: true, data: trip });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message });
	}
};

export const getAllTrips = async (req, res) => {
	try {
		const currentUser = req.user; // Viene del Token
		let whereClause = {};

		// --- FILTROS DE SEGURIDAD ---
		if (currentUser.role === "CLIENT") {
			// El cliente solo ve SUS propios viajes
			whereClause.clientId = currentUser.id;
		} else if (currentUser.role === "DRIVER") {
			// El chofer solo ve los viajes que le asignaron
			whereClause.driverId = currentUser.id;
		}
		// Si es ADMIN, 'whereClause' se queda vacío y ve TODO.

		const trips = await Trip.findAll({
			where: whereClause,
			include: [
				// Incluimos datos del cliente para mostrar nombre en lugar de solo ID
				{
					model: User,
					as: "client",
					attributes: ["firstName", "lastName", "email"],
				},
				// Incluimos datos del chofer si lo hay
				{
					model: User,
					as: "driver",
					attributes: ["firstName", "lastName"],
				},
			],
			order: [["createdAt", "DESC"]], // Los más recientes primero
		});

		// Devolvemos el array directamente o dentro de un objeto data
		return res.json({ success: true, data: trips });
	} catch (error) {
		console.error("Error al obtener viajes:", error);
		return res.status(500).json({ success: false, error: error.message });
	}
};

export const getSortedTrips = async (req, res) => {
	try {
		const { sortBy = "pickupDate", sortDir = "DESC" } = req.query;
		const currentUser = req.user;
		let whereClause = {};

		// --- FILTROS DE SEGURIDAD ---
		if (currentUser.role === "CLIENT") {
			// El cliente solo ve SUS propios viajes
			whereClause.clientId = currentUser.id;
		} else if (currentUser.role === "DRIVER") {
			// El chofer solo ve los viajes que le asignaron
			whereClause.driverId = currentUser.id;
		}

		const trips = await Trip.findAll({
			where: whereClause,
			include: [
				// Incluimos datos del cliente para mostrar nombre en lugar de solo ID
				{
					model: User,
					as: "client",
					attributes: ["firstName", "lastName", "email"],
				},
				// Incluimos datos del chofer si lo hay
				{
					model: User,
					as: "driver",
					attributes: ["firstName", "lastName"],
				},
			],
			order: [
				[sortBy, sortDir],
				["expirationDate", sortDir],
			], // Los más recientes primero
		});
		res.json({
			success: true,
			data: trips,
		});
	} catch (error) {
		console.error("Error al obtener viajes:", error);
		return res.status(500).json({ success: false, error: error.message });
	}
};

export const createTripRequest = async (req, res) => {
	try {
		const io = req.app.get("io");
		const {
			origin,
			destination,
			pickupDate,
			cargoDetails,
			reference,
			containerNumber,
			expirationDate,
			notes,
			targetClientId,
		} = req.body;

		let finalClientId;

		// --- LÓGICA DE ASIGNACIÓN DE DUEÑO ---
		if (req.user.role === "ADMIN") {
			// Si es Admin, DEBE decirnos de quién es el viaje
			if (!targetClientId) {
				return res.status(400).json({
					message:
						"Como Admin, debes especificar el ID del Cliente dueño de la carga).",
				});
			}
			const targetUser = await User.findByPk(targetClientId);

			if (!targetUser) {
				return res
					.status(404)
					.json({ message: "El cliente especificado no existe" });
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
			status: "PENDING",
		});

		// Notificar
		if (io) {
			io.to("role_admin").emit("new_trip_request", {
				tripId: newTrip.id,
				origin,
				container: containerNumber,
				// Si lo creó un Admin, mostramos "Creado por Admin para Cliente X"
				creator: req.user.role === "ADMIN" ? "Admin" : "Cliente",
				creatorId: req.user.firstName,
			});
			// 2. NUEVO: Avisar al CLIENTE dueño del viaje (Si no fue él mismo quien lo creó)
			// finalClientId es la variable que definiste arriba en tu lógica
			if (finalClientId && finalClientId !== req.user.id) {
				io.to(`user_${finalClientId}`).emit("trip_status", {
					status: "PENDING",
					message: `Se ha generado un nuevo viaje (Ref: ${reference}) para ti.`,
					tripId: newTrip.id,
					reference: reference,
				});
			}
		}

		return res.status(201).json({ success: true, data: newTrip });
	} catch (error) {
		console.error("ERROR:", error);
		return res.status(500).json({ success: false, error: error.message });
	}
};
export const updateTrip = async (req, res) => {
	try {
		const io = req.app.get("io");
		const { tripId } = req.params;
		const {
			origin,
			destination,
			pickupDate,
			cargoDetails,
			reference,
			containerNumber,
			expirationDate,
			notes,
			targetClientId,
		} = req.body;
		const trip = await Trip.findByPk(tripId);
		if (!trip) {
			return res.status(404).json({
				success: false,
				message: "Viaje no encontrado",
			});
		}
		const updateData = {
			origin,
			destination,
			pickupDate,
			cargoDetails,
			reference,
			containerNumber,
			expirationDate,
			notes,
			targetClientId,
		};
		const [updatedRows] = await Trip.update(updateData, {
			where: { id: tripId },
			individualHooks: true, // para evitar confusiones y posibles engaños.
		});
		if (updatedRows === 0) {
			return res.status(400).json({
				success: false,
				message: "No se pudo actualizar el viaje o no hubo cambios",
			});
		}

		// --- NOTIFICACIÓN POR SALAS (Tu arquitectura) ---

		// 1. Avisar al Cliente (Si existe)
		if (trip.clientId && io) {
			io.to(`user_${trip.clientId}`).emit("trip_updated", {
				message: "Tu viaje ha sido modificado",
				trip,
			});
		}

		// 2. Avisar al Chofer (Si ya tiene uno asignado)
		if (trip.driverId && io) {
			io.to(`user_${trip.driverId}`).emit("trip_updated", {
				message: "Los detalles del viaje han cambiado",
				trip,
			});
		}

		res.status(200).json({ success: true, message: "Viaje editado", trip });
	} catch (error) {
		if (error.name === "SequelizeValidationError") {
			const errors = error.errors.map((err) => err.message);
			return res.status(400).json({
				message: "Datos inválidos",
				errors,
			});
		}
		res.status(500).json({
			success: false,
			message: "Error interno del servidor",
			error: error.message,
		});
	}
};

export const assignDriver = async (req, res) => {
	try {
		const io = req.app.get("io");
		const { tripId } = req.params;
		const { driverId } = req.body;

		// --- SEGURIDAD: SOLO ADMIN PUEDE ASIGNAR ---
		if (req.user.role !== "ADMIN") {
			return res.status(403).json({
				message: "Acceso denegado. Solo Admins pueden asignar viajes.",
			});
		}
		// -------------------------------------------

		const trip = await Trip.findByPk(tripId);
		if (!trip) return res.status(404).json({ message: "Viaje no encontrado" });

		// Validación extra: Verificar que el viaje esté en estado PENDING o REJECTED
		// Para no reasignar un viaje que ya está en curso
		if (trip.status !== "PENDING" && trip.status !== "REJECTED_BY_DRIVER") {
			return res
				.status(400)
				.json({ message: "El viaje no está disponible para asignación" });
		}

		// ... (El resto de tu código sigue igual)
		trip.driverId = driverId;
		trip.status = "WAITING_DRIVER";
		await trip.save();

		if (io) {
			io.to(`user_${driverId}`).emit("trip_offer", {
				tripId: trip.id,
				origin: trip.origin,
				destination: trip.destination,
				cargo: trip.cargoDetails,
				container: trip.containerNumber,
				message: "Tienes una nueva propuesta de viaje. ¿Aceptas?",
			});
		}

		return res.json({
			success: true,
			message: "Propuesta enviada al chofer",
			data: trip,
		});
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const driverResponse = async (req, res) => {
	try {
		const io = req.app.get("io");
		const { tripId } = req.params;
		const { responseDriver } = req.body; // Esperamos 'ACCEPT' o 'REJECT'
		const driverId = req.user.id;

		const trip = await Trip.findByPk(tripId);
		if (!trip) return res.status(404).json({ message: "Viaje no encontrado" });

		// Seguridad: Verificar que sea el chofer asignado
		if (trip.driverId !== driverId) {
			return res
				.status(403)
				.json({ message: "No eres el chofer asignado a este viaje" });
		}

		if (responseDriver === "ACCEPT") {
			trip.status = "CONFIRMED";
			await trip.save();

			// Avisar al Admin y al Cliente que el chofer aceptó
			if (io)
				io.to(`user_${trip.clientId}`).emit("trip_status", {
					status: "CONFIRMED",
					tripId,
					reference: trip.reference,
					message: `El chofer ha ACEPTADO tu viaje (Ref: ${trip.reference})`,
				});

			return res.json({
				success: true,
				message: "Viaje confirmado exitosamente",
			});
		} else if (responseDriver === "REJECT") {
			// Si rechaza, devolvemos el viaje al estado PENDING y quitamos al chofer
			// para que el Admin pueda asignarlo a otro.
			trip.status = "PENDING";
			trip.driverId = null;
			await trip.save();

			// Avisar al Admin que el chofer rechazó (¡Alerta!)
			if (io)
				io.to("role_admin").emit("driver_rejected", {
					tripId,
					reference: trip.reference,
					message: `El chofer rechazó el viaje ${trip.reference}`,
				});

			return res.json({
				success: true,
				message: "Viaje rechazado. Vuelve a lista de pendientes.",
			});
		}

		return res
			.status(400)
			.json({ message: "Respuesta inválida (Use ACCEPT o REJECT)" });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};
export const finishTrip = async (req, res) => {
	try {
		const io = req.app.get("io"); // 1. Recuperamos Socket.io
		const { tripId } = req.params;
		const driverId = req.user.id;

		const trip = await Trip.findByPk(tripId);

		if (!trip) return res.status(404).json({ message: "Viaje no encontrado" });

		// Seguridad: Solo el chofer asignado
		if (trip.driverId !== driverId) {
			return res
				.status(403)
				.json({ message: "No eres el chofer de este viaje" });
		}

		// Validación de estado lógico
		if (trip.status === "FINISHED") {
			return res.status(400).json({ message: "El viaje ya estaba finalizado" });
		}

		// 2. Actualizamos la DB
		trip.status = "FINISHED";
		// trip.endTime = new Date(); // Recomendado agregar esto en tu modelo
		await trip.save();

		// 3. Notificación Real-Time (La magia del IO) ✨
		if (io) {
			// Avisamos al Cliente
			io.to(`user_${trip.clientId}`).emit("trip_status", {
				tripId: trip.id,
				status: "FINISHED",
				message: `¡Tu viaje ha finalizado! El chofer marcó la entrega.`,
			});

			// Avisamos al Admin (opcional, pero útil)
			io.to("role_admin").emit("trip_update", {
				tripId: trip.id,
				status: "FINISHED",
				driverId,
			});
		}
		// trip.endTime = new Date(); // Si tuvieras este campo AGREGAR ESTE CAMPOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO
		res.json({
			success: true,
			message: "Viaje finalizado correctamente",
			data: trip,
		});
		// VER DE  DISPARAR NOTIFICACIÓN AL CLIENTE CON LA OPCION DE COMENTARIO (Socket/Email)
	} catch (error) {
		console.error("Error finishing trip:", error);
		res.status(500).json({ message: "Error al finalizar el viaje" });
	}
};
export const cancelTrip = async (req, res) => {
	try {
		const io = req.app.get("io");
		const { tripId } = req.params;

		// 1. Buscamos el viaje
		const trip = await Trip.findByPk(tripId);

		if (!trip) {
			return res.status(404).json({
				success: false,
				message: "Viaje no encontrado",
			});
		}

		// 2. Verificación opcional: Si ya está cancelado, no hacemos nada
		if (trip.status === "CANCELLED") {
			return res.status(400).json({
				success: false,
				message: "El viaje ya estaba cancelado previamente",
			});
		}

		// 3. Actualizamos el estado
		// NOTA: Asegúrate que tu modelo permita el string 'CANCELLED' o el ID de estado correspondiente
		trip.status = "CANCELLED";

		// Si quieres guardar quién lo canceló o la fecha exacta (si no usas updated_at)
		// trip.cancelledAt = new Date();

		await trip.save();

		// 4. Notificamos vía Socket.io
		// Es útil enviar el nuevo status para que el front actualice el color de la etiqueta (ej: de verde a rojo)
		io.emit("server:trip-status-change", {
			id: tripId,
			status: "CANCELLED",
			message: "El viaje ha sido cancelado",
		});

		res.status(200).json({
			success: true,
			message: "Viaje cancelado exitosamente",
			trip: trip, // Devolvemos el viaje actualizado
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error interno al cancelar el viaje",
			error: error.message,
		});
	}
};
