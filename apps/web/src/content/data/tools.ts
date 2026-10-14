import type { ProseSection, ToolExample, ToolPage } from "../types";
import { formatQuery, type JsonObject, type MongoQuery } from "../../lib/tools/mongo-format";
import { IDS } from "./sample-datasets";

/**
 * Free tool pages (/tools/<id>).
 *
 * Every example carries its query as structured Extended JSON (`query`);
 * `output.code` is generated from it, so the code shown is exactly what
 * scripts/verify-tool-examples.mjs runs against the sample datasets.
 * `resultPreview` rows are compared with the real results (first N rows).
 */

export type ToolMode = "query" | "aggregation" | "explain" | "sql" | "schema";

export interface ToolExampleFull extends ToolExample {
  query: MongoQuery;
  /** SQL statement for sql-to-mongodb examples. */
  sql?: string;
}

export interface ToolPageFull extends ToolPage {
  mode: ToolMode;
  /** Short product-style name for cards, e.g. "Query generator". */
  name: string;
  /** One-line card summary for the tools hub. */
  summary: string;
  examples: ToolExampleFull[];
  /** The explanation section: what the tool does and the concepts behind it. */
  sections: ProseSection[];
  /** Whether the tool calls the model (false = fully in the browser). */
  usesModel: boolean;
}

const date = (iso: string) => ({ $date: iso });
const oid = (hex: string) => ({ $oid: hex });

type ExampleInput = Omit<ToolExampleFull, "output">;

function ex(e: ExampleInput): ToolExampleFull {
  return { ...e, output: { kind: e.query.kind, code: formatQuery(e.query, "mongosh") } };
}

const find = (collection: string, filter: JsonObject, opts: Partial<MongoQuery> = {}): MongoQuery => ({
  kind: "find",
  collection,
  filter,
  ...opts,
});
const agg = (collection: string, pipeline: JsonObject[]): MongoQuery => ({ kind: "aggregate", collection, pipeline });

const GUIDES = {
  plainEnglish: "/guides/query-mongodb-in-plain-english",
  aggregation: "/guides/mongodb-aggregation-pipeline-examples",
  sql: "/guides/sql-to-mongodb-cheat-sheet",
  schema: "/guides/infer-mongodb-schema-from-documents",
  readOnly: "/guides/mongodb-read-only-user",
} as const;

/* ------------------------------------------------------------------ */
/* MongoDB query generator                                             */
/* ------------------------------------------------------------------ */

const queryExamples: ToolExampleFull[] = [
  ex({
    id: "delivered-newest-first",
    title: "Delivered orders, newest first",
    dataset: "orders",
    question: "Show delivered orders, newest first",
    query: find("orders", { status: "delivered" }, { sort: { createdAt: -1 }, limit: 20 }),
    explanation: [
      "An equality match on status keeps only delivered orders.",
      "sort({ createdAt: -1 }) puts the most recent order first.",
      "limit(20) keeps the result small; raise it if you need more.",
    ],
    resultPreview: { columns: ["orderNumber", "total", "paymentMethod"], rows: [["A-1001", 9097, "upi"], ["A-1003", 12999, "card"]] },
  }),
  ex({
    id: "large-card-orders",
    title: "Large card payments",
    dataset: "orders",
    question: "Orders over 10,000 paid by card, biggest first, just the number, status and total",
    query: find(
      "orders",
      { total: { $gt: 10000 }, paymentMethod: "card" },
      { projection: { _id: 0, orderNumber: 1, status: 1, total: 1 }, sort: { total: -1 }, limit: 20 }
    ),
    explanation: [
      "Two conditions in one filter object are combined with AND.",
      "$gt is a strict greater than, so an order of exactly 10,000 is excluded.",
      "The projection returns only the three fields asked for and hides _id.",
    ],
    resultPreview: {
      columns: ["orderNumber", "status", "total"],
      rows: [["A-1002", "shipped", 37998], ["A-1005", "pending", 32496], ["A-1003", "delivered", 12999]],
    },
  }),
  ex({
    id: "orders-in-a-month",
    title: "Orders placed in one month",
    dataset: "orders",
    question: "Orders placed in September 2026, oldest first",
    query: find(
      "orders",
      { createdAt: { $gte: date("2026-09-01T00:00:00Z"), $lt: date("2026-10-01T00:00:00Z") } },
      { sort: { createdAt: 1 }, limit: 20 }
    ),
    explanation: [
      "A half-open range ($gte the first day, $lt the next month) catches every timestamp in September.",
      "Dates are compared as real BSON dates, written ISODate(...) in mongosh.",
      "Ranges like this use an index on createdAt if one exists.",
    ],
    resultPreview: { columns: ["orderNumber", "status"], rows: [["A-1001", "delivered"], ["A-1002", "shipped"], ["A-1004", "cancelled"]] },
  }),
  ex({
    id: "orders-containing-a-product",
    title: "Orders that contain a product",
    dataset: "orders",
    question: "Which orders include the wireless mouse (SKU MS-110)?",
    query: find(
      "orders",
      { "items.sku": "MS-110" },
      { projection: { _id: 0, orderNumber: 1, status: 1 }, sort: { orderNumber: 1 }, limit: 20 }
    ),
    explanation: [
      'Dot notation ("items.sku") looks inside every element of the items array.',
      "A document matches if any line item has that SKU, no $unwind needed.",
    ],
    resultPreview: { columns: ["orderNumber", "status"], rows: [["A-1001", "delivered"], ["A-1004", "cancelled"]] },
  }),
  ex({
    id: "orders-by-city",
    title: "Orders to two cities, not cancelled",
    dataset: "orders",
    question: "Orders shipped to Mumbai or Bengaluru that were not cancelled",
    query: find(
      "orders",
      { "shipping.city": { $in: ["Mumbai", "Bengaluru"] }, status: { $ne: "cancelled" } },
      { sort: { total: -1 }, limit: 20 }
    ),
    explanation: [
      "$in matches any of the listed cities inside the embedded shipping object.",
      "$ne excludes cancelled orders (it also matches documents with no status field).",
    ],
    resultPreview: {
      columns: ["orderNumber", "shipping.city", "total"],
      rows: [["A-1002", "Mumbai", 37998], ["A-1005", "Mumbai", 32496], ["A-1001", "Bengaluru", 9097]],
    },
  }),
  ex({
    id: "orders-for-one-customer",
    title: "Orders for one customer id",
    dataset: "orders",
    question: `All orders for customer ${IDS.c2}, newest first`,
    query: find("orders", { customerId: oid(IDS.c2) }, { sort: { createdAt: -1 }, limit: 20 }),
    explanation: [
      "customerId is stored as an ObjectId, so the value must be ObjectId(...), not a plain string.",
      "A string would silently match nothing: the most common reason a correct-looking query returns no rows.",
    ],
    resultPreview: { columns: ["orderNumber", "status", "total"], rows: [["A-1005", "pending", 32496], ["A-1002", "shipped", 37998]] },
  }),
  ex({
    id: "paid-customers-opted-in",
    title: "Paid customers who opted in",
    dataset: "customers",
    question: "Name, email and plan of customers on a paid plan who opted in to marketing",
    query: find(
      "customers",
      { plan: { $in: ["pro", "business"] }, marketingOptIn: true },
      { projection: { _id: 0, name: 1, email: 1, plan: 1 }, sort: { name: 1 }, limit: 20 }
    ),
    explanation: [
      '"Paid plan" is read as pro or business, based on the plan values in the sample.',
      "marketingOptIn is a boolean, so it is matched with true, not the string \"true\".",
    ],
    resultPreview: {
      columns: ["name", "email", "plan"],
      rows: [["Aarav Mehta", "aarav@example.com", "pro"], ["Sofia Rossi", "sofia@example.com", "pro"]],
    },
  }),
  ex({
    id: "customers-missing-phone",
    title: "Customers with no phone number",
    dataset: "customers",
    question: "Customers who have no phone number on file",
    query: find(
      "customers",
      { phone: { $exists: false } },
      { projection: { _id: 0, name: 1, country: 1 }, sort: { name: 1 }, limit: 20 }
    ),
    explanation: [
      "$exists: false matches documents where the field is missing entirely.",
      "Use { phone: null } instead if you also want documents where phone is explicitly null.",
    ],
    resultPreview: { columns: ["name", "country"], rows: [["Daniel Okafor", "NG"], ["Kenji Watanabe", "JP"], ["Sofia Rossi", "IT"]] },
  }),
  ex({
    id: "urgent-open-tickets",
    title: "High-priority tickets still open",
    dataset: "tickets",
    question: "Open or pending tickets with high or urgent priority, oldest first",
    query: find(
      "tickets",
      { status: { $in: ["open", "pending"] }, priority: { $in: ["high", "urgent"] } },
      { sort: { createdAt: 1 }, limit: 20 }
    ),
    explanation: [
      "Two $in lists, combined with AND: the status must be in the first and the priority in the second.",
      "Oldest first puts the tickets that have waited longest at the top.",
    ],
    resultPreview: {
      columns: ["ticketNumber", "priority", "subject"],
      rows: [["T-5001", "high", "Invoice shows the wrong GST number"], ["T-5005", "urgent", "Bulk order delivery delayed"]],
    },
  }),
  ex({
    id: "tickets-awaiting-first-response",
    title: "Tickets with no first response",
    dataset: "tickets",
    question: "Unresolved tickets that have not had a first response yet",
    query: find(
      "tickets",
      { firstResponseAt: null, status: { $nin: ["resolved", "closed"] } },
      { sort: { createdAt: 1 }, limit: 20 }
    ),
    explanation: [
      "{ firstResponseAt: null } matches both a null value and a missing field.",
      "$nin excludes tickets that are already resolved or closed.",
    ],
    resultPreview: { columns: ["ticketNumber", "channel", "subject"], rows: [["T-5005", "phone", "Bulk order delivery delayed"]] },
  }),
  ex({
    id: "out-of-stock-listed",
    title: "Out of stock but still listed",
    dataset: "products",
    question: "Active products that are out of stock",
    query: find("products", { stock: 0, active: true }, { projection: { _id: 0, sku: 1, name: 1 }, limit: 20 }),
    explanation: [
      "stock: 0 is an exact match; use { $lte: 0 } if negative stock is possible in your data.",
      "active: true leaves out products that are already unlisted.",
    ],
    resultPreview: { columns: ["sku", "name"], rows: [["MS-110", "Wireless mouse"]] },
  }),
  ex({
    id: "wireless-top-rated",
    title: "Top-rated wireless products",
    dataset: "products",
    question: "Wireless products rated 4.5 or higher, cheapest first",
    query: find(
      "products",
      { tags: "wireless", rating: { $gte: 4.5 } },
      { projection: { _id: 0, name: 1, price: 1, rating: 1 }, sort: { price: 1 }, limit: 20 }
    ),
    explanation: [
      'Matching an array field against a single value ({ tags: "wireless" }) checks whether the array contains it.',
      "$gte includes products rated exactly 4.5.",
    ],
    resultPreview: {
      columns: ["name", "price", "rating"],
      rows: [["Mechanical keyboard", 6499, 4.6], ["Noise-cancelling headphones", 12999, 4.7]],
    },
  }),
  ex({
    id: "name-contains-case-insensitive",
    title: "Name contains a word, any case",
    dataset: "products",
    question: "Products whose name contains \"cable\", ignoring case",
    query: find(
      "products",
      { name: { $regex: "cable", $options: "i" } },
      { projection: { _id: 0, sku: 1, name: 1, active: 1 }, limit: 20 }
    ),
    explanation: [
      "$regex with the i option matches Cable, CABLE or cable anywhere in the name.",
      "An unanchored, case-insensitive regex scans every document; anchor it (^USB) when you can.",
    ],
    resultPreview: { columns: ["sku", "name", "active"], rows: [["CB-050", "USB-C cable, 2 m", false]] },
  }),
  ex({
    id: "recent-mobile-page-views",
    title: "Mobile page views, last 7 days",
    dataset: "events",
    question: "Page views from mobile devices in the last 7 days",
    query: find(
      "events",
      {
        event: "page_view",
        device: "mobile",
        $expr: { $gte: ["$ts", { $dateSubtract: { startDate: "$$NOW", unit: "day", amount: 7 } }] },
      },
      { sort: { ts: -1 }, limit: 20 }
    ),
    explanation: [
      "$$NOW is the server time when the query runs, so the window moves with the clock.",
      "$dateSubtract inside $expr computes \"7 days ago\" without hard-coding a date.",
      "Results depend on when you run it, so there is no fixed preview.",
    ],
  }),
];

