import jwt from 'jsonwebtoken';

export default (io, socket) => {
    // 1. Autenticación del Socket (Middleware simplificado)
    // El cliente debe enviar el token en el handshake: socket = io({ auth: { token } });
    const token = socket.handshake.auth.token;
    
    if (!token) {
        socket.disconnect();
        return;
    }

    try {
        // Verificar token (usar misma secret key que en Passport)
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { id, role } = decoded;

        // 2. Unirse a Sala Personal (Para mensajes directos)
        socket.join(`user_${id}`);
        console.log(`Usuario ${id} unido a sala personal.`);

        // 3. Unirse a Sala de Rol (Para dashboards o alertas grupales)
        if (role === 'ADMIN') {
            socket.join('role_admin');
            console.log(`Usuario ${id} unido a sala ADMIN.`);
        } 
        else if (role === 'DRIVER') {
            socket.join('role_driver');
        }

    } catch (err) {
        console.error('Socket auth error', err);
        socket.disconnect();
    }

    // Aquí puedes definir listeners específicos
    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
};