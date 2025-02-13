const express = require("express")
const dotenv = require("dotenv")
const db = require("./config/db")
const path = require("path")
const http = require("http")
const socketIO = require("socket.io")
const cookieParser = require("cookie-parser")
const redisClient = require("./config/redis")

const { promisify } = require("util")
redisClient.getAsync = promisify(redisClient.get).bind(redisClient)

const { newUser, removeUser } = require("./util/user")
const { createRoom, joinRoom, removeRoom } = require("./util/room")

dotenv.config()

const app = express()
const server = http.createServer(app)

db.connect((err) => {
  if (err) {
    console.log(err)
    process.exit(1)
  }
  console.log("Connected to MySQL database")
})

app.use(cookieParser("secret"))
app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))
app.use(express.static(path.join(__dirname, "public")))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use("/", require("./routes/views"))
app.use("/api", require("./routes/api/user"))

const io = socketIO(server)

io.on("connection", (socket) => {
  //   socket.on("user-connected", async (user, roomId = null, password=null) => {
  //     if (roomId) {
  //         ///////////////
  //       await redisClient.get(roomId,(err,reply)=>{
  //         if(err) throw err

  //         if(reply){
  //             let room=JSON.parse(reply)

  //             if(room.gameStarted){
  //                 socket.emit("error","The room is full")
  //                 return;
  //             }
  //             //Ako soba ima pasvord i ako je pasvord null(nije prosledjen) ili nije dobar, baci err
  //             if(room.password && (!password || room.password!==password)){
  //                 socket.emit("error", "To join the room you need the correct password")
  //                 return
  //             }

  //             socket.join(roomId)
  //             newUser(socket.id,user,roomId)

  //             if(room.players[0].username=user.name){
  //                 return
  //             }

  //             if(room.players[1]===null){
  //                 room.players[1]= user
  //             }
  //             room.gameStarted = true;
  //             ////////
  //             redisClient.set(roomId, JSON.stringify(room))
  //             socket.to(roomId).emit("game-started")
  //             /////////
  //             redisClient.get("roomIndices",(err,reply)=>{
  //                 if(err)throw err

  //                 if(reply){
  //                     let roomIndices=JSON.parse(reply)
  //                     ////////////
  //                     redisClient.get("rooms",(err,reply)=>{
  //                         if(reply){
  //                             let rooms=JSON.parse(reply)

  //                             rooms[roomIndices[roomId]]=room

  //                             ///////////
  //                             redisClient.set("rooms",JSON.stringify(rooms))
  //                         }
  //                     })
  //                 }
  //             })
  //         }else{
  //             socket.emit("error","The room does not exist")
  //         }
  //       })
  //     } else {
  //       await newUser(socket.id, user)
  //     }
  //   })

  socket.on("user-connected", async (user, roomId = null, password = null) => {
    try {
      if (roomId) {
        let reply = await redisClient.get(roomId)
        if (reply) {
          let room = JSON.parse(reply)

          if (room.gameStarted) {
            socket.emit("error", "The room is full")
            return
          }

          if (room.password && (!password || room.password !== password)) {
            socket.emit(
              "error",
              "To join the room you need the correct password"
            )
            return
          }

          socket.join(roomId)
          await newUser(socket.id, user, roomId)

          if (room.players[0].username === user.username) {
            return
          }

          if (!room.players[1]) {
            room.players[1] = user
          }

          room.gameStarted = true
          await redisClient.set(roomId, JSON.stringify(room))
          socket.to(roomId).emit("game-started", user)

          let roomIndicesReply = await redisClient.get("roomIndices")
          if (roomIndicesReply) {
            let roomIndices = JSON.parse(roomIndicesReply)

            let roomsReply = await redisClient.get("rooms")
            if (roomsReply) {
              let rooms = JSON.parse(roomsReply)
              rooms[roomIndices[roomId]] = room

              await redisClient.set("rooms", JSON.stringify(rooms))
            }
          }
        } else {
          socket.emit("error", "The room does not exist")
        }
      } else {
        await newUser(socket.id, user)
      }
    } catch (err) {
      console.error("Error handling user connection:", err)
    }
  })

  //   socket.on("get-game-details", (roomId, user) => {
  //     ////////////
  //     redisClient.get(roomId, (err, reply) => {
  //       if (err) throw err
  //       if (reply) {
  //         let room = JSON.parse(reply)

  //         let.details = { players: room.players, time: room.time }
  //         socket.emit("receive-game-details", details)
  //       }
  //     })
  //   })
  socket.on("get-game-details", async (roomId, user) => {
    try {
      let reply = await redisClient.get(roomId)

      if (reply) {
        let room = JSON.parse(reply)

        let details = { players: room.players, time: room.time }
        socket.emit("receive-game-details", details)
      }
    } catch (err) {
      console.error("Error retrieving game details:", err)
    }
  })

  socket.on("send-total-rooms-and-users", async () => {
    try {
      const totalUsersReply = await redisClient.get("total-users")
      const totalUsers = totalUsersReply ? parseInt(totalUsersReply) : 0

      const totalRoomsReply = await redisClient.get("total-rooms")
      const totalRooms = totalRoomsReply ? parseInt(totalRoomsReply) : 0

      const numberOfRoomsReply = await redisClient.get("number-of-rooms")
      const numberOfRooms = numberOfRoomsReply
        ? JSON.parse(numberOfRoomsReply)
        : [0, 0, 0, 0]

      socket.emit(
        "receive-number-of-rooms-and-users",
        numberOfRooms,
        totalRooms,
        totalUsers
      )
    } catch (err) {
      console.error("Error fetching data from Redis:", err)
    }
  })

  socket.on("create-room", async (roomId, time, user, password = null) => {
    try {
      const reply = await redisClient.get(roomId)
      if (reply) {
        socket.emit("error", `Room with id '${roomId}' already exists`)
      } else {
        if (password) {
          await createRoom(roomId, user, time, password)
        } else {
          await createRoom(roomId, user, time)
        }
        socket.emit("room-created")
      }
    } catch (err) {
      console.error("Error creating room:", err)
      socket.emit("error", "Failed to create room")
    }
  })

  socket.on("join-room", async (roomId, user, password = null) => {
    try {
      const reply = await redisClient.get(roomId)

      if (reply) {
        let room = JSON.parse(reply)

        if (room.players[1] === null) {
          if (room.password && (!password || room.password !== password)) {
            socket.emit(
              "error",
              "To join the room you need the correct password!"
            )
            return
          }

          await joinRoom(roomId, user)

          if (room.password && password !== "") {
            socket.emit("room-joined", roomId, password)
          } else {
            socket.emit("room-joined", roomId)
          }
        } else {
          socket.emit("error", "The room is full!")
        }
      } else {
        socket.emit("error", `Room with id '${roomId}' does not exist`)
      }
    } catch (err) {
      console.error("Error joining room:", err)
      socket.emit("error", "An error occurred while joining the room.")
    }
  })

  /* socket.on("move-made",
    (
      roomId,
      move,
      pawnPromotion = null,
      castling = null,
      elPassantPerformed = false
    ) => {
      //ovde su svi potezi, izbrisacemo one koje necemo da implementiramo
      redisClient.get(roomId, (err, reply) => {
        if (err) throw err;
        if (reply) {
          let room = JSON.parse(reply);

          room.moves.push(move);

          redisClient.set(roomId, JSON.stringify(room));

          if (pawnPromotion) {
            socket
              .io(roomId)
              .emit("enemy-moved_pawn-promotion", move, pawnPromotion);
          } else if (castling) {
            socket.to(roomId).emit("enemy-moved_castling", castling);
          } else if (elPassantPerformed) {
            socket.io(roomId).emit("enemy-moved_el-passant", move);
          } else {
            socket.io(roomId).emit("enemy-moved", move);
          }
        } else {
          socket.emit("error", "Something went wrong with the connection");
        }
      });
    }
  );*/

  socket.on(
    "move-made",
    async (
      roomId,
      move,
      pawnPromotion = null,
      castling = null,
      elPassantPerformed = false
    ) => {
      try {
        const reply = await redisClient.get(roomId)

        if (reply) {
          let room = JSON.parse(reply)
          room.moves.push(move)

          await redisClient.set(roomId, JSON.stringify(room))

          if (pawnPromotion) {
            socket
              .to(roomId)
              .emit("enemy-moved_pawn-promotion", move, pawnPromotion)
          } else if (castling) {
            socket.to(roomId).emit("enemy-moved_castling", castling)
          } else if (elPassantPerformed) {
            socket.to(roomId).emit("enemy-moved_el-passant", move)
          } else {
            //console.log("radi dovde");
            socket.to(roomId).emit("enemy-moved", move)
          }
        } else {
          socket.emit("error", "Something went wrong with the connection")
        }
      } catch (err) {
        console.error("Error processing move:", err)
        socket.emit("error", "An error occurred while processing the move.")
      }
    }
  )

  socket.on("update-timer", (roomId, minutes, seconds) => {
    socket.to(roomId).emit("enemy-timer-updated", minutes, seconds)
  })

  socket.on("check", (roomId) => {
    socket.to(roomId).emit("king-is-attacked")
  })

  socket.on("join-random", async (user) => {
    try {
      const reply = await redisClient.get("rooms")

      if (reply) {
        let rooms = JSON.parse(reply)

        let room = rooms.find(
          (room) => room.players[1] === null && !room.password
        )

        if (room) {
          await joinRoom(room.id, user) // Dodano await za asinhroni poziv
          socket.emit("room-joined", room.id)
        } else {
          socket.emit("error", "No room found!")
        }
      } else {
        socket.emit("error", "No room found!")
      }
    } catch (err) {
      console.error("Error joining random room:", err)
      socket.emit("error", "An error occurred while joining a random room.")
    }
  })

  socket.on("get-rooms", async (rank) => {
    try {
      const reply = await redisClient.get("rooms")
      if (reply) {
        let rooms = JSON.parse(reply)
        if (rank === "all") {
          socket.emit("receive-rooms", rooms)
        } else {
          let filteredRooms = rooms.filter(
            (room) => room.players[0].user_rank === rank
          )
          socket.emit("receive-rooms", filteredRooms)
        }
      } else {
        socket.emit("receive-rooms", [])
      }
    } catch (err) {
      console.error("Error fetching rooms from Redis:", err)
    }
  })

  socket.on("send-message", (message, user, roomId = null) => {
    if (roomId) {
      socket.to(roomId).emit("receive-message", message, user)
    } else {
      socket.broadcast.emit("receive-message", message, user, true)
    }
  })

  socket.on("checkmate", async (roomId, winner, score, startedAt) => {
    try {
      const reply = await redisClient.get(roomId)
      if (reply) {
        let room = JSON.parse(reply)

        await redisClient.del(`${room.players[0].id}-played-games`)
        await redisClient.del(`${room.players[1].id}-played-games`)

        room.gameFinished = true

        await redisClient.set(roomId, JSON.stringify(room))

        socket.to(roomId).emit("you-lost", winner, score)

        let query = `INSERT INTO games(timer, moves, user_id_light, user_id_black, started_at)
        VALUES('${room.time + ""}', '${JSON.stringify(room.moves)}',${
          room.players[0].id
        }, ${room.players[1].id}, '${startedAt + ""}')`

        db.query(query, (err) => {
          if (err) throw err
        })
      }
    } catch (err) {
      console.error(err)
    }
  })

  socket.on("timer-ended", async (roomId, loser, startedAt) => {
    try {
      const reply = await redisClient.get(roomId)
      if (reply) {
        let room = JSON.parse(reply)

        await redisClient.del(`${room.players[0].id}-played-games`)
        await redisClient.del(`${room.players[1].id}-played-games`)

        room.gameFinished = true

        await redisClient.set(roomId, JSON.stringify(room))

        let winner
        if (room.players[0].username === loser) {
          winner = room.players[1].username
        } else {
          winner = room.players[0].username
        }

        socket.emit("you-lost", winner)
        socket.to(roomId).emit("you-won")

        let query = `INSERT INTO games(timer, moves, user_id_light, user_id_black, started_at)
        VALUES('${room.time + ""}', '${JSON.stringify(room.moves)}',${
          room.players[0].id
        }, ${room.players[1].id}, '${startedAt + ""}')`

        db.query(query, (err) => {
          if (err) throw err
        })
      }
    } catch (err) {
      console.error(err)
    }
  })

  socket.on("draw", (roomId) => {
    socket.to(roomId).emit("draw")
  })

  socket.on("update-score", async (roomId, playerOneScore, playerTwoScore) => {
    try {
      const reply = await redisClient.get(roomId)
      if (reply) {
        let room = JSON.parse(reply)

        let userOne = room.players[0]
        let userTwo = room.players[1]

        userOne.user_points += playerOneScore
        userTwo.user_points += playerTwoScore

        let query = `
        CALL updateScores(
            '${userOne.username}',
            '${Math.max(userOne.user_points, 0)}',
            '${userTwo.username}',
            '${Math.max(userTwo.user_points, 0)}'
        )
      `

        await db.query(query, (err) => {
          if (err) throw err
        })

        await redisClient.set(userOne.username + "-score-updated", "true")
        await redisClient.set(userTwo.username + "-score-updated", "true")
      }
    } catch (err) {
      console.error(err)
    }
  })
  socket.on("disconnect", async () => {
    try {
      const reply = await redisClient.get(socket.id)
      if (reply) {
        let user = JSON.parse(reply)
        if (user.room) {
          const roomReply = await redisClient.get(user.room)
          if (roomReply) {
            let room = JSON.parse(reply)
            //ovde da li treba >=1 jer izbacuje gresku prilikom diskonekcije
            if (!room.gameFinished && room.players.length > 1) {
              io.to(user.room).emit("error", "The other player left the game")
              return
            }
          }

          await removeRoom(user.room, user.user_rank)
        }
      }
      await removeUser(socket.id)
    } catch (err) {
      console.error("Error during disconnect:", err)
    }
  })
})

const PORT = parseInt(process.env.PORT) || 5000

server.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`)
})
