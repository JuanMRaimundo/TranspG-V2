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
    origin: { type: DataTypes.STRING, allowNull: false }, // "Lugar_carga"
    destination: { type: DataTypes.STRING, allowNull: false }, // "Lugar_destino"
    pickupDate: { type: DataTypes.DATE }, // "Fecha" + "Hora" unificados
    cargoDetails: { type: DataTypes.TEXT }, // "Detalle"
    
    reference: { type: DataTypes.STRING }, // "Ref" (Orden de compra/Remito)
    containerNumber: { type: DataTypes.STRING }, // "N°_contenedor" (CRÍTICO)
    expirationDate: { type: DataTypes.DATEONLY }, // "Vencimiento"
    notes: { type: DataTypes.TEXT }, // "Observaciones"

    // --- ESTADOS DEL SISTEMA ---
    status: {
        type: DataTypes.ENUM(
            'PENDING',           // Creado, sin chofer
            'WAITING_DRIVER',    // Asignado por Admin, esperando OK del chofer
            'CONFIRMED',         // Chofer aceptó (CONFIRMADO)
            'REJECTED_BY_DRIVER',// Chofer rechazó
            'IN_PROGRESS', 
            'FINISHED'
        ),
        defaultValue: 'PENDING'
    },
    
    // Foreign Keys
    clientId: { type: DataTypes.UUID, allowNull: false }, // "id_usuario" (Creador)
    driverId: { type: DataTypes.UUID, allowNull: true }
}, {
    sequelize,
    modelName: 'Trip'
});

Trip.belongsTo(User, { as: 'client', foreignKey: 'clientId' });
Trip.belongsTo(User, { as: 'driver', foreignKey: 'driverId' });

export default Trip;