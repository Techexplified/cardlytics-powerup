"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
const mongodb_1 = require("mongodb");
const env_1 = require("../config/env");
let client = null;
async function getDb() {
    if (!client) {
        client = new mongodb_1.MongoClient(env_1.env.MONGO_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 10000,
        });
        await client.connect();
    }
    return client.db(env_1.env.MONGO_DB_NAME);
}
//# sourceMappingURL=db.js.map