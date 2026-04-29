import mongoose, { type ConnectOptions, type Mongoose } from "mongoose";

import { getEnv } from "@/lib/utils";

type MongooseCache = {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const globalCache = globalThis.mongooseCache ?? {
  conn: null,
  promise: null,
};

globalThis.mongooseCache = globalCache;

mongoose.set("strictQuery", true);
mongoose.set("bufferCommands", true);
mongoose.set("maxTimeMS", 10000);

function getConnectionOptions(): ConnectOptions {
  const dbName = process.env.MONGODB_DB?.trim();

  return {
    appName: "gsms-next",
    dbName: dbName || undefined,
    family: 4,
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5_000,
    socketTimeoutMS: 45_000,
  };
}

export async function connectToDatabase(): Promise<Mongoose> {
  if (globalCache.conn && globalCache.conn.connection.readyState === 1) {
    return globalCache.conn;
  }

  if (!globalCache.promise) {
    const mongoUri = getEnv("MONGODB_URI");

    globalCache.promise = mongoose
      .connect(mongoUri, getConnectionOptions())
      .then((mongooseInstance) => mongooseInstance);
  }

  try {
    globalCache.conn = await globalCache.promise;
  } catch (error) {
    globalCache.promise = null;
    throw error;
  }

  return globalCache.conn;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
  globalCache.conn = null;
  globalCache.promise = null;
}

export function getDatabaseStatus(): {
  readyState: number;
  databaseName: string | null;
  host: string | null;
} {
  return {
    readyState: mongoose.connection.readyState,
    databaseName: mongoose.connection.db?.databaseName ?? null,
    host: mongoose.connection.host || null,
  };
}

export default connectToDatabase;