/* ------------------------------------------------------------------ */
/* Aggregation pipeline generator                                      */
/* ------------------------------------------------------------------ */

const aggregationExamples: ToolExampleFull[] = [
  ex({
    id: "revenue-by-status",
    title: "Revenue and order count by status",
    dataset: "orders",
    question: "Total revenue and number of orders for each status, highest revenue first",
    query: agg("orders", [
      { $group: { _id: "$status", orders: { $sum: 1 }, revenue: { $sum: "$total" } } },
      { $sort: { revenue: -1 } },
    ]),
    explanation: [
      "$group with _id: \"$status\" makes one output document per status.",
      "{ $sum: 1 } counts documents; { $sum: \"$total\" } adds up the order totals.",
      "$sort runs after grouping, on the computed revenue field.",
    ],
    resultPreview: {
      columns: ["_id", "orders", "revenue"],
      rows: [["shipped", 1, 37998], ["pending", 1, 32496], ["delivered", 2, 22096], ["cancelled", 1, 1299]],
    },
  }),
  ex({
    id: "monthly-revenue",
    title: "Monthly revenue for a year",
    dataset: "orders",
    question: "Revenue per month in 2026, excluding cancelled orders",
    query: agg("orders", [
      {
        $match: {
          status: { $ne: "cancelled" },
          createdAt: { $gte: date("2026-01-01T00:00:00Z"), $lt: date("2027-01-01T00:00:00Z") },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    explanation: [
      "$match first, so only 2026 orders that were not cancelled reach the group (and an index can help).",
      "$dateToString with %Y-%m turns each timestamp into a month key like 2026-09.",
      "Sorting on _id puts the months in calendar order.",
    ],
    resultPreview: {
      columns: ["_id", "revenue", "orders"],
      rows: [["2026-08", 12999, 1], ["2026-09", 47095, 2], ["2026-10", 32496, 1]],
    },
  }),
  ex({
    id: "top-products-by-units",
    title: "Top 3 products by units sold",
    dataset: "orders",
    question: "Top 3 products by units sold, with revenue, ignoring cancelled orders",
    query: agg("orders", [
      { $match: { status: { $ne: "cancelled" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.sku",
          name: { $first: "$items.name" },
          units: { $sum: "$items.qty" },
          revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } },
        },
      },
      { $sort: { units: -1, _id: 1 } },
      { $limit: 3 },
    ]),
    explanation: [
      "$unwind turns each order into one document per line item.",
      "$group by SKU adds up quantities and quantity times price.",
      "The second sort key (_id) breaks ties so the top 3 are stable.",
    ],
    resultPreview: {
      columns: ["_id", "units", "revenue"],
      rows: [["KB-201", 4, 25996], ["HP-330", 2, 25998], ["MN-270", 2, 37998]],
    },
  }),
  ex({
    id: "aov-by-payment-method",
    title: "Average order value by payment method",
    dataset: "orders",
    question: "Average order value for each payment method, rounded, excluding cancelled orders",
    query: agg("orders", [
      { $match: { status: { $ne: "cancelled" } } },
      { $group: { _id: "$paymentMethod", orders: { $sum: 1 }, avgOrderValue: { $avg: "$total" } } },
      { $project: { orders: 1, avgOrderValue: { $round: ["$avgOrderValue", 0] } } },
      { $sort: { avgOrderValue: -1 } },
    ]),
    explanation: [
      "$avg inside $group computes the mean total per payment method.",
      "$round runs in a later $project because accumulators cannot be wrapped directly.",
    ],
    resultPreview: { columns: ["_id", "orders", "avgOrderValue"], rows: [["card", 3, 27831], ["upi", 1, 9097]] },
  }),
  ex({
    id: "customer-lifetime-spend",
    title: "Spend per customer (join)",
    dataset: "customers",
    question: "Each customer's number of orders and total spend, excluding cancelled orders",
    query: agg("customers", [
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "customerId",
          pipeline: [{ $match: { status: { $ne: "cancelled" } } }],
          as: "orders",
        },
      },
      { $project: { _id: 0, name: 1, orders: { $size: "$orders" }, spend: { $sum: "$orders.total" } } },
      { $sort: { spend: -1, name: 1 } },
    ]),
    explanation: [
      "$lookup joins each customer to their orders; the inner pipeline drops cancelled ones.",
      "$size counts the joined orders and $sum over \"$orders.total\" adds their totals.",
      "Customers with no orders stay in the result with 0, like a LEFT JOIN.",
    ],
    resultPreview: {
      columns: ["name", "orders", "spend"],
      rows: [["Priya Nair", 2, 70494], ["Sofia Rossi", 1, 12999], ["Aarav Mehta", 1, 9097], ["Daniel Okafor", 0, 0], ["Kenji Watanabe", 0, 0]],
    },
  }),
  ex({
    id: "tickets-per-tag",
    title: "Most common ticket tags",
    dataset: "tickets",
    question: "The 5 most common ticket tags",
    query: agg("tickets", [
      { $unwind: "$tags" },
      { $group: { _id: "$tags", tickets: { $sum: 1 } } },
      { $sort: { tickets: -1, _id: 1 } },
      { $limit: 5 },
    ]),
    explanation: [
      "$unwind on tags emits one document per tag, so a ticket with two tags counts for both.",
      "Grouping by the tag and counting gives the frequency of each one.",
    ],
    resultPreview: {
      columns: ["_id", "tickets"],
      rows: [["orders", 2], ["account", 1], ["billing", 1], ["hardware", 1], ["refund", 1]],
    },
  }),
  ex({
    id: "first-response-by-channel",
    title: "First response time by channel",
    dataset: "tickets",
    question: "Average first response time in hours for each support channel",
    query: agg("tickets", [
      { $match: { firstResponseAt: { $ne: null } } },
      {
        $group: {
          _id: "$channel",
          tickets: { $sum: 1 },
          avgMinutes: { $avg: { $dateDiff: { startDate: "$createdAt", endDate: "$firstResponseAt", unit: "minute" } } },
        },
      },
      { $project: { tickets: 1, avgHours: { $round: [{ $divide: ["$avgMinutes", 60] }, 1] } } },
      { $sort: { avgHours: -1 } },
    ]),
    explanation: [
      "Tickets without a first response are filtered out so they don't skew the average.",
      "$dateDiff measures the gap in minutes; dividing by 60 and rounding gives hours.",
    ],
    resultPreview: { columns: ["_id", "tickets", "avgHours"], rows: [["email", 2, 9.3], ["chat", 2, 0.3]] },
  }),
  ex({
    id: "daily-active-users",
    title: "Daily active users in a month",
    dataset: "events",
    question: "Daily active users and event counts for October 2026",
    query: agg("events", [
      { $match: { ts: { $gte: date("2026-10-01T00:00:00Z"), $lt: date("2026-11-01T00:00:00Z") } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$ts" } },
          users: { $addToSet: "$userId" },
          events: { $sum: 1 },
        },
      },
      { $project: { _id: 0, day: "$_id", activeUsers: { $size: "$users" }, events: 1 } },
      { $sort: { day: 1 } },
    ]),
    explanation: [
      "$addToSet collects each user once per day, so repeat events don't inflate the count.",
      "$size of that set is the number of distinct active users.",
    ],
    resultPreview: { columns: ["day", "activeUsers", "events"], rows: [["2026-10-01", 1, 3], ["2026-10-13", 1, 1]] },
  }),
  ex({
    id: "conversion-funnel",
    title: "Conversion funnel by unique users",
    dataset: "events",
    question: "How many unique users viewed a page, added to cart and purchased?",
    query: agg("events", [
      { $match: { event: { $in: ["page_view", "add_to_cart", "purchase"] } } },
      { $group: { _id: "$event", users: { $addToSet: "$userId" } } },
      { $project: { _id: 0, step: "$_id", users: { $size: "$users" } } },
      { $sort: { users: -1, step: 1 } },
    ]),
    explanation: [
      "Only the three funnel events are kept.",
      "Counting distinct userIds per event gives users per step, not raw event volume.",
    ],
    resultPreview: { columns: ["step", "users"], rows: [["page_view", 2], ["add_to_cart", 1], ["purchase", 1]] },
  }),
  ex({
    id: "inventory-value-by-category",
    title: "Inventory value per category",
    dataset: "products",
    question: "Stock value (price times stock) for each category of active products",
    query: agg("products", [
      { $match: { active: true } },
      { $group: { _id: "$category", skus: { $sum: 1 }, stockValue: { $sum: { $multiply: ["$price", "$stock"] } } } },
      { $sort: { stockValue: -1 } },
    ]),
    explanation: [
      "$multiply computes price times stock for every product before $sum adds them up.",
      "Inactive products are excluded first.",
    ],
    resultPreview: {
      columns: ["_id", "skus", "stockValue"],
      rows: [["accessories", 2, 272958], ["audio", 1, 194985], ["displays", 1, 132993]],
    },
  }),
  ex({
    id: "variant-stock-by-colour",
    title: "Stock by variant colour",
    dataset: "products",
    question: "Total stock for each colour across all product variants",
    query: agg("products", [
      { $unwind: "$variants" },
      { $group: { _id: "$variants.color", stock: { $sum: "$variants.stock" } } },
      { $sort: { stock: -1 } },
    ]),
    explanation: [
      "$unwind on variants gives one document per colour variant; products with no variants drop out.",
      "Grouping by the colour sums stock across every product.",
    ],
    resultPreview: { columns: ["_id", "stock"], rows: [["black", 39], ["white", 12], ["silver", 6]] },
  }),
  ex({
    id: "price-buckets",
    title: "Products per price band",
    dataset: "products",
    question: "How many products fall into each price band: under 1,000, 1,000 to 5,000, 5,000 to 15,000 and above",
    query: agg("products", [
      {
        $bucket: {
          groupBy: "$price",
          boundaries: [0, 1000, 5000, 15000, 50000],
          default: "other",
          output: { products: { $sum: 1 }, skus: { $push: "$sku" } },
        },
      },
    ]),
    explanation: [
      "$bucket assigns each product to a band; each _id is the band's lower bound.",
      "Prices outside every band would land in the \"other\" bucket instead of failing.",
    ],
    resultPreview: {
      columns: ["_id", "products", "skus"],
      rows: [[0, 1, "CB-050"], [1000, 1, "MS-110"], [5000, 2, "KB-201, HP-330"], [15000, 1, "MN-270"]],
    },
  }),
  ex({
    id: "new-signups-without-orders",
    title: "New signups who haven't ordered",
    dataset: "customers",
    question: "Customers who signed up in the last 30 days and have never placed an order",
    query: agg("customers", [
      { $match: { $expr: { $gte: ["$signupDate", { $dateSubtract: { startDate: "$$NOW", unit: "day", amount: 30 } }] } } },
      { $lookup: { from: "orders", localField: "_id", foreignField: "customerId", as: "orders" } },
      { $match: { orders: { $size: 0 } } },
      { $project: { _id: 0, name: 1, email: 1, signupDate: 1 } },
    ]),
    explanation: [
      "The first $match uses $$NOW, so \"last 30 days\" is relative to when the query runs.",
      "$lookup attaches orders and { $size: 0 } keeps customers with none: an anti-join.",
      "Results depend on the current date, so there is no fixed preview.",
    ],
  }),
];

/* ------------------------------------------------------------------ */
/* Aggregation explainer                                               */
/* ------------------------------------------------------------------ */

const explainExamples: ToolExampleFull[] = [
  ex({
    id: "explain-match-group-sort",
    title: "$match, $group, $sort",
    dataset: "orders",
    question: "Revenue per status, without cancelled orders",
    query: agg("orders", [
      { $match: { status: { $ne: "cancelled" } } },
      { $group: { _id: "$status", revenue: { $sum: "$total" } } },
      { $sort: { revenue: -1 } },
    ]),
    explanation: [
      "$match drops cancelled orders before any work is done.",
      "$group collapses the remaining orders into one row per status with summed totals.",
      "$sort orders those rows from highest to lowest revenue.",
    ],
    resultPreview: { columns: ["_id", "revenue"], rows: [["shipped", 37998], ["pending", 32496], ["delivered", 22096]] },
  }),
  ex({
    id: "explain-unwind-group",
    title: "$unwind then $group",
    dataset: "orders",
    question: "Units sold per SKU",
    query: agg("orders", [
      { $match: { status: { $ne: "cancelled" } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.sku", units: { $sum: "$items.qty" } } },
      { $sort: { units: -1, _id: 1 } },
    ]),
    explanation: [
      "$match keeps orders that were not cancelled.",
      "$unwind splits each order into one document per line item in the items array.",
      "$group adds up qty for each SKU across all orders.",
      "$sort ranks SKUs by units, alphabetically on ties.",
    ],
    resultPreview: { columns: ["_id", "units"], rows: [["KB-201", 4], ["HP-330", 2], ["MN-270", 2], ["MS-110", 2]] },
  }),
  ex({
    id: "explain-lookup-unwind",
    title: "$lookup, $unwind, $project",
    dataset: "orders",
    question: "Delivered orders with the customer's name",
    query: agg("orders", [
      { $match: { status: "delivered" } },
      { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "customer" } },
      { $unwind: "$customer" },
      { $project: { _id: 0, orderNumber: 1, total: 1, customer: "$customer.name" } },
      { $sort: { orderNumber: 1 } },
    ]),
    explanation: [
      "$match keeps delivered orders only.",
      "$lookup finds the customer whose _id equals the order's customerId and stores it as an array.",
      "$unwind turns that one-element array into a plain embedded object.",
      "$project keeps the order number, total and the customer's name.",
      "$sort orders the rows by order number.",
    ],
    resultPreview: { columns: ["orderNumber", "total", "customer"], rows: [["A-1001", 9097, "Aarav Mehta"], ["A-1003", 12999, "Sofia Rossi"]] },
  }),
  ex({
    id: "explain-facet",
    title: "$facet with two sub-pipelines",
    dataset: "orders",
    question: "Order counts per status and overall totals in one query",
    query: agg("orders", [
      {
        $facet: {
          byStatus: [{ $sortByCount: "$status" }, { $sort: { count: -1, _id: 1 } }],
          totals: [{ $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: "$total" } } }],
        },
      },
    ]),
    explanation: [
      "$facet runs two independent pipelines over the same input and returns a single document.",
      "byStatus uses $sortByCount (a group by status plus a count, sorted descending), then a $sort to break ties.",
      "totals groups everything (_id: null) into one row with the order count and revenue.",
    ],
  }),
  ex({
    id: "explain-running-total",
    title: "$setWindowFields running total",
    dataset: "orders",
    question: "Running revenue total in order date",
    query: agg("orders", [
      { $match: { status: { $ne: "cancelled" } } },
      {
        $setWindowFields: {
          sortBy: { createdAt: 1 },
          output: { runningRevenue: { $sum: "$total", window: { documents: ["unbounded", "current"] } } },
        },
      },
      { $project: { _id: 0, orderNumber: 1, total: 1, runningRevenue: 1 } },
    ]),
    explanation: [
      "$match removes cancelled orders.",
      "$setWindowFields sorts by createdAt and sums total from the first document up to the current one.",
      "$project keeps the order number, its total and the running total.",
    ],
    resultPreview: {
      columns: ["orderNumber", "total", "runningRevenue"],
      rows: [["A-1003", 12999, 12999], ["A-1001", 9097, 22096], ["A-1002", 37998, 60094], ["A-1005", 32496, 92590]],
    },
  }),
  ex({
    id: "explain-date-diff",
    title: "$addFields with $dateDiff",
    dataset: "orders",
    question: "Days from order to delivery",
    query: agg("orders", [
      { $match: { deliveredAt: { $exists: true } } },
      { $addFields: { daysToDeliver: { $dateDiff: { startDate: "$createdAt", endDate: "$deliveredAt", unit: "day" } } } },
      { $project: { _id: 0, orderNumber: 1, daysToDeliver: 1 } },
      { $sort: { daysToDeliver: -1 } },
    ]),
    explanation: [
      "$match keeps orders that have a deliveredAt date.",
      "$addFields adds daysToDeliver: the number of day boundaries between the two dates.",
      "$project trims the output and $sort shows the slowest deliveries first.",
    ],
    resultPreview: { columns: ["orderNumber", "daysToDeliver"], rows: [["A-1003", 6], ["A-1001", 3]] },
  }),
  ex({
    id: "explain-sort-by-count",
    title: "$sortByCount on an array",
    dataset: "tickets",
    question: "Which tags appear on the most tickets?",
    query: agg("tickets", [{ $unwind: "$tags" }, { $sortByCount: "$tags" }, { $sort: { count: -1, _id: 1 } }]),
    explanation: [
      "$unwind emits one document per tag.",
      "$sortByCount groups by tag, counts each and sorts by that count.",
      "The extra $sort breaks ties alphabetically so the order is stable.",
    ],
    resultPreview: { columns: ["_id", "count"], rows: [["orders", 2], ["account", 1], ["billing", 1]] },
  }),
  ex({
    id: "explain-replace-with",
    title: "$lookup then $replaceWith",
    dataset: "tickets",
    question: "Open tickets reshaped with the customer's name and plan",
    query: agg("tickets", [
      { $match: { status: "open" } },
      { $sort: { ticketNumber: 1 } },
      { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "customer" } },
      {
        $replaceWith: {
          ticket: "$ticketNumber",
          priority: "$priority",
          customer: { $first: "$customer.name" },
          plan: { $first: "$customer.plan" },
        },
      },
    ]),
    explanation: [
      "$match and $sort pick open tickets in ticket-number order.",
      "$lookup attaches the matching customer document as an array.",
      "$replaceWith replaces each document with a new flat shape; $first takes the single joined value.",
    ],
    resultPreview: {
      columns: ["ticket", "priority", "customer", "plan"],
      rows: [["T-5001", "high", "Priya Nair", "business"], ["T-5005", "urgent", "Priya Nair", "business"]],
    },
  }),
  ex({
    id: "explain-union-with",
    title: "$unionWith activity timeline",
    dataset: "orders",
    question: "One customer's orders and tickets in a single timeline",
    query: agg("orders", [
      { $project: { _id: 0, customerId: 1, type: { $literal: "order" }, ref: "$orderNumber", at: "$createdAt" } },
      {
        $unionWith: {
          coll: "tickets",
          pipeline: [{ $project: { _id: 0, customerId: 1, type: { $literal: "ticket" }, ref: "$ticketNumber", at: "$createdAt" } }],
        },
      },
      { $match: { customerId: oid(IDS.c2) } },
      { $sort: { at: -1 } },
    ]),
    explanation: [
      "$project reshapes orders into timeline rows with a type, a reference and a timestamp.",
      "$unionWith appends tickets reshaped the same way, like SQL UNION ALL.",
      "$match keeps one customer and $sort lists the newest activity first.",
    ],
    resultPreview: {
      columns: ["type", "ref"],
      rows: [["ticket", "T-5005"], ["ticket", "T-5001"], ["order", "A-1005"], ["order", "A-1002"]],
    },
  }),
  ex({
    id: "explain-count",
    title: "$match then $count",
    dataset: "products",
    question: "How many listed products are low on stock?",
    query: agg("products", [{ $match: { active: true, stock: { $lt: 10 } } }, { $count: "lowStock" }]),
    explanation: [
      "$match keeps active products with fewer than 10 units.",
      "$count returns a single document with the number of matches in a field named lowStock.",
    ],
    resultPreview: { columns: ["lowStock"], rows: [[2]] },
  }),
  ex({
    id: "explain-top-n",
    title: "$group with $topN",
    dataset: "products",
    question: "The two most expensive products in each category",
    query: agg("products", [
      { $group: { _id: "$category", top: { $topN: { n: 2, sortBy: { price: -1 }, output: "$name" } } } },
      { $sort: { _id: 1 } },
    ]),
    explanation: [
      "$group makes one row per category.",
      "$topN keeps the names of the 2 highest-priced products in each group, in price order.",
      "$sort lists categories alphabetically.",
    ],
    resultPreview: {
      columns: ["_id", "top"],
      rows: [["accessories", "Mechanical keyboard, Wireless mouse"], ["audio", "Noise-cancelling headphones"], ["displays", "27-inch 4K monitor"]],
    },
  }),
];

