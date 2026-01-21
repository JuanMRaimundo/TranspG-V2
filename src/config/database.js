import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Cargar variables de entorno del archivo .env
dotenv.config();

const sequelize = new Sequelize(
    process.env.DB_NAME,     // Nombre de la base de datos
    process.env.DB_USER,     // Usuario
    process.env.DB_PASS,     // Contraseña
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect:'postgres',
        logging: false,
        dialectOptions:{
            ssl:{
                require:true,
                rejectUnauthorized: false
            }
        }
    }
);

export default sequelize;