const redis = require("redis");
const dotenv = require("dotenv");
dotenv.config();

//trenutno cemo koristiti localhost, al kasnije kad pomocu dokera napravimo server tad cemo REDIS_HOST  
const host = process.env.REDIS_HOST || "localhost";
const port = process.env.REDIS_PORT || 6379;

const redisClient = redis.createClient({
    url: `redis://${host}:${port}`
});

/*
redisClient.on("error", (err) => { 
    console.log(err);
    process.exit(1);
})
*/
/*
redisClient.on("connect", () => {
    console.log("Connecting to Redis");
})
*/

async function connectRedis() {
    try {
        await redisClient.connect();
        console.log("Connected to Redis");
    } catch (err) {
        console.error("Error connecting to Redis:", err);
        process.exit(1);
    }
}

connectRedis();

module.exports = redisClient;
