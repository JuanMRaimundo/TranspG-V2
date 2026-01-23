import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../../models/User.js";

// Helper para generar token
const signToken = (user) => {
	return jwt.sign(
		{ id: user.id, role: user.role, email: user.email },
		process.env.JWT_SECRET,
		{ expiresIn: "24h" },
	);
};

export const register = async (req, res) => {
	try {
		const { firstName, lastName, email, password, phone, role } = req.body;

		// 1. Validar si ya existe
		const existingUser = await User.findOne({ where: { email } });
		if (existingUser) {
			return res.status(400).json({ message: "El email ya está registrado" });
		}

		// 2. Encriptar contraseña (Nunca guardar texto plano)
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);

		// 3. Crear Usuario
		const newUser = await User.create({
			firstName,
			lastName,
			email,
			password: hashedPassword,
			phone,
			role: role || "CLIENT", // Por defecto Cliente
		});

		// 4. Generar Token inmediatamente (Login automático al registrarse)
		const token = signToken(newUser);

		res.status(201).json({
			success: true,
			token,
			user: {
				id: newUser.id,
				email: newUser.email,
				phone: newUser.phone,
				role: newUser.role,
			},
		});
	} catch (error) {
		res
			.status(500)
			.json({ message: "Error en el servidor", error: error.message });
	}
};

export const login = async (req, res) => {
	try {
		const { email, password } = req.body;

		// 1. Buscar usuario
		const user = await User.findOne({ where: { email } });
		if (!user) {
			return res.status(401).json({ message: "Credenciales inválidas" });
		}

		// 2. Comparar contraseñas
		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) {
			return res.status(401).json({ message: "Credenciales inválidas" });
		}

		// 3. Generar token
		const token = signToken(user);

		res.json({
			success: true,
			token,
			user: {
				id: user.id,
				name: user.firstName,
				phone: user.phone,
				role: user.role,
			},
		});
	} catch (error) {
		res
			.status(500)
			.json({ message: "Error al iniciar sesión", error: error.message });
	}
};
