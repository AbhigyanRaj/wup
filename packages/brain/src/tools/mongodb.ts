import { MongoClient } from "mongodb";
import { cryptoService } from "../utils/crypto";
import { Connection } from "../../../../apps/api/src/models/Connection";

/**
 * Executes a Read-Only MongoDB query on behalf of the Brain.
 */
export const query_mongodb = async ({ connectionId, collection, query, limit = 10 }: {
  connectionId: string,
  collection: string,
  query: any,
  limit?: number
}) => {
  console.log(`[WUP Brain Tool] Querying MongoDB: ${collection} for connection ${connectionId}`);

  try {
    const conn = await Connection.findById(connectionId);
    if (!conn) throw new Error("Connection not found");
    if (conn.type !== 'mongodb') throw new Error("Invalid connection type");

    // 1. Decrypt connection string
    const connectionString = cryptoService.decrypt(conn.config);

    // 2. Connect and Query (Read-Only)
    const client = new MongoClient(connectionString);
    await client.connect();
    
    const db = client.db(); // Uses default db from connection string
    const results = await db.collection(collection).find(query || {}).limit(limit).toArray();
    
    await client.close();

    return {
      success: true,
      data: results,
      count: results.length
    };
  } catch (err: any) {
    console.error("[WUP Brain Tool] MongoDB EXECUTION ERROR:", err);
    return {
      success: false,
      error: err.message
    };
  }
};

/**
 * Fetches the schema/collections of a MongoDB bridge.
 */
export const get_mongodb_schema = async ({ connectionId }: { connectionId: string }) => {
  try {
    const conn = await Connection.findById(connectionId);
    if (!conn) throw new Error("Connection not found");

    const connectionString = cryptoService.decrypt(conn.config);
    const client = new MongoClient(connectionString);
    await client.connect();

    const db = client.db();
    const collections = await db.listCollections().toArray();
    
    await client.close();

    return {
      success: true,
      collections: collections.map(c => c.name)
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};
