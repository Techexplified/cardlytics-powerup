import * as dotenv from "dotenv";
dotenv.config(); // ← FIRST, before everything else

import * as functions from "firebase-functions";
import app from "./app";

export const cardlyticsApi = functions.https.onRequest(app);

