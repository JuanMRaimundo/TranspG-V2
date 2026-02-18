import Trip from "../models/Trip.js";
import User from "../models/User.js";
import TripHistory from "../models/TripHistory.js"; // Importamos el historial
import ExcelJS from "exceljs";
import { Op } from "sequelize";

//HELPER DE AUDITORÍA
const detectChanges = (oldData, newData) => {
	const fieldsToCheck = [
		"origin",
		"destination",
		"pickupDate",
		"cargoDetails",
		"semi",
		"containerNumber",
		"returnPlace",
		"expirationDate",
		"reference",
		"notes",
		"targetClientId", //
	];
	let changesLog = [];
	let changesStructured = [];

	fieldsToCheck.forEach((field) => {
		// Si el campo viene en el body Y es diferente al que estaba en BD
		if (newData[field] !== undefined && newData[field] != oldData[field]) {
			// Manejo especial para fechas o nulos para que no sea spam
			const oldVal = oldData[field] === null ? null : oldData[field];
			const newVal = newData[field] === null ? null : newData[field];
			changesLog.push(`${field}: ${oldVal || "N/A"} -> ${newVal || "N/A"}`);
			changesStructured.push({
				field: field,
				oldValue: oldVal,
				newValue: newVal,
			});
		}
	});
	return { changesLog, changesStructured };
};

