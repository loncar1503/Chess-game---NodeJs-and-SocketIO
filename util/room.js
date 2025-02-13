const redisClient = require("../config/redis");

let numberOfRoomIndices = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

const createRoom = async (roomId, user, time, password = null) => {
  try {
    let room = {
      id: roomId,
      players: [user, null],
      moves: [],
      time,
      gameStarted: false,
    };
    if (password) {
      room.password = password;
    }

    await redisClient.set(roomId, JSON.stringify(room));

    // Ažuriranje liste svih soba
    let rooms = [];
    let reply = await redisClient.get("rooms");
    if (reply) {
      rooms = JSON.parse(reply);
    }
    let index = rooms.length;
    rooms.push(room);
    await redisClient.set("rooms", JSON.stringify(rooms));

    let roomIndices = {};
    reply = await redisClient.get("roomIndices");
    if (reply) {
      roomIndices = JSON.parse(reply);
    }
    roomIndices[roomId] = index;
    await redisClient.set("roomIndices", JSON.stringify(roomIndices));

    // Ažuriranje broja ukupnih soba
    reply = await redisClient.get("total-rooms");
    let totalRooms = reply ? parseInt(reply) : 0;
    totalRooms += 1;
    await redisClient.set("total-rooms", totalRooms.toString());

    // Ažuriranje broja soba po rangovima korisnika
    let numberOfRooms = [0, 0, 0, 0];
    reply = await redisClient.get("number-of-rooms");
    if (reply) {
      numberOfRooms = JSON.parse(reply);
    }
    numberOfRooms[numberOfRoomIndices[user.user_rank]] += 1;
    await redisClient.set("number-of-rooms", JSON.stringify(numberOfRooms));

    console.log("Room successfully created:", roomId);
  } catch (err) {
    console.error("Error creating room:", err);
  }
};

const joinRoom = async (roomId, user) => {
  try {
    let reply = await redisClient.get(roomId);
    if (reply) {
      let room = JSON.parse(reply);

      room.players[1] = user;
      await redisClient.set(roomId, JSON.stringify(room));

      reply = await redisClient.get("roomIndices");
      if (reply) {
        let roomIndices = JSON.parse(reply);

        reply = await redisClient.get("rooms");
        if (reply) {
          let rooms = JSON.parse(reply);

          rooms[roomIndices[roomId]].players[1] = user;
          await redisClient.set("rooms", JSON.stringify(rooms));
        }
      }
    }
  } catch (err) {
    console.error("Error joining room:", err);
  }
};

const removeRoom = async (roomId, userRank) => {
  try {
    reply = await redisClient.get("rooms");
    if (reply) {
      let room = JSON.parse(reply);
      if (room.players.length > 1) {
        return;
      }
    }
    await redisClient.del(roomId);

    let reply = await redisClient.get("roomIndices");
    if (reply) {
      let roomIndices = JSON.parse(reply);

      reply = await redisClient.get("rooms");
      if (reply) {
        let rooms = JSON.parse(reply);

        rooms.splice(roomIndices[roomId], 1);
        delete roomIndices[roomId];
        await redisClient.set("rooms", JSON.stringify(rooms));
        await redisClient.set("roomIndices", JSON.stringify(roomIndices));
      }
    }

    reply = await redisClient.get("total-rooms");
    if (reply) {
      let totalRooms = parseInt(reply);
      totalRooms -= 1;
      await redisClient.set("total-rooms", totalRooms.toString());
    }

    reply = await redisClient.get("number-of-rooms");
    if (reply) {
      let numberOfRooms = JSON.parse(reply);
      numberOfRooms[numberOfRoomIndices[userRank]] -= 1;
      await redisClient.set("number-of-rooms", JSON.stringify(numberOfRooms));
    }
  } catch (err) {
    console.error("Error removing room:", err);
  }
};

module.exports = { createRoom, joinRoom, removeRoom };
