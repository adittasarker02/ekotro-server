import { EVENT_TYPES, type EventType } from "../types/index.js";

export const SEED_EMAIL = "team@ekotro.org";

interface SeedDef {
  title: string;
  eventType: EventType;
  location: string;
  daysFromNow: number;
  hour: number; // Dhaka time, 24h
  minute: number;
  thumbnail: string;
  description: string;
}

const DEFS: SeedDef[] = [
  {
    title: "Winter Clothes & Jama-Kapor Distribution",
    eventType: "Donation",
    location: "Mirpur 10, Dhaka",
    daysFromNow: 4,
    hour: 10,
    minute: 0,
    thumbnail: "/photos/1-donation.jpg",
    description:
      "Help us hand out warm jackets, sweaters and jama-kapor to families who cannot afford them this winter. Volunteers are needed to sort donated clothes by size, manage the queue and carry bags for elderly visitors. Bring any clean, usable winter clothing you can spare.",
  },
  {
    title: "Greener Hatirjheel Tree Plantation Drive",
    eventType: "Plantation",
    location: "Hatirjheel Lakeside, Dhaka",
    daysFromNow: 6,
    hour: 8,
    minute: 30,
    thumbnail: "/photos/2-plantation.jpg",
    description:
      "Join your neighbours to plant more than 300 native saplings along the lakeside walkway. Tools, saplings and refreshments are provided. Wear comfortable clothes and shoes, and bring a water bottle. Families and school students are warmly welcome.",
  },
  {
    title: "Blanket Distribution for the Needy",
    eventType: "Donation",
    location: "Mohammadpur, Dhaka",
    daysFromNow: 7,
    hour: 16,
    minute: 0,
    thumbnail: "/photos/6-blanket.jpg",
    description:
      "Cold nights are hardest on people sleeping outdoors. We will distribute 500 blankets to rickshaw pullers, street vendors and families in nearby settlements. Volunteers will help pack blankets, guide drivers and keep the distribution orderly and respectful.",
  },
  {
    title: "Community Park & River Cleanup Drive",
    eventType: "Cleanup",
    location: "Sadarghat Riverside, Dhaka",
    daysFromNow: 9,
    hour: 7,
    minute: 30,
    thumbnail: "/photos/3-cleanup.jpg",
    description:
      "Let us clear plastic and litter from the park and riverbank together. Gloves, bags and sorting bins for plastic, paper and metal will be ready at the start point. Every bag collected makes our river a little healthier for the families who live beside it.",
  },
  {
    title: "Meals for Families: Food Distribution Day",
    eventType: "Food Distribution",
    location: "Kamrangirchar, Dhaka",
    daysFromNow: 11,
    hour: 12,
    minute: 0,
    thumbnail: "/photos/4-food-distribution.jpg",
    description:
      "We are packing rice, dal and vegetables into family meal kits and handing them out to 300 households. Volunteers can help with packing, serving and carrying kits to elderly neighbours who cannot queue. Please arrive 30 minutes early for a short briefing.",
  },
  {
    title: "Community Blood Donation Camp",
    eventType: "Blood Donation",
    location: "Dhanmondi 27, Dhaka",
    daysFromNow: 14,
    hour: 9,
    minute: 0,
    thumbnail: "/photos/5-blood-donation.jpg",
    description:
      "Give blood, save lives. Trained medical staff will run free blood group testing and safe donation beds all day, with refreshments afterwards. Healthy adults aged 18 to 60 can donate. Please eat well, drink water and bring a valid ID.",
  },
  {
    title: "Free Evening School for Children",
    eventType: "Education",
    location: "Korail, Dhaka",
    daysFromNow: 18,
    hour: 15,
    minute: 0,
    thumbnail: "/photos/7-education.jpg",
    description:
      "Volunteer teachers and mentors are invited to run reading, maths and hygiene sessions for children who miss out on regular school. We will provide books, notebooks and a safe, shaded learning space. A few hours of your time can change a child's year.",
  },
  {
    title: "Free Health Camp & Eye Checkup",
    eventType: "Health Camp",
    location: "Savar Bazar, Dhaka",
    daysFromNow: 21,
    hour: 9,
    minute: 30,
    thumbnail: "/photos/8-health-camp.jpg",
    description:
      "Doctors and nurses will offer free general checkups, eye tests, blood pressure and blood sugar screening, plus basic medicines. Volunteers are needed for registration, queue management and helping patients find the right booth.",
  },
  {
    title: "School Campus Tree Plantation",
    eventType: "Plantation",
    location: "Uttara Sector 9, Dhaka",
    daysFromNow: 25,
    hour: 9,
    minute: 0,
    thumbnail: "/photos/2-plantation.jpg",
    description:
      "Students, parents and teachers will plant fruit and shade trees around the school grounds, and every class will adopt one tree to look after. Come and help dig, plant and water. We will provide saplings, tools and a light snack for everyone.",
  },
  {
    title: "Warm Clothes Drive for Hill Tracts Families",
    eventType: "Donation",
    location: "Agrabad, Chattogram",
    daysFromNow: 28,
    hour: 11,
    minute: 0,
    thumbnail: "/photos/1-donation.jpg",
    description:
      "We are collecting sweaters, shawls and children's winter wear to send to remote hill families before the coldest weeks arrive. Help us sort, pack and label the parcels at our Chattogram collection point. Drop off donations or give a few hours to pack.",
  },
];

/** Today's calendar date in Dhaka (UTC+6) plus `days`, at hh:mm Dhaka time, returned as a UTC Date. */
export function dhakaDate(now: Date, days: number, hour: number, minute: number): Date {
  const dhakaNow = new Date(now.getTime() + 6 * 3_600_000);
  return new Date(Date.UTC(dhakaNow.getUTCFullYear(), dhakaNow.getUTCMonth(), dhakaNow.getUTCDate() + days, hour - 6, minute));
}

export function buildSeedEvents(now = new Date()) {
  return DEFS.map((d) => ({
    title: d.title,
    description: d.description,
    eventType: d.eventType,
    thumbnail: d.thumbnail,
    location: d.location,
    eventDate: dhakaDate(now, d.daysFromNow, d.hour, d.minute),
    creatorEmail: SEED_EMAIL,
    creatorName: "Ekotro Team",
    creatorId: "ekotro-seed",
    participantsCount: 0,
    createdAt: now,
    updatedAt: now,
  }));
}

export const SEED_TYPES_COVERED = EVENT_TYPES;
