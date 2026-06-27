"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsersCollection = getUsersCollection;
exports.createUserIndexes = createUserIndexes;
const db_1 = require("../config/db");
//Collection accessor
async function getUsersCollection() {
    const db = await (0, db_1.getDb)();
    return db.collection('users');
}
async function createUserIndexes() {
    const col = await getUsersCollection();
    await col.createIndex({ atlassianId: 1 }, { unique: true });
    await col.createIndex({ paddle_customer_id: 1 });
}
//# sourceMappingURL=users.js.map