import { redisCache } from "./server/cache/redis.js";
console.log("Testing Redis operations...");
(async () => {
  try {
    console.log("Setting test key...");
    await redisCache.set("test-integration", {"test": "data"}, 3600);
    console.log("Getting test key...");
    const result = await redisCache.get("test-integration");
    console.log("Redis result:", result);
    console.log("Testing exists...");
    const exists = await redisCache.exists("test-integration");
    console.log("Key exists:", exists);
    process.exit(0);
  } catch (error) {
    console.log("Redis error:", error.message);
    process.exit(1);
  }
})();
