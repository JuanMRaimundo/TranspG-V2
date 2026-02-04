import sequelize from "../config/database.js";
import Trip from "./Trip.js";
import TripHistory from "./TripHistory.js";
import User from "./User.js";

Trip.belongsTo(User, { as: "client", foreignKey: "clientId" });
Trip.belongsTo(User, { as: "driver", foreignKey: "driverId" });
Trip.hasMany(TripHistory, { as: "history", foreignKey: "tripId" });

TripHistory.belongsTo(Trip, { foreignKey: "tripId" });
TripHistory.belongsTo(User, { as: "editor", foreignKey: "editorId" });

User.hasMany(Trip, { as: "clientTrips", foreignKey: "clientId" });
User.hasMany(Trip, { as: "driverTrips", foreignKey: "driverId" });

export { Trip, TripHistory, User, sequelize };
