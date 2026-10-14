import mongoose from "mongoose";

/**
 * Registers a model once per mongoose instance.
 *
 * If the same model file is evaluated twice (for example once from src via the
 * "development" export condition and once from dist, or under hot reload),
 * mongoose.model() would throw OverwriteModelError. This returns the model that
 * is already registered instead.
 *
 *   export const Chat = registerModel("Chat", () => mongoose.model("Chat", chatSchema));
 */
export function registerModel<T>(name: string, factory: () => T): T {
  const existing = mongoose.models[name] as T | undefined;
  return existing ?? factory();
}
