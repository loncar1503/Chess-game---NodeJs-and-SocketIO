const redisClient=require("../config/redis");



const newUser = async (socketId, user, roomId = null) => {
    if (roomId) {
        user.room = roomId;
    } // Ako je roomId prosleđen, dodeljuje ga korisniku.

    await redisClient.set(socketId, JSON.stringify(user));  //Postavlja korisnički objekat u Redis koristeći socketId kao ključ. Korisnički objekat se prvo pretvara u JSON string pre nego što se sačuva.

    try {
        const reply = await redisClient.get('total-users');  

        let totalUsers = 1;

        if (reply) {
            totalUsers = parseInt(reply) + 1;
        }

        await redisClient.set('total-users', totalUsers + "");  //Postavlja ažurirani broj korisnika u Redis.
    } catch (err) {
        console.error('Error interacting with Redis:', err);
        throw err;
    }
};

const removeUser = async (socketId) => {
    await redisClient.del(socketId); 

    try {
        const reply = await redisClient.get('total-users');  

        if (reply) {
            let totalUsers = parseInt(reply) - 1;

            if (totalUsers === 0) {
                await redisClient.del('total-users');  
            } else {
                await redisClient.set('total-users', totalUsers + "");  
            }
        }
    } catch (err) {
        console.error('Error interacting with Redis:', err);
        throw err;
    }
};

module.exports = { newUser, removeUser };