import { ObjectId } from "mongodb";
import { HttpError } from "./httpError.js";

export function toObjectId(id: string | string[] | undefined): ObjectId {
  if (typeof id !== "string" || !id || !ObjectId.isValid(id) || String(new ObjectId(id)) !== id) {
    throw new HttpError(400, "Invalid id");
  }
  return new ObjectId(id);
}
