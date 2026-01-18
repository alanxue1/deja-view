import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_DEV_URI;
const uriProd = process.env.MONGODB_PROD_URI;
const options = {};

let clientPromise: Promise<MongoClient> | null = null;

function getClientPromise(): Promise<MongoClient> {
  const isDev = process.env.NODE_ENV === "development";
  const activeUri = isDev ? uri : uriProd;

  if (!activeUri) {
    throw new Error(
      `Add ${isDev ? "MONGODB_DEV_URI" : "MONGODB_PROD_URI"} to .env.local (e.g. mongodb+srv://... or mongodb://localhost:27017)`
    );
  }

  if (isDev) {
    const g = globalThis as typeof globalThis & { _mongoClientPromise?: Promise<MongoClient> };
    if (!g._mongoClientPromise) {
      g._mongoClientPromise = new MongoClient(activeUri, options).connect();
    }
    return g._mongoClientPromise;
  }

  if (!clientPromise) {
    clientPromise = new MongoClient(activeUri, options).connect();
  }
  return clientPromise;
}

export async function getDb(dbName = "deja-view"): Promise<Db> {
  const c = await getClientPromise();
  return c.db(dbName);
}
