import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
};

// Esta función se ejecuta cada vez que una ruta protegida recibe un token
const jwtStrategy = new JwtStrategy(options, async (payload, done) => {
    try {
        // Buscamos si el usuario del token todavía existe en la DB
        const user = await User.findByPk(payload.id);
        
        if (user) {
            return done(null, user); // Token válido, inyecta 'user' en req.user
        } else {
            return done(null, false); // Token válido pero usuario no existe
        }
    } catch (error) {
        return done(error, false);
    }
});

export default jwtStrategy;