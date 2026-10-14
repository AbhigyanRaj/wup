import type { MongoStage } from "../types";

/**
 * Aggregation stages and common operators, in plain English.
 * Used by the aggregation explainer (instant stage cards) and the glossary.
 * `allowed` mirrors packages/brain/src/bridges/mongo/guard.ts.
 */

export interface MongoStageFull extends MongoStage {
  kind: "stage" | "operator";
  docsUrl: string;
}

const STAGE_DOCS = "https://www.mongodb.com/docs/manual/reference/operator/aggregation/";
const QUERY_DOCS = "https://www.mongodb.com/docs/manual/reference/operator/query/";

const stage = (name: string, summary: string, example: string, allowed = true, note?: string): MongoStageFull => ({
  kind: "stage",
  name,
  summary,
  example,
  allowed,
  note,
  docsUrl: `${STAGE_DOCS}${name.slice(1)}/`,
});

const op = (name: string, summary: string, example: string, docs: "agg" | "query" = "agg", allowed = true, note?: string): MongoStageFull => ({
  kind: "operator",
  name,
  summary,
  example,
  allowed,
  note,
  docsUrl: `${docs === "agg" ? STAGE_DOCS : QUERY_DOCS}${name.slice(1)}/`,
});

export const mongoStages: MongoStageFull[] = [
  stage("$match", "Keeps only the documents that pass a filter, like WHERE in SQL. Put it first so it can use an index.", '{ $match: { status: "delivered" } }'),
  stage("$project", "Chooses, renames or computes the fields each document carries forward.", "{ $project: { _id: 0, orderNumber: 1, total: 1 } }"),
  stage("$addFields", "Adds computed fields while keeping every existing field. $set is an alias.", '{ $addFields: { year: { $year: "$createdAt" } } }'),
  stage("$set", "Alias of $addFields: adds or overwrites fields on each document.", '{ $set: { totalInLakh: { $divide: ["$total", 100000] } } }'),
  stage("$unset", "Removes the listed fields from each document.", '{ $unset: ["items", "shipping"] }'),
  stage("$group", "Collapses documents that share a key into one row and computes totals, counts or averages, like GROUP BY.", '{ $group: { _id: "$status", revenue: { $sum: "$total" } } }'),
  stage("$sort", "Orders documents by one or more fields; 1 ascending, -1 descending.", "{ $sort: { revenue: -1 } }"),
  stage("$limit", "Passes on only the first N documents.", "{ $limit: 10 }"),
  stage("$skip", "Skips the first N documents, like OFFSET.", "{ $skip: 20 }"),
  stage("$unwind", "Turns one document with an array into one document per array element.", '{ $unwind: "$items" }'),
  stage("$count", "Replaces the stream with a single document holding the number of documents.", '{ $count: "orders" }'),
  stage("$sortByCount", "Groups by an expression, counts each group and sorts by the count, highest first.", '{ $sortByCount: "$status" }'),
  stage("$bucket", "Puts documents into ranges you define (price bands, age groups) and summarises each range.", '{ $bucket: { groupBy: "$price", boundaries: [0, 1000, 5000] } }'),
  stage("$bucketAuto", "Like $bucket, but MongoDB picks boundaries to spread documents evenly across N buckets.", '{ $bucketAuto: { groupBy: "$price", buckets: 4 } }'),
  stage("$facet", "Runs several sub-pipelines over the same input and returns their results in one document.", '{ $facet: { byStatus: [{ $sortByCount: "$status" }], total: [{ $count: "n" }] } }'),
  stage("$lookup", "Joins documents from another collection in the same database, like a LEFT JOIN.", '{ $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "customer" } }'),
  stage("$graphLookup", "Follows references recursively (reporting lines, category trees) and collects every reachable document.", '{ $graphLookup: { from: "employees", startWith: "$managerId", connectFromField: "managerId", connectToField: "_id", as: "chain" } }'),
  stage("$unionWith", "Appends the documents of another collection (optionally through a pipeline), like UNION ALL.", '{ $unionWith: { coll: "tickets", pipeline: [{ $project: { createdAt: 1 } }] } }'),
  stage("$replaceRoot", "Replaces each document with one of its embedded documents or a new object.", '{ $replaceRoot: { newRoot: "$shipping" } }'),
  stage("$replaceWith", "Shorter form of $replaceRoot.", '{ $replaceWith: { order: "$orderNumber", city: "$shipping.city" } }'),
  stage("$sample", "Picks N random documents. Useful for exploring or inferring a schema.", "{ $sample: { size: 20 } }"),
  stage("$setWindowFields", "Computes running totals, moving averages and ranks over an ordered window, like SQL window functions.", '{ $setWindowFields: { sortBy: { createdAt: 1 }, output: { running: { $sum: "$total", window: { documents: ["unbounded", "current"] } } } } }'),
  stage("$densify", "Fills gaps in a sequence (missing days or numbers) by inserting documents.", '{ $densify: { field: "day", range: { step: 1, unit: "day", bounds: "full" } } }'),
  stage("$fill", "Fills null or missing values, for example with the previous value or a linear interpolation.", '{ $fill: { sortBy: { day: 1 }, output: { revenue: { method: "locf" } } } }'),
  stage("$geoNear", "Returns documents ordered by distance from a point. Must be the first stage and needs a geospatial index.", '{ $geoNear: { near: { type: "Point", coordinates: [77.59, 12.97] }, distanceField: "km" } }'),
  stage("$out", "Writes the pipeline result to a collection, replacing it.", '{ $out: "monthly_report" }', false, "Writes data. wuup never runs it."),
  stage("$merge", "Writes or merges the pipeline result into a collection.", '{ $merge: { into: "report" } }', false, "Writes data. wuup never runs it."),
  op("$sum", "Adds numbers. { $sum: 1 } in a $group counts documents.", '{ $sum: "$total" }'),
  op("$avg", "Average of numeric values; non-numbers are ignored.", '{ $avg: "$total" }'),
  op("$min", "Smallest value in the group (or of an array).", '{ $min: "$createdAt" }'),
  op("$max", "Largest value in the group (or of an array).", '{ $max: "$total" }'),
  op("$first", "Value from the first document in the group (order follows the input).", '{ $first: "$items.name" }'),
  op("$addToSet", "Collects unique values into an array; pair with $size for distinct counts.", '{ $addToSet: "$userId" }'),
  op("$push", "Collects every value into an array, duplicates included.", '{ $push: "$sku" }'),
  op("$topN", "Keeps the top N values of a group by a sort order (MongoDB 5.2+).", '{ $topN: { n: 3, sortBy: { price: -1 }, output: "$name" } }'),
  op("$dateToString", "Formats a date as text, often used to group by day or month.", '{ $dateToString: { format: "%Y-%m", date: "$createdAt" } }'),
  op("$dateTrunc", "Rounds a date down to a unit (day, week, month) and keeps it a date.", '{ $dateTrunc: { date: "$ts", unit: "week" } }'),
  op("$dateDiff", "Number of unit boundaries (minutes, days...) between two dates.", '{ $dateDiff: { startDate: "$createdAt", endDate: "$deliveredAt", unit: "day" } }'),
  op("$dateSubtract", "Subtracts an amount of time from a date; with $$NOW it builds relative windows.", '{ $dateSubtract: { startDate: "$$NOW", unit: "day", amount: 30 } }'),
  op("$cond", "If/then/else inside an expression.", '{ $cond: [{ $gte: ["$total", 10000] }, "large", "small"] }'),
  op("$size", "Number of elements in an array.", '{ $size: "$items" }'),
  op("$multiply", "Multiplies numbers, for example quantity times price.", '{ $multiply: ["$qty", "$price"] }'),
  op("$round", "Rounds a number to a given number of decimal places.", '{ $round: ["$avg", 1] }'),
  op("$expr", "Lets a filter use aggregation expressions, such as comparing two fields or using $$NOW.", '{ $expr: { $gt: ["$total", "$budget"] } }', "query"),
  op("$in", "Matches any value in a list.", '{ status: { $in: ["open", "pending"] } }', "query"),
  op("$exists", "Matches documents that have (or lack) a field.", "{ phone: { $exists: false } }", "query"),
  op("$regex", "Pattern match on strings; anchor with ^ so an index can help.", '{ name: { $regex: "^USB" } }', "query"),
  op("$elemMatch", "Requires one array element to match several conditions at once.", '{ items: { $elemMatch: { sku: "KB-201", qty: { $gte: 2 } } } }', "query"),
  op("$where", "Runs JavaScript for each document.", '{ $where: "this.a > this.b" }', "query", false, "Server-side JavaScript. wuup blocks it."),
  op("$function", "Runs a custom JavaScript function inside an expression.", "{ $function: { body: '...', args: [], lang: 'js' } }", "agg", false, "Server-side JavaScript. wuup blocks it."),
  op("$accumulator", "Custom JavaScript accumulator inside $group.", "{ $accumulator: { init: '...', accumulate: '...', lang: 'js' } }", "agg", false, "Server-side JavaScript. wuup blocks it."),
];

export function getStage(name: string): MongoStageFull | undefined {
  return mongoStages.find((s) => s.name === name);
}
