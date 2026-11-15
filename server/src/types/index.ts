import type { ObjectId } from "mongodb";

export const EVENT_TYPES = [
  "Cleanup",
  "Plantation",
  "Donation",
  "Food Distribution",
  "Blood Donation",
  "Education",
  "Health Camp",
  "Other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface EventDoc {
  _id: ObjectId;
  title: string;
  description: string;
  eventType: EventType;
  thumbnail: string;
  location: string;
  eventDate: Date;
  creatorEmail: string;
  creatorName: string;
  creatorId: string;
  participantsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface JoinDoc {
  _id: ObjectId;
  eventId: ObjectId;
  userEmail: string;
  userName: string;
  userId: string;
  userImage?: string;
  /** Snapshot of the event at the time of joining */
  event: {
    title: string;
    thumbnail: string;
    location: string;
    eventType: EventType;
    eventDate: Date;
  };
  joinedAt: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
}