/* ------------------------------------------------------------------ */
/* SQL to MongoDB                                                      */
/* ------------------------------------------------------------------ */

const sqlExamples: ToolExampleFull[] = [
  ex({
    id: "sql-where-order-limit",
    title: "WHERE, ORDER BY, LIMIT",
    dataset: "orders",
    sql: "SELECT * FROM orders WHERE status = 'delivered' ORDER BY createdAt DESC LIMIT 10;",
    question: "SELECT * FROM orders WHERE status = 'delivered' ORDER BY createdAt DESC LIMIT 10;",
    query: find("orders", { status: "delivered" }, { sort: { createdAt: -1 }, limit: 10 }),
    explanation: ["WHERE becomes the filter object.", "ORDER BY ... DESC becomes sort({ createdAt: -1 }).", "LIMIT becomes limit(10)."],
    resultPreview: { columns: ["orderNumber", "total"], rows: [["A-1001", 9097], ["A-1003", 12999]] },
  }),
  ex({
    id: "sql-select-columns-in",
    title: "Selected columns with IN",
    dataset: "customers",
    sql: "SELECT name, email FROM customers WHERE plan IN ('pro', 'business') ORDER BY name;",
    question: "SELECT name, email FROM customers WHERE plan IN ('pro', 'business') ORDER BY name;",
    query: find(
      "customers",
      { plan: { $in: ["pro", "business"] } },
      { projection: { _id: 0, name: 1, email: 1 }, sort: { name: 1 } }
    ),
    explanation: [
      "The column list becomes a projection; _id is returned by default, so it is excluded explicitly.",
      "IN (...) maps to $in.",
    ],
    resultPreview: {
      columns: ["name", "email"],
      rows: [["Aarav Mehta", "aarav@example.com"], ["Priya Nair", "priya@example.com"], ["Sofia Rossi", "sofia@example.com"]],
    },
  }),
  ex({
    id: "sql-count",
    title: "COUNT(*) with WHERE",
    dataset: "tickets",
    sql: "SELECT COUNT(*) AS open_tickets FROM tickets WHERE status = 'open';",
    question: "SELECT COUNT(*) AS open_tickets FROM tickets WHERE status = 'open';",
    query: agg("tickets", [{ $match: { status: "open" } }, { $count: "open_tickets" }]),
    explanation: [
      "WHERE becomes $match.",
      "COUNT(*) AS open_tickets becomes $count with the alias as the field name.",
      'In mongosh, db.tickets.countDocuments({ status: "open" }) returns the same number.',
    ],
    resultPreview: { columns: ["open_tickets"], rows: [[2]] },
  }),
  ex({
    id: "sql-group-by-sum",
    title: "GROUP BY with SUM",
    dataset: "orders",
    sql: "SELECT status, SUM(total) AS revenue FROM orders GROUP BY status ORDER BY revenue DESC;",
    question: "SELECT status, SUM(total) AS revenue FROM orders GROUP BY status ORDER BY revenue DESC;",
    query: agg("orders", [
      { $group: { _id: "$status", revenue: { $sum: "$total" } } },
      { $project: { _id: 0, status: "$_id", revenue: 1 } },
      { $sort: { revenue: -1 } },
    ]),
    explanation: [
      "GROUP BY status becomes $group with _id: \"$status\".",
      "SUM(total) becomes { $sum: \"$total\" }.",
      "$project renames _id back to status so the output matches the SQL column names.",
    ],
    resultPreview: {
      columns: ["status", "revenue"],
      rows: [["shipped", 37998], ["pending", 32496], ["delivered", 22096], ["cancelled", 1299]],
    },
  }),
  ex({
    id: "sql-having",
    title: "GROUP BY with HAVING",
    dataset: "orders",
    sql: "SELECT paymentMethod, AVG(total) AS avg_total FROM orders GROUP BY paymentMethod HAVING COUNT(*) > 1;",
    question: "SELECT paymentMethod, AVG(total) AS avg_total FROM orders GROUP BY paymentMethod HAVING COUNT(*) > 1;",
    query: agg("orders", [
      { $group: { _id: "$paymentMethod", avg_total: { $avg: "$total" }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $project: { _id: 0, paymentMethod: "$_id", avg_total: 1 } },
    ]),
    explanation: [
      "HAVING is a $match placed after the $group, filtering on the computed count.",
      "The helper count n is dropped in the final $project.",
    ],
    resultPreview: { columns: ["paymentMethod", "avg_total"], rows: [["card", 27831]] },
  }),
  ex({
    id: "sql-like-prefix",
    title: "LIKE with a prefix",
    dataset: "products",
    sql: "SELECT sku, name FROM products WHERE name LIKE 'USB%';",
    question: "SELECT sku, name FROM products WHERE name LIKE 'USB%';",
    query: find("products", { name: { $regex: "^USB" } }, { projection: { _id: 0, sku: 1, name: 1 } }),
    explanation: [
      "LIKE 'USB%' becomes the anchored regex ^USB, which can use an index on name.",
      "MongoDB regexes are case-sensitive by default, unlike LIKE under many SQL databases' default collations.",
    ],
    resultPreview: { columns: ["sku", "name"], rows: [["CB-050", "USB-C cable, 2 m"]] },
  }),
  ex({
    id: "sql-distinct",
    title: "SELECT DISTINCT",
    dataset: "products",
    sql: "SELECT DISTINCT category FROM products ORDER BY category;",
    question: "SELECT DISTINCT category FROM products ORDER BY category;",
    query: agg("products", [{ $group: { _id: "$category" } }, { $sort: { _id: 1 } }]),
    explanation: [
      "A $group with only an _id returns each distinct value once.",
      'db.products.distinct("category") gives the same values as a plain array.',
    ],
    resultPreview: { columns: ["_id"], rows: [["accessories"], ["audio"], ["displays"]] },
  }),
  ex({
    id: "sql-inner-join",
    title: "INNER JOIN",
    dataset: "orders",
    sql: "SELECT o.orderNumber, o.total, c.name FROM orders o JOIN customers c ON o.customerId = c._id WHERE o.total > 10000 ORDER BY o.total DESC;",
    question:
      "SELECT o.orderNumber, o.total, c.name FROM orders o JOIN customers c ON o.customerId = c._id WHERE o.total > 10000 ORDER BY o.total DESC;",
    query: agg("orders", [
      { $match: { total: { $gt: 10000 } } },
      { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "c" } },
      { $unwind: "$c" },
      { $project: { _id: 0, orderNumber: 1, total: 1, name: "$c.name" } },
      { $sort: { total: -1 } },
    ]),
    explanation: [
      "The WHERE on the orders side moves into an early $match.",
      "JOIN ... ON becomes $lookup with localField and foreignField.",
      "$unwind drops orders with no matching customer, which is what an INNER JOIN does.",
    ],
    resultPreview: {
      columns: ["orderNumber", "total", "name"],
      rows: [["A-1002", 37998, "Priya Nair"], ["A-1005", 32496, "Priya Nair"], ["A-1003", 12999, "Sofia Rossi"]],
    },
  }),
  ex({
    id: "sql-left-join-count",
    title: "LEFT JOIN with COUNT",
    dataset: "customers",
    sql: "SELECT c.name, COUNT(t._id) AS tickets FROM customers c LEFT JOIN tickets t ON t.customerId = c._id GROUP BY c.name ORDER BY tickets DESC, c.name;",
    question:
      "SELECT c.name, COUNT(t._id) AS tickets FROM customers c LEFT JOIN tickets t ON t.customerId = c._id GROUP BY c.name ORDER BY tickets DESC, c.name;",
    query: agg("customers", [
      { $lookup: { from: "tickets", localField: "_id", foreignField: "customerId", as: "t" } },
      { $project: { _id: 0, name: 1, tickets: { $size: "$t" } } },
      { $sort: { tickets: -1, name: 1 } },
    ]),
    explanation: [
      "$lookup keeps every customer, even with no tickets: a LEFT JOIN by default.",
      "Because the join result is an array, COUNT becomes $size and no $group is needed.",
    ],
    resultPreview: {
      columns: ["name", "tickets"],
      rows: [["Priya Nair", 2], ["Aarav Mehta", 1], ["Daniel Okafor", 1], ["Sofia Rossi", 1], ["Kenji Watanabe", 0]],
    },
  }),
  ex({
    id: "sql-is-null",
    title: "IS NULL",
    dataset: "tickets",
    sql: "SELECT ticketNumber, subject FROM tickets WHERE assignee IS NULL ORDER BY ticketNumber;",
    question: "SELECT ticketNumber, subject FROM tickets WHERE assignee IS NULL ORDER BY ticketNumber;",
    query: find("tickets", { assignee: null }, { projection: { _id: 0, ticketNumber: 1, subject: 1 }, sort: { ticketNumber: 1 } }),
    explanation: [
      "IS NULL becomes { assignee: null }.",
      "Unlike SQL, this also matches documents where assignee is missing; use { $type: \"null\" } for explicit nulls only.",
    ],
    resultPreview: {
      columns: ["ticketNumber", "subject"],
      rows: [["T-5004", "Cannot verify my email address"], ["T-5005", "Bulk order delivery delayed"]],
    },
  }),
  ex({
    id: "sql-between",
    title: "BETWEEN",
    dataset: "products",
    sql: "SELECT name, price FROM products WHERE price BETWEEN 1000 AND 15000 ORDER BY price;",
    question: "SELECT name, price FROM products WHERE price BETWEEN 1000 AND 15000 ORDER BY price;",
    query: find(
      "products",
      { price: { $gte: 1000, $lte: 15000 } },
      { projection: { _id: 0, name: 1, price: 1 }, sort: { price: 1 } }
    ),
    explanation: ["BETWEEN is inclusive on both ends, so it maps to $gte and $lte together."],
    resultPreview: {
      columns: ["name", "price"],
      rows: [["Wireless mouse", 1299], ["Mechanical keyboard", 6499], ["Noise-cancelling headphones", 12999]],
    },
  }),
  ex({
    id: "sql-group-count",
    title: "GROUP BY with COUNT(*)",
    dataset: "customers",
    sql: "SELECT country, COUNT(*) AS customers FROM customers GROUP BY country ORDER BY customers DESC, country;",
    question: "SELECT country, COUNT(*) AS customers FROM customers GROUP BY country ORDER BY customers DESC, country;",
    query: agg("customers", [
      { $group: { _id: "$country", customers: { $sum: 1 } } },
      { $sort: { customers: -1, _id: 1 } },
    ]),
    explanation: ["COUNT(*) is { $sum: 1 } inside $group.", "The two ORDER BY keys become a two-key $sort."],
    resultPreview: { columns: ["_id", "customers"], rows: [["IN", 2], ["IT", 1], ["JP", 1], ["NG", 1]] },
  }),
  ex({
    id: "sql-offset",
    title: "LIMIT with OFFSET",
    dataset: "orders",
    sql: "SELECT orderNumber, total FROM orders ORDER BY total DESC LIMIT 3 OFFSET 1;",
    question: "SELECT orderNumber, total FROM orders ORDER BY total DESC LIMIT 3 OFFSET 1;",
    query: find("orders", {}, { projection: { _id: 0, orderNumber: 1, total: 1 }, sort: { total: -1 }, skip: 1, limit: 3 }),
    explanation: [
      "OFFSET becomes skip(1) and LIMIT becomes limit(3).",
      "For deep pages, prefer a range filter on the sort key over a large skip.",
    ],
    resultPreview: { columns: ["orderNumber", "total"], rows: [["A-1005", 32496], ["A-1003", 12999], ["A-1001", 9097]] },
  }),
];

