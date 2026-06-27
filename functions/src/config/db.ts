import { MongoClient, Db } from "mongodb";
import { env } from "../config/env";

let clientPromise: Promise<MongoClient> | null = null;

function createClient(): Promise<MongoClient> {
  
  const client = new MongoClient(env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    tls: true,
    tlsAllowInvalidCertificates: false,
  });

  // if the driver itself detects the topology closing, drop our cached
  // promise so the next call reconnects instead of reusing a dead client
  client.on("close", () => {
    clientPromise = null;
  });

  return client.connect();
}

export async function getDb(): Promise<Db> {
  if (!clientPromise) {
    clientPromise = createClient();
  }

  try {
    const client = await clientPromise;
    return client.db(env.MONGO_DB_NAME);
  } catch (err) {
    // connect() itself failed — clear cache so next call retries cleanly
    clientPromise = null;
    throw err;
  }
}

