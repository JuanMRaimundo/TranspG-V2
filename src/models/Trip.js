import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

class Trip extends Model {}

Trip.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    origin: { type: DataTypes.STRING, allowNull: false },
    destination: { type: DataTypes.STRING, allowNull: false },
    cargoDetails: { type: DataTypes.TEXT },
    status: {
        type: DataTypes.ENUM('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'FINISHED', 'BILLED'),
        defaultValue: 'PENDING'
    },
    price: { type: DataTypes.DECIMAL(10, 2) },
    // Foreign Keys explícitas (opcional, Sequelize las crea, pero mejor ser explícito)
    clientId: { type: DataTypes.UUID, allowNull: false },
    driverId: { type: DataTypes.UUID, allowNull: true } // Puede ser null al inicio
}, {
    sequelize,
    modelName: 'Trip'
});

// --- DEFINICIÓN DE RELACIONES ---

// Relación: Un viaje pertenece a un Cliente
Trip.belongsTo(User, { as: 'client', foreignKey: 'clientId' });

// Relación: Un viaje puede pertenecer a un Chofer
Trip.belongsTo(User, { as: 'driver', foreignKey: 'driverId' });

export default Trip;