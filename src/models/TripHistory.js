import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

class TripHistory extends Model {}

TripHistory.init(
	{
		id: {
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		// Relación con el Viaje Padre
		tripId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: "Trips", // Nombre de la tabla en BD
				key: "id",
			},
		},
		// Relación con quien hizo el cambio (Admin o Cliente)
		editorId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: "Users",
				key: "id",
			},
		},
		// Descripción legible del cambio
		// Ej: "Se modificó el Destino: de 'Buenos Aires' a 'Córdoba'."
		details: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		// Opcional: Guardar qué campos específicos se tocaron (útil para el front)
		changedFields: {
			type: DataTypes.JSON, // Guardamos un array ej: ["destination", "notes"]
			allowNull: true,
		},
	},
	{
		sequelize,
		modelName: "TripHistory",
		tableName: "TripHistories", // Sequelize pluraliza, pero mejor ser explícito
		timestamps: true, // Esto nos da el "createdAt" (CUÁNDO se cambió) automáticamente
		updatedAt: false, // No necesitamos saber cuando se actualizó el historial, es inmutable
	},
);

export default TripHistory;
