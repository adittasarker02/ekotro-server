import "dotenv/config";
import { MongoClient } from "mongodb";

/** `npm run check:db` : tells you in plain words whether MongoDB is connected. */
const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || "ekotro";

function explain(message: string): string {
  if (/bad auth|authentication failed/i.test(message)) return "Wrong username or password in MONGODB_URI. If the password has special characters (@ # / :), create a new Atlas user with a simple letters-and-numbers password.";
  if (/ENOTFOUND|querySrv|getaddrinfo/i.test(message)) return "The cluster address in MONGODB_URI is wrong, or your internet / DNS is blocking it. Copy the connection string again from Atlas > Connect.";
  if (/ECONNREFUSED/i.test(message)) return "Nothing is listening at that address. For a local MongoDB, start the mongod service first.";
  if (/timed out|ReplicaSetNoPrimary|Server selection|ETIMEDOUT|SSL|TLS/i.test(message)) return "Atlas blocked the connection. Open Atlas > Network Access > Add IP Address > Allow access from anywhere (0.0.0.0/0), wait one minute, then try again. A VPN can also cause this.";
  return "See the error above.";
}

async function main() {
  if (!uri) {
    console.error("\n❌ MONGODB_URI is empty. Open the .env file in this folder and paste your MongoDB connection string.\n");
    process.exit(1);
  }
  if (uri.includes("<") || uri.includes(">")) {
    console.error("\n❌ MONGODB_URI still contains <password> placeholders. Replace <db_password> with your real password (remove the < >).\n");
    process.exit(1);
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    console.log("Connecting to MongoDB…");
    await client.connect();
    await client.db(dbName).command({ ping: 1 });
    const db = client.db(dbName);
    const [events, joins] = await Promise.all([db.collection("events").estimatedDocumentCount(), db.collection("joins").estimatedDocumentCount()]);
    console.log(`\n✅ MongoDB is connected.\n   database : ${dbName}\n   events   : ${events}${events === 0 ? "  (empty: run  npm run seed  to add sample events)" : ""}\n   joins    : ${joins}\n`);
  } catch (err) {
    const message = (err as Error).message;
    console.error(`\n❌ MongoDB is NOT connected.\n   ${message.split("\n")[0]}\n\n   Fix: ${explain(message)}\n`);
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => undefined);
  }
}

void main();
