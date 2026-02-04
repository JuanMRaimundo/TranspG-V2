import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

class Trip extends Model {}

Trip.init(
	{
		id: {
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		origin: { type: DataTypes.STRING, allowNull: false }, // "Lugar_carga"
		destination: { type: DataTypes.STRING, allowNull: false }, // "Lugar_destino"
		pickupDate: { type: DataTypes.DATE }, // "Fecha" + "Hora" unificados
		cargoDetails: { type: DataTypes.TEXT }, // "Detalle"

		reference: { type: DataTypes.STRING }, // "Ref" (Orden de compra/Remito)
		containerNumber: { type: DataTypes.STRING, allowNull: true }, // "N°_contenedor" (CRÍTICO)
		expirationDate: { type: DataTypes.DATEONLY, allowNull: true }, // "Vencimiento"
		returnPlace: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		semi: {
			type: DataTypes.STRING,
			allowNull: false,
			validate: { notEmpty: true },
		},
		notes: { type: DataTypes.TEXT }, // "Observaciones"

		// --- ESTADOS DEL SISTEMA ---
		status: {
			type: DataTypes.ENUM(
				"PENDING", // Creado
				"CONFIRMED", // Asignado a Chofer
				"IN_PROGRESS", // "En camino"
				"UNLOADED", // "Descargado"
				"RETURNED", // "Playo" (Contenedor devuelto)
				"INVOICED", // "Facturado" (Finalizado con monto)
				"CANCELLED", // Cancelado
			),
			defaultValue: "PENDING",
		},
		driverAcknowledged: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
			comment: "Si el chofer dio el OK de enterado",
		},

		// Foreign Keys
		clientId: { type: DataTypes.UUID, allowNull: false }, // "id_usuario" (Creador)
		driverId: { type: DataTypes.UUID, allowNull: true },
	},
	{
		timestamps: true,
		paranoid: true,
		sequelize,
		modelName: "Trip",
	},
);

export default Trip;