export const getTripById = async (req, res) => {
	try {
		const { tripId } = req.params;
		const trip = await Trip.findByPk(tripId, {
			include: [
				{ model: User, as: "client" },
				{ model: User, as: "driver" },
				// INCLUIMOS EL HISTORIAL DE CAMBIOS
				{
					model: TripHistory,
					as: "history",
					include: [
						{
							model: User,
							as: "editor",
							attributes: ["firstName", "lastName"],
						},
					],
				},
			],
		});
		if (!trip) return res.status(404).json({ message: "No existe" });
		res.json({ success: true, data: trip });
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
			notes,
			semi,
			containerNumber,
			expirationDate,
			returnPlace,
			targetClientId,
		} = req.body;

		if (!semi)
			return res
				.status(400)
				.json({ message: "El campo 'Semi' es obligatorio." });

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
			notes,
			//NUEVOS CAMPOS - CON LÓGICA DEL CONTEINER
			semi,
			containerNumber: containerNumber || null,
			expirationDate: containerNumber ? expirationDate : null,
			returnPlace: containerNumber ? returnPlace : null,
			clientId: finalClientId, // Aquí usamos el ID decidido arriba
			status: "PENDING",
		});

		// Notificar
		if (io) {
			io.to("role_admin").emit("new_trip_request", {
				tripId: newTrip.id,
				origin,
				reference,
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
			io.emit("trips:refresh", {
				action: "CREATED",
				tripId: newTrip.tripId,
			});
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
		const editorId = req.user.id;

		const trip = await Trip.findByPk(tripId);
		if (!trip) return res.status(404).json({ message: "Viaje no encontrado" });

		const { changesLog, changesStructured } = detectChanges(
			trip.dataValues,
			req.body,
		);
		if (changesStructured.length > 0) {
			// 2. Si hay cambios, creamos el historial
			await TripHistory.create({
				tripId: trip.id,
				editorId: editorId,
				action: "UPDATE", // Acción de edición de contenido
				details: `Campos modificados: ${changesLog.join(", ")}`,
				changedFields: changesStructured,
			});

			// 3. Actualizamos el viaje
			await trip.update(req.body);
			// --- NOTIFICACIÓN A TODOS (Regla: "Sin importar el rol") ---
			if (io) {
				const msg = {
					message: `El viaje ha sido editado.`,
					tripId: trip.id,
				};
				io.to("role_admin").emit("trip_edited", msg);
				if (trip.clientId)
					io.to(`user_${trip.clientId}`).emit("trip_edited", msg);
				if (trip.driverId)
					io.to(`user_${trip.driverId}`).emit("trip_edited", msg);
				io.emit("trips:refresh", {
					action: "UPDATE",
					tripId: trip.tripId,
				});
			}
			res.json({
				success: true,
				message: "Viaje actualizado y registrado en historial.",
				data: trip,
			});
		} else {
			res.json({
				success: true,
				message: "No se detectaron cambios para guardar.",
			});
		}
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

		const trip = await Trip.findByPk(tripId);
		if (!trip) return res.status(404).json({ message: "Viaje no encontrado" });

		// Validación extra: Verificar que el viaje esté en estado PENDING
		// Para no reasignar un viaje que ya está en curso
		if (trip.status !== "PENDING") {
			return res
				.status(400)
				.json({ message: "El viaje no está disponible para asignación" });
		}

		// ... (El resto de tu código sigue igual)
		trip.driverId = driverId;
		trip.status = "CONFIRMED";
		trip.driverAcknowledged = false;
		await trip.save();

		if (io) {
			io.to(`user_${driverId}`).emit("trip_offer", {
				tripId: trip.id,
				origin: trip.origin,
				destination: trip.destination,
				message:
					"Se te ha asignado un nuevo viaje. Por favor confirma lectura.",
			});
			io.emit("trips:refresh", {
				action: "ASSING",
				tripId: trip.tripId,
			});
		}

		return res.json({
			success: true,
			message: "Chofer asignado",
			data: trip,
		});
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};
//CHOFER CONFIRMA LECTURA ("OK") -> No cambia Status, solo es un flag
export const acknowledgeTrip = async (req, res) => {
	try {
		const io = req.app.get("io");
		const { tripId } = req.params;
		const trip = await Trip.findByPk(tripId);

		if (trip.driverId !== req.user.id)
			return res.status(403).json({ message: "No eres el chofer" });

		trip.driverAcknowledged = true;
		await trip.save();

		if (io)
			//  Admin
			io.to("role_admin").emit("trip_ack", {
				tripId,
				driverName: req.user.firstName,
			});
		//  Cliente
		io.to(`user_${trip.clientId}`).emit("trip_status", {
			status: "CONFIRMED", // Mantenemos el estado visual
			message: `El chofer ${req.user.firstName} ha confirmado la recepción del viaje.`,
			tripId,
		});
		io.emit("trips:refresh", {
			action: "ACKNOWLEDGE",
			tripId: tripId,
		});
		res.json({ success: true, message: "Lectura confirmada" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
//CHOFER INICIA VIAJE -> Status: IN_PROGRESS
export const startTrip = async (req, res) => {
	try {
		const io = req.app.get("io");
		const { tripId } = req.params;
		const trip = await Trip.findByPk(tripId);

		trip.status = "IN_PROGRESS";
		await trip.save();

		// Notificar a TODOS (Admin y Cliente)
		const msg = {
			status: "IN_PROGRESS",
			message: `El viaje hacia ${trip.destination} ha comenzado.`,
			tripId,
		};
		if (io) {
			io.to(`user_${trip.clientId}`).emit("trip_status", msg);
			io.to("role_admin").emit("trip_status_update", msg);
			io.emit("trips:refresh", {
				action: "START", // Cambiar según la función (UNLOAD, RETURN, etc)
				tripId: tripId,
			});
		}

		res.json({ success: true, status: "IN_PROGRESS" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
//  CHOFER LLEGA A DESTINO (DESCARGADO) -> Status: UNLOADED
export const unloadTrip = async (req, res) => {
	try {
		const io = req.app.get("io");
		const { tripId } = req.params;
		const trip = await Trip.findByPk(tripId);

		trip.status = "UNLOADED";
		await trip.save();

		const msg = {
			status: "UNLOADED",
			message: `La carga ha sido descargada en destino.`,
			tripId,
		};
		if (io) {
			io.to(`user_${trip.clientId}`).emit("trip_status", msg);
			io.to("role_admin").emit("trip_status_update", msg);
			io.emit("trips:refresh", {
				action: "UNLOAD",
				tripId: tripId,
			});
		}
		res.json({ success: true, status: "UNLOADED" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
// E. CHOFER DEVUELVE CONTAINER (PLAYO) -> Status: RETURNED
export const returnContainer = async (req, res) => {
	try {
		const io = req.app.get("io");
		const { tripId } = req.params;
		const trip = await Trip.findByPk(tripId);

		if (!trip.containerNumber)
			return res
				.status(400)
				.json({ message: "Este viaje no tiene contenedor." });

		trip.status = "RETURNED";
		await trip.save();

		const msg = {
			status: "RETURNED",
			message: `Contenedor devuelto (Playo). Esperando facturación.`,
			tripId,
		};
		if (io) {
			io.to(`user_${trip.clientId}`).emit("trip_status", msg);
			io.to("role_admin").emit("trip_status_update", msg);
			io.emit("trips:refresh", {
				action: "RETURNED",
				tripId: tripId,
			});
		}
		res.json({ success: true, status: "RETURNED" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// F. ADMIN CARGA MONTO (FACTURADO) -> Status: INVOICED
export const invoiceTrip = async (req, res) => {
	try {
		const io = req.app.get("io");
		const { tripId } = req.params;
		const { amount } = req.body;

		if (req.user.role !== "ADMIN")
			return res.status(403).json({ message: "Solo Admin factura." });
		if (!amount)
			return res.status(400).json({ message: "El monto es obligatorio." });
		if (amount === undefined || amount === null || isNaN(amount)) {
			return res.status(400).json({ message: "El monto es inválido" });
		}
		const finalAmount = parseFloat(amount);

		const trip = await Trip.findByPk(tripId);

		// Validación lógica: ¿Está listo para facturar?
		// Si tenía container, debe estar RETURNED. Si no, debe estar UNLOADED.
		const canInvoice =
			(trip.containerNumber && trip.status === "RETURNED") ||
			(!trip.containerNumber && trip.status === "UNLOADED");

		if (
			!canInvoice &&
			trip.status !== "UNLOADED" &&
			trip.status !== "RETURNED"
		) {
			// Nota: Somos flexibles si el admin quiere forzarlo, pero idealmente avisamos.
			// Por ahora lo dejamos pasar, pero guardamos el monto.
		}

		const [updatedRows] = await Trip.update(
			{
				status: "INVOICED",
				amount: finalAmount,
			},
			{ where: { id: tripId } },
		);

		if (updatedRows === 0)
			return res.status(404).json({ message: "Viaje no encontrado" });

		if (io) {
			io.to("role_admin").emit("trip_status", {
				status: "INVOICED",
				message: `El siguiente viaje ha sido cerrado y facturado.`,
				tripId,
			});
			//VER SI LE MANDAMOS LA NOTIFICACIÓN DE "FACTURADO" AL CLIENTE O NO....
			/* io.to(`user_${trip.clientId}`).emit("trip_status", {
				status: "INVOICED",
				message: `Tu viaje ha sido cerrado y facturado.`,
				tripId,
				}); */
			io.emit("trips:refresh", {
				action: "INVOICE",
				tripId: req.params.tripId,
			});
		}

		res.json({ success: true, message: "Viaje facturado correctamente." });
	} catch (error) {
		res.status(500).json({ error: error.message });
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

// 4. EXPORTACIÓN EXCEL
// ==========================================

export const exportTripsToExcel = async (req, res) => {
	try {
		// Obtenemos filtros del query (ej: ?status=PENDING&startDate=2023-01-01)
		const { status, startDate, endDate } = req.query;
		let where = {};

		if (status) where.status = status;
		if (startDate && endDate) {
			where.createdAt = {
				[Op.between]: [new Date(startDate), new Date(endDate)],
			};
		}

		// Buscamos TODOS los viajes que coincidan
		const trips = await Trip.findAll({
			where,
			include: ["client", "driver"],
			order: [["createdAt", "DESC"]],
		});

		// Creamos el libro de Excel
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet("Viajes");

		// Definimos columnas
		sheet.columns = [
			{ header: "ID", key: "id", width: 10 },
			{ header: "Fecha", key: "date", width: 15 },
			{ header: "Estado", key: "status", width: 15 },
			{ header: "Cliente", key: "client", width: 20 },
			{ header: "Chofer", key: "driver", width: 20 },
			{ header: "Semi", key: "semi", width: 15 },
			{ header: "Origen", key: "origin", width: 25 },
			{ header: "Destino", key: "destination", width: 25 },
			{ header: "Contenedor", key: "container", width: 15 },
			{ header: "Vencimiento", key: "expiration", width: 15 },
			{ header: "Lugar Devolución", key: "returnPlace", width: 20 },
			{ header: "Monto ($)", key: "amount", width: 15 },
			{ header: "Notas", key: "notes", width: 30 },
		];

		// Agregamos filas
		trips.forEach((trip) => {
			sheet.addRow({
				id: trip.id.split("-")[0], // ID corto
				date: new Date(trip.pickupDate || trip.createdAt).toLocaleDateString(),
				status: trip.status,
				client: trip.client
					? `${trip.client.firstName} ${trip.client.lastName}`
					: "N/A",
				driver: trip.driver
					? `${trip.driver.firstName} ${trip.driver.lastName}`
					: "Sin asignar",
				semi: trip.semi,
				origin: trip.origin,
				destination: trip.destination,
				container: trip.containerNumber || "No",
				expiration: trip.expirationDate
					? new Date(trip.expirationDate).toLocaleDateString()
					: "-",
				returnPlace: trip.returnPlace || "-",
				amount: trip.amount || 0,
				notes: trip.notes,
			});
		});

		// Configurar headers para descarga
		res.setHeader(
			"Content-Type",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		);
		res.setHeader(
			"Content-Disposition",
			"attachment; filename=" + "Reporte_Viajes.xlsx",
		);

		// Escribir al stream de respuesta
		await workbook.xlsx.write(res);
		res.end();
	} catch (error) {
		console.error("Error excel:", error);
		res.status(500).send("Error al generar Excel");
	}
};
