import { ObjectId } from "mongodb";

/**
 * Minimal in-memory stand-in for a MongoDB collection. It implements only what the
 * API uses, so route logic can be tested without a running database.
 */
type Doc = Record<string, any>;

const same = (a: unknown, b: unknown) =>
  a instanceof ObjectId || b instanceof ObjectId
    ? String(a) === String(b)
    : a instanceof Date && b instanceof Date
      ? a.getTime() === b.getTime()
      : a === b;

function matches(doc: Doc, filter: Doc): boolean {
  return Object.entries(filter).every(([key, cond]) => {
    if (key === "$or") return (cond as Doc[]).some((f) => matches(doc, f));
    const v = doc[key];
    if (cond instanceof RegExp) return typeof v === "string" && cond.test(v);
    if (cond && typeof cond === "object" && !(cond instanceof ObjectId) && !(cond instanceof Date)) {
      return Object.entries(cond).every(([op, arg]) => {
        if (op === "$gte") return v >= (arg as any);
        if (op === "$in") return (arg as unknown[]).some((x) => same(x, v));
        throw new Error(`fake: unsupported operator ${op}`);
      });
    }
    return same(v, cond);
  });
}

function applyUpdate(doc: Doc, update: Doc) {
  for (const [op, fields] of Object.entries(update)) {
    for (const [k, val] of Object.entries(fields as Doc)) {
      if (op === "$set") doc[k] = val;
      else if (op === "$inc") doc[k] = (doc[k] ?? 0) + (val as number);
      else throw new Error(`fake: unsupported update ${op}`);
    }
  }
}

export class FakeCollection {
  docs: Doc[] = [];
  constructor(private uniqueKeys: string[] = []) {}

  async insertOne(doc: Doc) {
    if (this.uniqueKeys.length && this.docs.some((d) => this.uniqueKeys.every((k) => same(d[k], doc[k])))) {
      throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
    }
    const _id = new ObjectId();
    this.docs.push({ ...doc, _id });
    return { insertedId: _id };
  }
  async findOne(filter: Doc) {
    return this.docs.find((d) => matches(d, filter)) ?? null;
  }
  find(filter: Doc = {}) {
    let rows = this.docs.filter((d) => matches(d, filter));
    const cursor = {
      sort: (s: Doc) => {
        const entries = Object.entries(s);
        rows = [...rows].sort((a, b) => {
          for (const [k, dir] of entries) {
            const av = a[k] instanceof Date ? a[k].getTime() : a[k];
            const bv = b[k] instanceof Date ? b[k].getTime() : b[k];
            if (av < bv) return -1 * (dir as number);
            if (av > bv) return 1 * (dir as number);
          }
          return 0;
        });
        return cursor;
      },
      skip: (n: number) => ((rows = rows.slice(n)), cursor),
      limit: (n: number) => ((rows = rows.slice(0, n)), cursor),
      toArray: async () => rows,
    };
    return cursor;
  }
  async countDocuments(filter: Doc = {}) {
    return this.docs.filter((d) => matches(d, filter)).length;
  }
  async updateOne(filter: Doc, update: Doc) {
    const d = this.docs.find((x) => matches(x, filter));
    if (d) applyUpdate(d, update);
    return { matchedCount: d ? 1 : 0 };
  }
  async updateMany(filter: Doc, update: Doc) {
    const rows = this.docs.filter((x) => matches(x, filter));
    rows.forEach((d) => applyUpdate(d, update));
    return { matchedCount: rows.length };
  }
  async findOneAndUpdate(filter: Doc, update: Doc) {
    const d = this.docs.find((x) => matches(x, filter));
    if (!d) return null;
    applyUpdate(d, update);
    return d;
  }
  async deleteOne(filter: Doc) {
    const i = this.docs.findIndex((x) => matches(x, filter));
    if (i >= 0) this.docs.splice(i, 1);
    return { deletedCount: i >= 0 ? 1 : 0 };
  }
  async deleteMany(filter: Doc) {
    const before = this.docs.length;
    this.docs = this.docs.filter((x) => !matches(x, filter));
    return { deletedCount: before - this.docs.length };
  }
}
