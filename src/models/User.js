import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

class User extends Model {}

User.init(
	{
		id: {
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		email: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
			validate: { isEmail: true },
		},
		password: {
			type: DataTypes.STRING, // Recordar hashear esto con bcrypt
			allowNull: false,
		},
		phone: {
			type: DataTypes.STRING,
			allowNull: true,
			unique: true,
			validate: {
				is: {
					args: [/^\+?[1-9]\d{1,14}$/],
					msg: "El formato del teléfono debe ser internacional (ej: +549113906544)",
				},
			},
		},
		role: {
			type: DataTypes.ENUM("ADMIN", "CLIENT", "DRIVER"),
			defaultValue: "CLIENT",
		},
		firstName: { type: DataTypes.STRING },
		lastName: { type: DataTypes.STRING },
	},
	{
		timestamps: true,
		paranoid: true,
		sequelize,
		modelName: "User",
	},
);

export default User;