/* ------------------------------------------------------------------ */
/* Schema from JSON (client side)                                      */
/* ------------------------------------------------------------------ */

const schemaExamples: ToolExampleFull[] = [
  ex({
    id: "schema-field-presence",
    title: "Field presence across a collection",
    dataset: "customers",
    question: "Which top-level fields exist, and in how many documents?",
    query: agg("customers", [
      { $project: { fields: { $objectToArray: "$$ROOT" } } },
      { $unwind: "$fields" },
      { $group: { _id: "$fields.k", docs: { $sum: 1 }, types: { $addToSet: { $type: "$fields.v" } } } },
      { $sort: { _id: 1 } },
    ]),
    explanation: [
      "$objectToArray turns each document into key/value pairs.",
      "Grouping by the key counts how many documents have each field and collects its BSON types.",
      "Run it on your real collection to see the same table this tool builds from a pasted sample.",
    ],
    resultPreview: {
      columns: ["_id", "docs"],
      rows: [["_id", 5], ["city", 4], ["country", 5], ["email", 5], ["lastSeenAt", 5], ["lifetimeValue", 5], ["marketingOptIn", 5], ["name", 5], ["phone", 2], ["plan", 5], ["signupDate", 5], ["tags", 5]],
    },
  }),
  ex({
    id: "schema-types-of-a-field",
    title: "BSON types used by one field",
    dataset: "tickets",
    question: "What types does resolvedAt hold?",
    query: agg("tickets", [{ $group: { _id: { $type: "$resolvedAt" }, tickets: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    explanation: [
      "$type returns the BSON type name of a value (\"date\", \"null\", \"missing\", ...).",
      "Grouping by it shows mixed types at a glance, here dates and nulls.",
    ],
    resultPreview: { columns: ["_id", "tickets"], rows: [["date", 2], ["null", 3]] },
  }),
  ex({
    id: "schema-missing-field",
    title: "Documents missing a field",
    dataset: "orders",
    question: "Orders that have no deliveredAt field",
    query: find(
      "orders",
      { deliveredAt: { $exists: false } },
      { projection: { _id: 0, orderNumber: 1, status: 1 }, sort: { orderNumber: 1 } }
    ),
    explanation: [
      "$exists: false finds documents where the field is absent.",
      "This is why the generated schema marks deliveredAt as optional (40% presence here).",
    ],
    resultPreview: { columns: ["orderNumber", "status"], rows: [["A-1002", "shipped"], ["A-1004", "cancelled"], ["A-1005", "pending"]] },
  }),
  ex({
    id: "schema-null-vs-missing",
    title: "Explicit null vs missing",
    dataset: "orders",
    question: "Orders where couponCode is explicitly null (not missing)",
    query: find("orders", { couponCode: { $type: "null" } }, { projection: { _id: 0, orderNumber: 1 } }),
    explanation: [
      "{ $type: \"null\" } matches only stored nulls; { couponCode: null } would also match missing fields.",
      "Telling the two apart matters when you write a validator with required fields.",
    ],
    resultPreview: { columns: ["orderNumber"], rows: [["A-1002"]] },
  }),
  ex({
    id: "schema-empty-array",
    title: "Empty arrays",
    dataset: "customers",
    question: "Customers whose tags array is empty",
    query: find("customers", { tags: { $size: 0 } }, { projection: { _id: 0, name: 1 } }),
    explanation: ["$size: 0 matches an existing but empty array.", "A missing tags field would not match."],
    resultPreview: { columns: ["name"], rows: [["Daniel Okafor"]] },
  }),
  ex({
    id: "schema-empty-nested-array",
    title: "Arrays with no first element",
    dataset: "products",
    question: "Products with no variants",
    query: find("products", { "variants.0": { $exists: false } }, { projection: { _id: 0, sku: 1 }, sort: { sku: 1 } }),
    explanation: [
      '"variants.0" refers to the first array element; if it does not exist the array is empty or missing.',
    ],
    resultPreview: { columns: ["sku"], rows: [["CB-050"], ["MN-270"]] },
  }),
  ex({
    id: "schema-json-schema-violations",
    title: "Documents that fail a $jsonSchema rule",
    dataset: "tickets",
    question: "Tickets that would fail a validator requiring a string assignee",
    query: find(
      "tickets",
      { $nor: [{ $jsonSchema: { required: ["assignee"], properties: { assignee: { bsonType: "string" } } } }] },
      { projection: { _id: 0, ticketNumber: 1 }, sort: { ticketNumber: 1 } }
    ),
    explanation: [
      "$jsonSchema in a find filter matches documents that pass the schema; $nor flips it.",
      "Run this before adding a validator to see which existing documents would be rejected on update.",
    ],
    resultPreview: { columns: ["ticketNumber"], rows: [["T-5004"], ["T-5005"]] },
  }),
  ex({
    id: "schema-shape-drift",
    title: "Documents grouped by field count",
    dataset: "customers",
    question: "How many customers have 10, 11 or 12 fields?",
    query: agg("customers", [
      { $project: { keys: { $size: { $objectToArray: "$$ROOT" } } } },
      { $group: { _id: "$keys", customers: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    explanation: [
      "Counting keys per document is a quick test for shape drift.",
      "Different counts mean optional fields; the presence column in the tool shows which ones.",
    ],
    resultPreview: { columns: ["_id", "customers"], rows: [[10, 1], [11, 2], [12, 2]] },
  }),
  ex({
    id: "schema-wrong-type",
    title: "Values stored with the wrong type",
    dataset: "orders",
    question: "Orders whose total is not a number",
    query: find("orders", { total: { $not: { $type: "number" } } }, { projection: { _id: 0, orderNumber: 1, total: 1 } }),
    explanation: [
      "The \"number\" alias covers int, long, double and decimal.",
      "An empty result means every total is numeric, which is what the sample data shows.",
    ],
    resultPreview: { columns: ["orderNumber", "total"], rows: [] },
  }),
  ex({
    id: "schema-enum-values",
    title: "Distinct values for an enum",
    dataset: "orders",
    question: "Every status value and how often it appears",
    query: agg("orders", [{ $group: { _id: "$status", orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    explanation: [
      "Before writing an enum in a validator or Mongoose schema, list the values that already exist.",
    ],
    resultPreview: { columns: ["_id", "orders"], rows: [["cancelled", 1], ["delivered", 2], ["pending", 1], ["shipped", 1]] },
  }),
  ex({
    id: "schema-random-sample",
    title: "Random sample for inference",
    dataset: "customers",
    question: "Three random customers to paste into the schema tool",
    query: agg("customers", [{ $sample: { size: 3 } }]),
    explanation: [
      "$sample picks random documents, a better input for schema inference than the first few by _id.",
      "The result changes on every run, so there is no fixed preview.",
    ],
  }),
];

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

const UPDATED = "2026-10-14";

export const tools: ToolPageFull[] = [
  {
    kind: "tool",
    tool: "mongodb-query-generator",
    mode: "query",
    usesModel: true,
    name: "Query generator",
    summary: "Describe the documents you want; get a find() or aggregate() for mongosh, Node.js and Python.",
    path: "/tools/mongodb-query-generator",
    title: "MongoDB Query Generator: plain English to find()",
    description:
      "Free MongoDB query generator. Describe what you need in plain English, add a sample document and get a checked query for mongosh, Node.js and Python.",
    h1: "MongoDB query generator",
    navLabel: "MongoDB query generator",
    primaryKeyword: "mongodb query generator",
    secondaryKeywords: ["mongodb query builder", "natural language to mongodb", "text to mongodb query", "mongodb find query examples"],
    status: "published",
    priority: "P0",
    updated: UPDATED,
    og: { template: "tool", eyebrow: "Free tool", title: "MongoDB query generator" },
    related: ["/tools/mongodb-aggregation-generator", "/tools/sql-to-mongodb-converter", "/chat-with-mongodb"],
    lead:
      "Type what you want in plain English, paste one sample document, and get a MongoDB query you can run: a find() with filter, projection, sort and limit, or an aggregate() when grouping is needed. Every answer is checked so it can only read.",
    examples: queryExamples,
    howItWorks: [
      { title: "Describe the result", body: "Say which documents you want and what to return, the way you'd ask a colleague." },
      { title: "Add a sample document", body: "One document is enough to give the model your real field names and types. Your data is never queried." },
      { title: "Get checked code", body: "The query is validated and passed through the same read-only guard wuup uses on live databases." },
      { title: "Copy it anywhere", body: "Switch between mongosh, the Node.js driver and PyMongo. ObjectIds and dates are written correctly in each." },
    ],
    wontDo: [
      "Connect to your database or run anything. It only writes text.",
      "Write, update or delete data. $out, $merge, $where and $function are refused.",
      "Know fields you didn't show it. Missing context is listed under assumptions.",
      "Store your sample for training. Inputs are cached for 7 days by a hash so repeat requests are instant.",
    ],
    guides: [GUIDES.plainEnglish, GUIDES.readOnly, GUIDES.aggregation],
    connector: "/chat-with-mongodb",
    sections: [
      {
        heading: "find() or aggregate()?",
        body: [
          "Most questions about specific documents are a find(): a filter to choose documents, an optional projection to choose fields, a sort and a limit. It is the fastest kind of query and the easiest to read.",
          "As soon as you need totals, averages, counts per group, joins to another collection or computed fields, you need an aggregation pipeline. The generator picks the simpler form when it can and tells you why in the explanation bullets.",
        ],
      },
      {
        heading: "Why a sample document matters",
        body: [
          "MongoDB has no fixed schema, so a model guessing field names will often write a query that looks right and returns nothing. A single real document tells it that the date field is createdAt, that customerId is an ObjectId and that tags is an array.",
          "Paste a document with sensitive values replaced. The tool refuses inputs that look like connection strings, private keys or API keys.",
        ],
      },
      {
        heading: "Common mistakes the generator avoids",
        body: [
          "Comparing an ObjectId field with a string, comparing dates with strings, using $ne where the field might be missing, and unanchored regexes on large collections. When one of these is a risk, it appears under warnings.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the MongoDB query generator free?",
        a: "Yes. It needs no account. To keep it fast for everyone there is a limit of 5 requests a minute and 30 a day per visitor. Signing up for wuup gives you 50 free questions against your own database.",
      },
      {
        q: "Does it connect to my database?",
        a: "No. The tool only writes a query from your description and the sample document you paste. Nothing is executed. To ask questions of a real database, connect it to wuup with a read-only user.",
      },
      {
        q: "Which MongoDB versions does the output work on?",
        a: "Plain filters work on any supported version. Some generated pipelines use newer operators such as $dateSubtract (5.0+) or $topN (5.2+). If you are on an older server, mention the version in your request.",
      },
      {
        q: "Why does my query return no documents?",
        a: "The usual causes are a type mismatch (an ObjectId compared with a string, or a date stored as a string), a field name that differs from the sample, or case-sensitive matching. Check the assumptions list under the result.",
      },
      {
        q: "Can it write update or delete queries?",
        a: "No, on purpose. The generator only produces read queries, and the output passes through the same guard wuup uses on connected databases, which refuses $out, $merge and server-side JavaScript.",
      },
      {
        q: "What happens to what I paste?",
        a: "It is sent to Google's Gemini model to write the query, and the result is cached for 7 days under a hash of the input so identical requests return instantly. Logs keep a hashed IP only. Don't paste credentials or real personal data.",
      },
      {
        q: "How is this different from asking ChatGPT?",
        a: "The prompt is tuned for MongoDB, the output is structured and validated, unsafe operators are rejected, and you get mongosh, Node.js and Python versions with correct ObjectId and date handling.",
      },
    ],
  },
  {
    kind: "tool",
    tool: "mongodb-aggregation-generator",
    mode: "aggregation",
    usesModel: true,
    name: "Aggregation generator",
    summary: "Turn a reporting question into a $match, $group, $lookup pipeline with every stage explained.",
    path: "/tools/mongodb-aggregation-generator",
    title: "MongoDB Aggregation Pipeline Generator",
    description:
      "Generate MongoDB aggregation pipelines from plain English. Group, join with $lookup, bucket and compute totals, with each stage explained. Free, no signup.",
    h1: "MongoDB aggregation pipeline generator",
    navLabel: "Aggregation generator",
    primaryKeyword: "mongodb aggregation generator",
    secondaryKeywords: ["mongodb aggregation pipeline builder", "aggregation pipeline examples", "mongodb group by", "mongodb lookup example"],
    status: "published",
    priority: "P0",
    updated: UPDATED,
    og: { template: "tool", eyebrow: "Free tool", title: "MongoDB aggregation pipeline generator" },
    related: ["/tools/mongodb-aggregation-explainer", "/tools/mongodb-query-generator", "/glossary/aggregation-pipeline"],
    lead:
      "Describe the report you need, revenue by month, top products, a funnel, a join, and get a MongoDB aggregation pipeline with every stage explained in plain English. Pipelines are checked against an allowlist of read-only stages.",
    examples: aggregationExamples,
    howItWorks: [
      { title: "Ask a reporting question", body: "Totals, averages, rankings, time series, joins: say what the result should look like." },
      { title: "Paste a sample document", body: "Real field names and types make the difference between a pipeline that runs and one that returns nothing." },
      { title: "Read the stages", body: "Each stage comes with a one-line explanation, plus assumptions and performance warnings." },
      { title: "Run it yourself", body: "Copy it for mongosh, Node.js or Python. The tool never touches your data." },
    ],
    wontDo: [
      "Run the pipeline. It writes the pipeline only.",
      "Use $out or $merge, or any stage outside the read-only allowlist.",
      "Use server-side JavaScript ($function, $accumulator, $where).",
      "Guess silently. Unknown fields and units are listed as assumptions.",
    ],
    guides: [GUIDES.aggregation, GUIDES.sql, GUIDES.plainEnglish],
    connector: "/chat-with-mongodb",
    sections: [
      {
        heading: "How an aggregation pipeline works",
        body: [
          "A pipeline is a list of stages. Each stage takes the documents produced by the previous one, transforms them and passes the result on. $match filters, $group summarises, $project reshapes, $sort orders and $lookup joins another collection.",
          "Order matters. Putting $match first means fewer documents reach the expensive stages, and a $match or $sort at the start of a pipeline can use an index.",
        ],
      },
      {
        heading: "Patterns worth knowing",
        body: [
          "Unwind then group to aggregate inside arrays. Group by $dateToString or $dateTrunc for time series. Use $addToSet then $size for distinct counts. Use $lookup with a nested pipeline to filter what you join. Use $facet to compute several summaries in one round trip.",
          "Every example below is run against sample data before it is published, and its result preview shows what MongoDB actually returned.",
        ],
      },
    ],
    faqs: [
      {
        q: "Which stages can the generator use?",
        a: "Read-only stages only: $match, $project, $addFields/$set, $unset, $group, $sort, $limit, $skip, $unwind, $count, $sortByCount, $bucket, $bucketAuto, $facet, $lookup, $graphLookup, $unionWith, $replaceRoot/$replaceWith, $sample, $setWindowFields, $densify, $fill and $geoNear.",
      },
      {
        q: "Will the pipeline be fast on a large collection?",
        a: "The generator puts $match early and flags common performance risks, such as $lookup on an unindexed field or a $group over a whole collection. Check the warnings, and run explain() on your server for the real plan.",
      },
      {
        q: "Can it do joins?",
        a: "Yes, with $lookup, including the form with a nested pipeline to filter or reshape the joined documents. Without a sample of the second collection it lists the joined field names as assumptions.",
      },
      {
        q: "Does it handle dates and time zones?",
        a: "It uses $dateToString, $dateTrunc and $dateDiff, which work in UTC unless a timezone is given. Mention a time zone (for example Asia/Kolkata) and it will be passed to the date operators.",
      },
      {
        q: "Is it free?",
        a: "Yes, with a limit of 5 requests a minute and 30 a day per visitor. A wuup account adds 50 free questions that run read-only against your own MongoDB and return charts and tables.",
      },
      {
        q: "Can I get an explanation of a pipeline I already have?",
        a: "Yes. Paste it into the aggregation explainer, which shows a card for every stage instantly and can write a plain-English walkthrough on request.",
      },
    ],
  },
  {
    kind: "tool",
    tool: "mongodb-aggregation-explainer",
    mode: "explain",
    usesModel: true,
    name: "Aggregation explainer",
    summary: "Paste a pipeline and read what every stage does, with performance notes and risky stages flagged.",
    path: "/tools/mongodb-aggregation-explainer",
    title: "MongoDB Aggregation Explainer",
    description:
      "Paste any MongoDB aggregation pipeline and see what each stage does in plain English, with performance notes and write stages flagged. Free and runs nothing.",
    h1: "MongoDB aggregation explainer",
    navLabel: "Aggregation explainer",
    primaryKeyword: "explain mongodb aggregation pipeline",
    secondaryKeywords: ["mongodb aggregation explained", "what does $group do", "aggregation pipeline stages explained"],
    status: "published",
    priority: "P1",
    updated: UPDATED,
    og: { template: "tool", eyebrow: "Free tool", title: "MongoDB aggregation explainer" },
    related: ["/tools/mongodb-aggregation-generator", "/glossary/aggregation-pipeline", "/glossary/lookup"],
    lead:
      "Paste an aggregation pipeline, in JSON or mongosh syntax, and get a card for every stage right away, then a plain-English walkthrough of what the whole pipeline returns. Write stages and server-side JavaScript are flagged, and nothing is run.",
    examples: explainExamples,
    howItWorks: [
      { title: "Paste a pipeline", body: "JSON, relaxed JSON or a full db.collection.aggregate([...]) call from mongosh all work." },
      { title: "See every stage", body: "Stage cards appear instantly in your browser, with a description and a link to the MongoDB docs." },
      { title: "Get the walkthrough", body: "Ask for the narrative to get a summary, per-stage explanation with your real field names and performance notes." },
      { title: "Spot the risks", body: "$out, $merge, $function and $where are flagged before you run anything." },
    ],
    wontDo: [
      "Execute or rewrite your pipeline.",
      "Know your indexes. Performance notes are general advice; run explain() for the real plan.",
      "Send anything until you ask for the walkthrough. Stage cards are built locally.",
    ],
    guides: [GUIDES.aggregation, GUIDES.plainEnglish],
    connector: "/chat-with-mongodb",
    sections: [
      {
        heading: "Reading a pipeline from top to bottom",
        body: [
          "Read a pipeline like a recipe: each stage receives the output of the one above it. Track the shape of the documents as you go. After a $group, the original fields are gone and only _id and the accumulators remain. After an $unwind, one document has become many.",
          "The stage cards show this shape change for each step, and the walkthrough names your actual fields.",
        ],
      },
      {
        heading: "Stages that deserve a second look",
        body: [
          "$out and $merge write to a collection. $function, $accumulator and $where run JavaScript on the server. $lookup without an index on the foreign field and $group or $sort over a whole collection are the most common causes of slow pipelines.",
        ],
      },
    ],
    faqs: [
      {
        q: "What formats can I paste?",
        a: "Strict JSON, relaxed JSON with unquoted keys and single quotes, or mongosh syntax including ObjectId(...), ISODate(...) and new Date(...). A whole db.orders.aggregate([...]) call works too.",
      },
      {
        q: "Is my pipeline sent anywhere?",
        a: "Stage cards are built in your browser. Only when you click for the walkthrough is the pipeline text sent to the model to be explained. It is never executed.",
      },
      {
        q: "Will it tell me if my pipeline is wrong?",
        a: "It flags stages that look wrong or risky, but it doesn't know your data. Run the pipeline on a sample with a $limit to confirm the output shape.",
      },
      {
        q: "Does it understand $setWindowFields, $densify and $fill?",
        a: "Yes. The stage reference covers every stage on wuup's read-only allowlist, plus the write and JavaScript operators so they can be flagged.",
      },
      {
        q: "Is it free?",
        a: "Yes. Stage cards are unlimited. The written walkthrough shares the free tools limit of 5 requests a minute and 30 a day.",
      },
      {
        q: "Can wuup explain the queries it runs on my data?",
        a: "Yes. Every wuup answer shows the queries it used, so you can read or copy the exact pipeline behind each number.",
      },
    ],
  },
  {
    kind: "tool",
    tool: "sql-to-mongodb-converter",
    mode: "sql",
    usesModel: true,
    name: "SQL to MongoDB",
    summary: "Translate SELECT, JOIN, GROUP BY and HAVING into find() or an aggregation pipeline.",
    path: "/tools/sql-to-mongodb-converter",
    title: "SQL to MongoDB Query Converter",
    description:
      "Convert SQL SELECT queries to MongoDB. WHERE, JOIN, GROUP BY, HAVING and LIMIT become find() or an aggregation pipeline, with every mapping explained. Free.",
    h1: "SQL to MongoDB converter",
    navLabel: "SQL to MongoDB converter",
    primaryKeyword: "sql to mongodb converter",
    secondaryKeywords: ["convert sql to mongodb query", "sql to mongodb aggregation", "mongodb equivalent of sql join", "sql group by in mongodb"],
    status: "published",
    priority: "P0",
    updated: UPDATED,
    og: { template: "tool", eyebrow: "Free tool", title: "SQL to MongoDB converter" },
    related: ["/tools/mongodb-query-generator", "/glossary/text-to-sql", "/tools/mongodb-aggregation-generator"],
    lead:
      "Paste a SQL SELECT and get the MongoDB equivalent: a find() for simple filters, or an aggregation pipeline for GROUP BY, HAVING, DISTINCT and JOINs. Each clause is mapped and explained, including where SQL and MongoDB behave differently.",
    examples: sqlExamples,
    howItWorks: [
      { title: "Paste a SELECT", body: "One statement at a time. Table names become collection names unless you say otherwise." },
      { title: "Add a sample (optional)", body: "A sample document helps with nested fields and ObjectId references." },
      { title: "Read the mapping", body: "Each SQL clause is matched to its MongoDB stage or operator, with differences called out." },
      { title: "Copy the result", body: "mongosh, Node.js or PyMongo, ready to run." },
    ],
    wontDo: [
      "Convert INSERT, UPDATE, DELETE or DDL. Only SELECT statements are translated.",
      "Migrate your schema. Normalised tables often belong embedded in one MongoDB document.",
      "Run anything against your database.",
    ],
    guides: [GUIDES.sql, GUIDES.aggregation, "/guides/text-to-sql-vs-text-to-mongodb"],
    connector: "/chat-with-mongodb",
    sections: [
      {
        heading: "How SQL maps to MongoDB",
        body: [
          "WHERE becomes the find filter or a $match stage. SELECT columns become a projection. ORDER BY, LIMIT and OFFSET become sort, limit and skip. GROUP BY becomes $group, with COUNT(*) as { $sum: 1 } and SUM, AVG, MIN and MAX as accumulators. HAVING is a $match after the $group. JOIN becomes $lookup.",
        ],
      },
      {
        heading: "Where the two behave differently",
        body: [
          "{ field: null } matches missing fields as well as nulls. Regex matching is case-sensitive by default. $lookup is a LEFT JOIN unless you $unwind the result. Fields can hold arrays, so an equality match on an array field checks whether the array contains the value.",
          "These differences are the main source of wrong results when porting reports, so the converter calls them out in its explanation.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does it support JOINs?",
        a: "Yes. INNER JOIN becomes $lookup followed by $unwind; LEFT JOIN becomes $lookup on its own (or $unwind with preserveNullAndEmptyArrays). Multi-table joins become several $lookup stages.",
      },
      {
        q: "What about subqueries and window functions?",
        a: "Simple IN (SELECT ...) subqueries become a $lookup. Window functions such as SUM() OVER (ORDER BY ...) map to $setWindowFields. Very complex statements may need to be split.",
      },
      {
        q: "Will it convert UPDATE or DELETE?",
        a: "No. The converter only translates SELECT statements and refuses to produce write operations.",
      },
      {
        q: "Are the results identical to SQL?",
        a: "For the patterns shown here, yes, and each example was run to confirm it. Watch null handling, case-sensitive regexes and array fields, which are listed under warnings when they apply.",
      },
      {
        q: "Is PostgreSQL on the wuup roadmap?",
        a: "Yes. Today wuup connects to MongoDB, Google Sheets and documents, and PostgreSQL is on the roadmap.",
      },
      {
        q: "Is it free?",
        a: "Yes, with no signup. The limit is 5 conversions a minute and 30 a day per visitor.",
      },
    ],
  },
  {
    kind: "tool",
    tool: "mongodb-schema-from-json",
    mode: "schema",
    usesModel: false,
    name: "Schema from JSON",
    summary: "Paste documents to get field types, presence, a $jsonSchema validator, TypeScript and Mongoose. In your browser.",
    path: "/tools/mongodb-schema-from-json",
    title: "MongoDB Schema from JSON: validator and TS types",
    description:
      "Infer a MongoDB schema from sample JSON: field types and presence, a $jsonSchema validator, a TypeScript interface and a Mongoose schema, in your browser.",
    h1: "MongoDB schema from JSON",
    navLabel: "Schema from JSON",
    primaryKeyword: "mongodb schema from json",
    secondaryKeywords: ["infer mongodb schema", "json to mongoose schema", "mongodb jsonschema validator generator", "json to typescript interface mongodb"],
    status: "published",
    priority: "P1",
    updated: UPDATED,
    og: { template: "tool", eyebrow: "Free tool", title: "MongoDB schema from JSON" },
    related: ["/tools/mongodb-query-generator", "/chat-with-mongodb", "/tools/mongodb-aggregation-generator"],
    lead:
      "Paste one or more documents and get the schema they imply: every field with its types and how often it appears, plus a $jsonSchema validator, a TypeScript interface and a Mongoose schema. Everything runs in your browser; nothing is uploaded.",
    examples: schemaExamples,
    howItWorks: [
      { title: "Paste documents", body: "A JSON array, one document per line, or mongosh output with ObjectId(...) and ISODate(...)." },
      { title: "See every field", body: "Nested paths, array element types, mixed types and the percentage of documents that have each field." },
      { title: "Copy a validator", body: "Fields present in every document become required in the $jsonSchema validator." },
      { title: "Or copy types", body: "A TypeScript interface and a Mongoose schema, with optional fields marked." },
    ],
    wontDo: [
      "Upload your documents. Inference runs entirely in this page.",
      "Guess from one document. Paste several (or use $sample) to see which fields are optional.",
      "Enforce anything. Apply the validator with collMod yourself, after testing it.",
    ],
    guides: [GUIDES.schema, GUIDES.readOnly],
    connector: "/chat-with-mongodb",
    sections: [
      {
        heading: "Inferring a schema from documents",
        body: [
          "A MongoDB collection has no declared schema, but its documents do have one in practice. Looking at a sample tells you which fields always exist, which are optional, and where the same field holds different types, the usual source of bugs and empty query results.",
          "The tool walks every document, records each field path (including inside arrays and embedded objects), counts the BSON types it sees and the share of documents that have it.",
        ],
      },
      {
        heading: "From inferred schema to validator",
        body: [
          "Fields present in 100% of the sample become required; mixed types become a bsonType list. Before applying it with db.runCommand({ collMod: ..., validator: ... }), use the $nor + $jsonSchema query from the examples below to find documents that would fail it, and start with validationAction \"warn\".",
          "wuup does the same kind of scan automatically when you connect a database, so its answers use your real field names and types.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is my data uploaded?",
        a: "No. The schema tool runs entirely in your browser with no server call, so you can use it on documents you can't share.",
      },
      {
        q: "How many documents should I paste?",
        a: "As many as is practical. With one document every field looks required. Twenty to a hundred documents from $sample give a realistic picture of optional fields.",
      },
      {
        q: "Does it understand ObjectId and ISODate?",
        a: "Yes. mongosh values such as ObjectId(\"...\"), ISODate(\"...\"), new Date(\"...\") and NumberDecimal(\"...\") are recognised, as are Extended JSON forms like {\"$oid\": \"...\"} and {\"$date\": \"...\"}.",
      },
      {
        q: "How are mixed types handled?",
        a: "Each type is counted. The validator gets a bsonType list, the TypeScript interface a union and the Mongoose schema falls back to Mixed when a field has incompatible types.",
      },
      {
        q: "Can I apply the validator to an existing collection?",
        a: "Yes, with collMod. Existing documents are not checked until they are updated, so find violators first and consider validationLevel \"moderate\".",
      },
      {
        q: "Is it free?",
        a: "Yes, with no limits, because it never calls a server.",
      },
    ],
  },
];

export function getTool(id: string): ToolPageFull | undefined {
  return tools.find((t) => t.tool === id);
}
