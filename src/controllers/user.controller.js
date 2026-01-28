import User from "../models/User.js";
import bcrypt from "bcrypt";

export const getUserByID = async (req, res) => {
	try {
		const { id } = req.params;
		const user = await User.findByPk(id, {
			attributes: { exclude: ["password"] },
		});
		res.json({ succes: true, data: user });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message });
	}
};
export const getDrivers = async (req, res) => {
	try {
		const drivers = await User.findAll({
			where: { role: "DRIVER" },
			attributes: { exclude: ["password"] },
		});
		res.json({ success: true, data: drivers });
	} catch (error) {
		res.status(500).json({ success: false, error: error.message });
	}
};
export const getClients = async (req, res) => {
	try {
		const clients = await User.findAll({
			where: { role: "CLIENT" },
			attributes: { exclude: ["password"] },
		});
		res.json({ success: true, data: clients });
	} catch (error) {
		res.status(500).json({ success: false, error: error.message });
	}
};
export const createClient = async (req, res) => {
	try {
		const { firstName, lastName, email, password, phone } = req.body;
		const existingUser = await User.findOne({ where: { email } });
		if (!email || !password) {
			return res.status(400).json({
				message: "Email y password son requeridos",
			});
		}
		const phoneRegex = /^\+?[1-9]\d{1,14}$/;
		if (phone && !phoneRegex.test(phone)) {
			return res.status(400).json({
				message: "Formato de teléfono inválido. Usa: +549113906544",
			});
		}
		if (existingUser) {
			return res
				.status(400)
				.json({ message: "El cliente con este email ya está registrado" });
		}

		const salt = await bcrypt.genSalt(10);

		const hashedPassword = await bcrypt.hash(
			password || "clientePassw123",
			salt,
		);

		const newClient = await User.create({
			firstName,
			lastName,
			email,
			password: hashedPassword,
			phone,
			role: "CLIENT",
		});
		res.status(201).json({
			success: true,
			message: "Cliente creado exitosamente",
			client: {
				id: newClient.id,
				email: newClient.email,
				name: newClient.firstName,
			},
		});
	} catch (error) {
		// ✅ SequelizeValidationError - errores de validación del modelo
		if (error.name === "SequelizeValidationError") {
			const errors = error.errors.map((err) => err.message);
			return res.status(400).json({
				message: "Datos inválidos",
				errors,
			});
		}
		// ✅ UniqueConstraintError - email/teléfono duplicado
		if (error.name === "SequelizeUniqueConstraintError") {
			return res.status(409).json({
				message: "Email o teléfono ya existe",
			});
		}

		// ✅ Errores genéricos (500)
		res.status(500).json({
			message: "Error interno del servidor",
			error: error.message,
		});
	}
};
export const createDriver = async (req, res) => {
	try {
		const { firstName, lastName, email, password, phone } = req.body;

		const existingUser = await User.findOne({ where: { email } });
		if (existingUser) {
			return res
				.status(400)
				.json({ message: "El chofer con este email ya está registrado" });
		}

		// Encriptar contraseña (o usar una por defecto si el admin no pone una)
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(
			password || "transportes123",
			salt,
		);

		const newDriver = await User.create({
			firstName,
			lastName,
			email,
			password: hashedPassword,
			phone,
			role: "DRIVER", // <--- Forzamos el rol
		});

		res.status(201).json({
			success: true,
			message: "Chofer creado exitosamente",
			driver: {
				id: newDriver.id,
				email: newDriver.email,
				name: newDriver.firstName,
			},
		});
	} catch (error) {
		res.status(500).json({ success: false, error: error.message });
	}
};
export const updateUser = async (req, res) => {
	try {
		const { id } = req.params;
		const { firstName, lastName, email, phone } = req.body;

		const user = await User.findOne({
			where: { id },
			attributes: { exclude: ["password"] },
		});
		if (!user) {
			return res.status(404).json({
				success: false,
				message: "Usuario no encontrado",
			});
		}
		if (email && email !== user.email) {
			const existingUser = await User.findOne({ where: { email } });
			if (existingUser) {
				return res.status(400).json({
					message: "El email ya está registrado por otro usuario",
				});
			}
		}
		const phoneRegex = /^\+?[1-9]\d{1,14}$/;
		if (phone && !phoneRegex.test(phone)) {
			return res.status(400).json({
				message: "Formato de teléfono inválido. Usa: +549113906544",
			});
		}
		const updateData = { firstName, lastName, email, phone };
		const [updatedRows] = await User.update(updateData, {
			where: { id },
			individualHooks: true, // TAL VEZ DEBERÍA ACTIVARLO SÓLO EN EL DE VIAJES, ya que es mejor para evitar confusiones y posibles engaños.
		});
		if (updatedRows === 0) {
			return res.status(400).json({
				success: false,
				message: "No se pudo actualizar el usuario",
			});
		}

		const updatedUser = await User.findByPk(id, {
			attributes: { exclude: ["password"] },
		});

		res.status(200).json({
			success: true,
			message: "Usuario editado exitosamente",
			user: updatedUser,
		});
	} catch (error) {
		if (error.name === "SequelizeValidationError") {
			const errors = error.errors.map((err) => err.message);
			return res.status(400).json({
				message: "Datos inválidos",
				errors,
			});
		}
		if (error.name === "SequelizeUniqueConstraintError") {
			return res.status(409).json({
				message: "Email o teléfono ya existe",
			});
		}
		res.status(500).json({
			success: false,
			message: "Error interno del servidor",
			error: error.message,
		});
	}
};
export const deleteUser = async (req, res) => {
	try {
		const { id } = req.params;
		const user = await User.findByPk(id);

		if (!user) {
			return res
				.status(404)
				.json({ success: false, message: "Usuario no encontrado" });
		}

		// Al tener { paranoid: true } en el modelo, .destroy() hace un Soft Delete
		await user.destroy();

		res.status(200).json({
			success: true,
			message: "Usuario eliminado correctamente (Soft Delete)",
		});
	} catch (error) {
		res
			.status(500)
			.json({ success: false, message: "Error al eliminar usuario" });
	}
};

//// --- UPDATE USER (Optimizado) ---
/* export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, email, phone } = req.body;

        // 1. Buscamos la instancia primero (Incluso los eliminados si quisieras restaurar, pero por ahora solo activos)
        const user = await User.findByPk(id, {
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }

        // 2. Validación de Email único (Solo si el email cambió)
        if (email && email !== user.email) {
            const emailExists = await User.findOne({ where: { email } });
            if (emailExists) {
                return res.status(409).json({ success: false, message: "El email ya está en uso." });
            }
        }

        // 3. Validación básica de teléfono (Regex simple)
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (phone && !phoneRegex.test(phone)) {
            return res.status(400).json({ success: false, message: "Formato de teléfono inválido." });
        }

        // 4. Actualización sobre la instancia
        // Esto dispara automáticamente los hooks 'beforeUpdate' si los tuvieras
        // y actualiza los campos updated_at
        await user.update({ 
            firstName, 
            lastName, 
            email, 
            phone 
        });

        // 5. Respuesta
        res.status(200).json({
            success: true,
            message: "Usuario actualizado correctamente",
            data: user // 'user' ya tiene los datos nuevos tras el .update()
        });

    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
};
 */
