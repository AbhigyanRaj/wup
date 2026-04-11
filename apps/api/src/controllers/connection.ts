import { Request, Response } from "express";
import { Connection } from "../models/Connection";
import { cryptoService } from "@wup/brain";

/**
 * Controller for managing external data connections.
 */

export const createConnection = async (req: Request, res: Response) => {
  const { name, type, config } = req.body;
  const userId = (req as any).user.id;

  try {
    // Encrypt the sensitive configuration before saving
    const encryptedConfig = cryptoService.encrypt(typeof config === 'string' ? config : JSON.stringify(config));

    const connection = await Connection.create({
      userId,
      name,
      type,
      config: encryptedConfig
    });

    res.status(201).json({ 
      message: "Connection bridged successfully", 
      id: connection._id,
      name: connection.name,
      type: connection.type
    });
  } catch (err: any) {
    console.error("[WUP API] Create Connection Error:", err);
    res.status(500).json({ error: "Failed to create connection", message: err.message });
  }
};

export const getConnections = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  try {
    const connections = await Connection.find({ userId }).select("-config");
    res.json(connections);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch connections" });
  }
};

export const deleteConnection = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user.id;

  try {
    const connection = await Connection.findOneAndDelete({ _id: id, userId });
    if (!connection) return res.status(404).json({ error: "Connection not found" });
    
    res.json({ message: "Connection removed successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete connection" });
  }
};
