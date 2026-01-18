import { MongoClient, Db } from "mongodb";

const options = {};

let clientPromise: Promise<MongoClient> | null = null;

function getClientPromise(): Promise<MongoClient> {
  const isDev = process.env.NODE_ENV === "development";
  
  // Read env vars inside the function - prioritize MONGODB_ATLAS_URI
  const uri = process.env.MONGODB_ATLAS_URI || process.env.MONGODB_DEV_URI;
  const uriProd = process.env.MONGODB_ATLAS_URI || process.env.MONGODB_PROD_URI;
  const activeUri = isDev ? uri : uriProd;
  
  console.log("🔗 MongoDB connecting to:", activeUri?.substring(0, 40) + "...");

  if (!activeUri) {
    throw new Error(
      `Add MONGODB_DEV_URI or MONGODB_ATLAS_URI to .env.local (e.g. mongodb+srv://...)`
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
