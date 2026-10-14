import type { GlossaryTerm } from "../types";

/** Glossary terms: /glossary/<slug>. Each body is 300 to 500 words. */

const UPDATED = "2026-10-14";

const base = {
  kind: "glossary" as const,
  status: "published" as const,
  updated: UPDATED,
};

export const glossary: GlossaryTerm[] = [
  {
    ...base,
    path: "/glossary/aggregation-pipeline",
    priority: "P1",
    term: "Aggregation pipeline",
    title: "What is a MongoDB aggregation pipeline?",
    description:
      "A MongoDB aggregation pipeline is a list of stages that filter, group, join and reshape documents in order. Definition, how it works and a worked example.",
    h1: "Aggregation pipeline",
    navLabel: "Aggregation pipeline",
    primaryKeyword: "what is an aggregation pipeline",
    secondaryKeywords: ["mongodb aggregation pipeline", "aggregation pipeline stages"],
    og: { template: "glossary", eyebrow: "Glossary", title: "What is an aggregation pipeline?" },
    related: ["/glossary/lookup", "/tools/mongodb-aggregation-generator", "/tools/mongodb-aggregation-explainer"],
    short:
      "An aggregation pipeline is MongoDB's way of computing results from documents: an ordered list of stages, where each stage transforms the documents it receives and passes them to the next.",
    body: [
      "An aggregation pipeline is how you ask MongoDB for anything more than a list of matching documents. Totals, averages, counts per group, joins, time series and reshaped output all come from a pipeline: an array of stages run in order, inside the database, with the output of one stage becoming the input of the next.",
      "Each stage does one job. $match filters documents, much like WHERE in SQL. $group collapses documents that share a key into one result and computes accumulators such as $sum, $avg, $min, $max and $addToSet. $project and $addFields choose, rename or compute fields. $sort orders the stream, and $limit and $skip page through it. $unwind turns one document with an array into one document per element, which is how you aggregate over embedded line items. $lookup joins another collection in the same database, and $facet runs several sub-pipelines over the same input at once.",
      "Order matters, for both correctness and speed. A $match at the start can use an index and reduces how many documents the later stages handle, so it is almost always the first stage. After a $group, the original fields no longer exist: only _id and the accumulators you defined remain, so a later stage that refers to an old field will quietly see nothing. Reading a pipeline means tracking the shape of the documents as they flow from stage to stage.",
      "Pipelines run on the server, so they scale far better than fetching documents and summarising them in application code. They also have limits worth knowing: a stage that needs to hold a lot of data in memory, such as a large $group or an unindexed $sort, can hit MongoDB's memory limit unless disk use is allowed, and joins with $lookup are only fast when the foreign field is indexed.",
      "Pipelines can also write data with $out and $merge, or run JavaScript with $function and $accumulator. Tools that generate pipelines with AI should refuse those stages. wuup only runs pipelines built from an allowlist of read stages, checks every operator before anything reaches your database, and shows you the exact pipeline behind each answer.",
      "The example below computes revenue per month for orders that were not cancelled: filter, group by a formatted month, then sort. It is the same shape as most reporting pipelines you will write.",
    ],
    example: {
      language: "javascript",
      code: 'db.orders.aggregate([\n  { $match: { status: { $ne: "cancelled" } } },\n  { $group: {\n      _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },\n      revenue: { $sum: "$total" },\n      orders: { $sum: 1 }\n  } },\n  { $sort: { _id: 1 } }\n])',
    },
    seeAlso: ["/glossary/lookup", "/glossary/text-to-sql", "/tools/mongodb-aggregation-explainer"],
    faqs: [
      { q: "Is an aggregation pipeline the same as a query?", a: "It is a kind of query. find() returns matching documents as they are; a pipeline can also group, join, compute and reshape them." },
      { q: "How many stages can a pipeline have?", a: "MongoDB allows up to 1,000 stages per pipeline. wuup caps generated pipelines at 30 stages to keep them readable and fast." },
    ],
  },
  {
    ...base,
    path: "/glossary/lookup",
    priority: "P2",
    term: "$lookup",
    title: "What is $lookup in MongoDB? Joins explained",
    description:
      "$lookup is the MongoDB aggregation stage that joins documents from another collection, like a SQL LEFT JOIN. How it works, its forms and a worked example.",
    h1: "$lookup",
    navLabel: "$lookup",
    primaryKeyword: "mongodb lookup",
    secondaryKeywords: ["mongodb join", "$lookup example", "mongodb left join"],
    og: { template: "glossary", eyebrow: "Glossary", title: "What is $lookup in MongoDB?" },
    related: ["/glossary/aggregation-pipeline", "/tools/sql-to-mongodb-converter", "/tools/mongodb-aggregation-generator"],
    short:
      "$lookup is an aggregation stage that joins each input document with matching documents from another collection in the same database, storing the matches in an array field.",
    body: [
      "$lookup is MongoDB's join. Inside an aggregation pipeline, it takes each document flowing through, finds matching documents in another collection of the same database, and adds them as an array field. If nothing matches, the array is empty and the document still passes through, which makes $lookup behave like a SQL LEFT OUTER JOIN by default.",
      "The simplest form compares one field on each side. localField names the field in the current documents, foreignField names the field in the other collection, from is that collection, and as is the name of the new array field. Joining orders to customers on customerId and _id is the classic case. If localField is an array, each element is matched, which is handy for many-to-many references.",
      "The second form adds a pipeline that runs on the joined collection. You can filter what gets joined (only paid invoices), project only the fields you need, sort and limit (the latest three tickets), or match on several conditions using variables declared in let. Since MongoDB 5.0 you can combine localField and foreignField with a pipeline, which is often the clearest way to write a filtered join.",
      "Because the result is an array, the next stage usually reshapes it. $unwind turns the array into one document per match and drops documents with no match, which turns the join into an INNER JOIN. $first or $arrayElemAt pulls a single value out of a one-to-one join, and $size counts matches, which replaces COUNT with GROUP BY in many SQL translations.",
      "Performance depends on indexes. Each input document triggers a lookup in the foreign collection, so the foreignField should be indexed; without that index a join over many documents can be slow. Filtering with $match before the $lookup reduces how many lookups happen.",
      "Embedding is the alternative to joining. When data is always read together, such as line items with their order, MongoDB schemas usually embed it, and $lookup is kept for relationships that are shared or large. wuup only allows $lookup between collections you have enabled in the same database, so a generated join can never reach data outside the scope you chose.",
    ],
    example: {
      language: "javascript",
      code: 'db.orders.aggregate([\n  { $match: { status: "delivered" } },\n  { $lookup: {\n      from: "customers",\n      localField: "customerId",\n      foreignField: "_id",\n      as: "customer"\n  } },\n  { $unwind: "$customer" },\n  { $project: { _id: 0, orderNumber: 1, total: 1, customer: "$customer.name" } }\n])',
    },
    seeAlso: ["/glossary/aggregation-pipeline", "/tools/sql-to-mongodb-converter", "/glossary/text-to-sql"],
    faqs: [
      { q: "Can $lookup join across databases?", a: "Only within the same database on most deployments. wuup further limits it to collections you have enabled." },
      { q: "Is $lookup slow?", a: "It is fast when the foreign field is indexed and the input is filtered first. Without an index, each lookup scans the other collection." },
    ],
  },
  {
    ...base,
    path: "/glossary/rag",
    priority: "P1",
    term: "RAG (retrieval-augmented generation)",
    title: "What is RAG? Retrieval-augmented generation",
    description:
      "RAG (retrieval-augmented generation) lets an AI model answer from your documents by retrieving relevant passages first. How it works, its limits and an example.",
    h1: "RAG (retrieval-augmented generation)",
    navLabel: "RAG",
    primaryKeyword: "what is rag",
    secondaryKeywords: ["retrieval augmented generation", "rag explained", "rag with citations"],
    og: { template: "glossary", eyebrow: "Glossary", title: "What is RAG?" },
    related: ["/glossary/vector-search", "/chat-with-pdf", "/use-cases/research-pdfs-and-spreadsheets"],
    short:
      "Retrieval-augmented generation (RAG) is a technique where an AI system first retrieves relevant passages from your own documents, then has a language model answer using only those passages, ideally citing them.",
    body: [
      "RAG, short for retrieval-augmented generation, is the standard way to make a language model answer questions about documents it was never trained on. Instead of hoping the model remembers the answer, the system first retrieves the most relevant passages from your documents and puts them in the prompt, then asks the model to answer from that context.",
      "A RAG system has two phases. At ingestion, each document's text is extracted, split into chunks of a few hundred words with some overlap, and each chunk is turned into an embedding: a vector of numbers that captures its meaning. The vectors are stored in an index. At question time, the question is embedded the same way, the closest chunks are found with vector search, and the top few are passed to the model along with instructions to answer from them.",
      "Done well, RAG gives answers that are specific, current and checkable. Because the system knows which chunks it supplied, it can number them and show citations, so a reader can jump to the passage behind each statement. That is the main defence against confident but invented answers: if a claim has no citation, treat it with suspicion.",
      "RAG has clear limits. Retrieval only finds what the text layer contains, so scanned PDFs need OCR first. Chunking can split a table or separate a heading from its content. Questions that need every page, such as summarising a whole long report, are poorly served by retrieving a handful of chunks and work better as several narrower questions. And RAG is the wrong tool for numbers that live in a database: summing a column from retrieved text snippets is unreliable, while a database query is exact.",
      "That is why wuup uses both approaches. Documents you upload go through RAG and answers cite the numbered passages they used. Structured data in MongoDB or Google Sheets is answered by running a real query or reading a real range, with the query shown. One chat can combine both, with each kind of source cited in its own way.",
    ],
    example: {
      language: "text",
      code: "Question: What notice period does the Northwind contract require?\n\nRetrieved passages:\n[1] Northwind-MSA-2026.pdf, section 11.2: \"Either party may terminate at renewal by giving sixty (60) days' written notice...\"\n[2] Northwind-MSA-2026.pdf, section 11.4: \"Notices must be sent to the addresses in Schedule B...\"\n\nAnswer: The contract requires 60 days' written notice before renewal [1], sent to the addresses in Schedule B [2].",
    },
    seeAlso: ["/glossary/vector-search", "/glossary/text-to-sql", "/chat-with-pdf"],
    faqs: [
      { q: "Does RAG stop hallucinations?", a: "It reduces them by grounding the answer in retrieved text, and citations make the rest easy to spot. It does not make a model infallible." },
      { q: "Is RAG the same as fine-tuning?", a: "No. Fine-tuning changes a model's weights; RAG leaves the model as it is and supplies relevant text at question time." },
    ],
  },
  {
    ...base,
    path: "/glossary/vector-search",
    priority: "P2",
    term: "Vector search",
    title: "What is vector search? Semantic search explained",
    description:
      "Vector search finds items by meaning: text becomes embeddings compared by similarity. How it works, how it differs from keyword search, and an example.",
    h1: "Vector search",
    navLabel: "Vector search",
    primaryKeyword: "what is vector search",
    secondaryKeywords: ["semantic search", "embeddings search", "cosine similarity search"],
    og: { template: "glossary", eyebrow: "Glossary", title: "What is vector search?" },
    related: ["/glossary/rag", "/chat-with-pdf", "/glossary/text-to-sql"],
    short:
      "Vector search finds the items whose embeddings, numeric representations of meaning, are closest to the embedding of a query, so results match by meaning rather than by exact words.",
    body: [
      "Vector search is a way of finding information by meaning instead of by matching words. Text, and sometimes images or audio, is converted into an embedding: a list of hundreds or thousands of numbers produced by a model so that items with similar meanings end up close together. Searching means embedding the query and finding the stored vectors nearest to it.",
      "Closeness is measured with a similarity function, most often cosine similarity, which compares the direction of two vectors, or dot product and Euclidean distance. A query like \"how do I end the contract early\" lands near a passage that says \"either party may terminate with sixty days' notice\" even though they share almost no words. Keyword search would miss that match; vector search finds it.",
      "For large collections, comparing the query with every vector is too slow, so vector databases and search engines use approximate nearest neighbour indexes such as HNSW. These trade a tiny amount of recall for large speedups. MongoDB Atlas and dedicated vector databases both offer this.",
      "Vector search is not always better than keyword search. Exact identifiers, product codes, error messages and names are often found more reliably by keywords, so many systems combine both in hybrid search and rerank the results. Embeddings also depend on the model that produced them: you must embed queries and documents with the same model, and switching models means re-embedding everything.",
      "Vector search is the retrieval step in most RAG systems. In wuup, uploaded documents are split into passages and embedded; when you ask a question, the closest passages above a similarity threshold are retrieved and given to the model, which answers with numbered citations to them. Structured data is handled differently: questions about MongoDB or Google Sheets are answered by real queries, not by similarity search over rows.",
    ],
    example: {
      language: "text",
      code: "query:    \"how do I end the contract early\"\nembedding: [0.021, -0.113, 0.087, ...]\n\nnearest passages (cosine similarity):\n0.83  \"Either party may terminate at renewal by giving sixty (60) days' notice\"\n0.71  \"Early termination fees are set out in Schedule C\"\n0.42  \"This agreement is governed by the laws of India\"",
    },
    seeAlso: ["/glossary/rag", "/glossary/aggregation-pipeline", "/chat-with-pdf"],
    faqs: [
      { q: "What is an embedding?", a: "A list of numbers produced by a model to represent the meaning of a piece of text, so that similar meanings have nearby vectors." },
      { q: "Do I need a vector database?", a: "For small collections, no; a brute-force similarity search is fine. Approximate indexes matter once you have many thousands of vectors." },
    ],
  },
  {
    ...base,
    path: "/glossary/text-to-sql",
    priority: "P1",
    term: "Text-to-SQL",
    title: "What is text-to-SQL (and text-to-MongoDB)?",
    description:
      "Text-to-SQL turns a plain-English question into a database query using an AI model. How it works, why schema context matters, the risks and an example.",
    h1: "Text-to-SQL",
    navLabel: "Text-to-SQL",
    primaryKeyword: "what is text to sql",
    secondaryKeywords: ["natural language to sql", "text to mongodb", "nl2sql"],
    og: { template: "glossary", eyebrow: "Glossary", title: "What is text-to-SQL?" },
    related: ["/tools/mongodb-query-generator", "/tools/sql-to-mongodb-converter", "/chat-with-mongodb"],
    short:
      "Text-to-SQL is the task of turning a question written in plain language into a database query; the same idea applied to MongoDB produces a find() or an aggregation pipeline.",
    body: [
      "Text-to-SQL means converting a question in natural language, such as \"which ten customers spent the most last quarter\", into a query a database can run. Large language models made it practical: given the question and a description of the database, a model can write a SELECT with the right joins, filters and grouping. The same idea applied to MongoDB is often called text-to-MongoDB, and the output is a find() or an aggregation pipeline instead of SQL.",
      "Schema context is what separates a working query from a plausible-looking one. A model that does not know the table and column names, their types and how tables relate will guess, and a guessed column name either fails or, worse, returns a wrong answer silently. Good systems give the model the schema, sample values for ambiguous columns and the relationships between tables or collections. For MongoDB this matters even more because there is no declared schema: field names, nested objects and types such as ObjectId versus string must be learned by sampling documents.",
      "There are risks to manage. A model can write a query that modifies data, so production systems should connect with read-only credentials and also check the generated query before running it. Queries can be expensive, so timeouts and row limits protect the database. Questions can be ambiguous (\"active users\", \"last month\"), and a good assistant asks rather than guessing. Finally, every answer should show the query, so a person can verify how a number was produced.",
      "Text-to-SQL tools fall into two groups. Query writers produce code for you to run yourself; they are useful for learning and for one-off queries. Assistants connect to the database, run the query and present the result as an answer, a table or a chart, which removes the copy and paste but raises the bar for safety.",
      "wuup is the second kind for MongoDB: it scans your schema, writes a query, checks it against a read-only guard, runs it with limits and shows the query with the answer. Its free tools, such as the MongoDB query generator and the SQL to MongoDB converter, are the first kind and need no account.",
    ],
    example: {
      language: "text",
      code: "Question: Revenue per status, highest first\n\nSQL:\nSELECT status, SUM(total) AS revenue\nFROM orders\nGROUP BY status\nORDER BY revenue DESC;\n\nMongoDB:\ndb.orders.aggregate([\n  { $group: { _id: \"$status\", revenue: { $sum: \"$total\" } } },\n  { $sort: { revenue: -1 } }\n])",
    },
    seeAlso: ["/glossary/aggregation-pipeline", "/glossary/lookup", "/tools/mongodb-query-generator"],
    faqs: [
      { q: "How accurate is text-to-SQL?", a: "Accuracy depends mostly on schema context and question clarity. Always check the generated query, especially for joins and date ranges." },
      { q: "Does wuup support SQL databases?", a: "Not yet. wuup connects to MongoDB, Google Sheets and documents today; PostgreSQL is on the roadmap." },
    ],
  },
];

export function getGlossaryTerm(path: string): GlossaryTerm | undefined {
  return glossary.find((g) => g.path === path);
}
