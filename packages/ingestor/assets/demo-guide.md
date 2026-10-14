# Getting started with wuup

This guide is a sample document that lives in your knowledge base. Ask wuup a question about it, for example "How do I connect MongoDB?", and the answer will cite this guide with a numbered source like [1]. You can delete it at any time from the Documents list.

## What wuup is

wuup is an AI workspace for asking questions about your own data in plain English. Instead of writing queries by hand, exporting spreadsheets or searching through folders of PDFs, you type a question and wuup works out where the answer lives. It can read from three kinds of sources:

- **Databases.** wuup connects to MongoDB, inspects the shape of your collections and runs safe, read-only queries to answer questions with real numbers.
- **Spreadsheets.** wuup reads Google Sheets you share with it, so a team tracker or a finance sheet can be queried like a table.
- **Documents.** You can upload PDFs, Word files, Markdown, CSV and plain text. wuup splits them into passages, indexes them and quotes the relevant parts when they help answer a question.

Every answer shows where it came from. Database answers list the queries that were run, and document answers include numbered citations that point back to the exact file.

## Connecting MongoDB, read-only

To connect a database, open the Add DB dialog and paste a MongoDB connection string. We strongly recommend creating a dedicated database user for wuup with the built-in `read` role on only the databases you want to explore. wuup never needs write access.

Even with a read-only user, wuup adds its own safety layer:

- Only read operations are allowed: find, aggregate, count and distinct. Stages that write data, such as `$out` and `$merge`, are rejected before they reach your server.
- Server inspection commands and JavaScript execution stages are blocked.
- Result sizes are capped, so a broad question cannot pull an entire collection into the chat.
- Connection strings are encrypted at rest and are never shown back in the interface.
- Hosts on private, loopback or link-local networks are refused, which prevents wuup from being pointed at internal infrastructure.

After connecting, wuup samples each collection to build a short schema summary. That summary is what lets it write correct queries for fields such as `createdAt`, `status` or nested objects without you describing your data model first.

## Scopes and redaction

Most databases contain more than you want an AI assistant to see. wuup gives you two controls when you add or edit a connection.

**Scopes** limit which databases and collections are visible. If you scope a connection to the `analytics` database and the `orders` and `customers` collections, wuup cannot list, sample or query anything else, even if the database user could.

**Redaction** hides individual fields. Add fields such as `password`, `email`, `phone` or `tokens` to the redaction list for a collection and they are removed from samples, query results and distinct values. wuup also refuses queries that would reveal a redacted field indirectly, for example by grouping on it or copying it into a new field. Redacted values are never sent to the language model.

A good starting point is to scope each connection to the collections a team actually needs, then redact anything that identifies a person or grants access to a system.

## Google Sheets

To query a spreadsheet, add a Google Sheets connection with the sheet's link. Either share the sheet with the service account address shown in the dialog, or make it viewable by anyone with the link. wuup reads the sheet's tabs and header rows, then answers questions such as "Which projects are over budget?" or "Total the Q3 column by region". Sheets connections are read-only as well. wuup does not edit cells, add rows or change sharing settings.

If a sheet has several tabs, mention the tab name in your question when it matters, for example "In the Pipeline tab, how many deals are in negotiation?".

## Documents and citations

Open the Documents panel and upload a file. Supported formats are PDF, Word (.docx), Markdown (.md), CSV and plain text (.txt). wuup checks the actual contents of each file, so a renamed image or binary is rejected even if its name ends in .pdf.

Indexing happens in the background. The panel shows progress as each batch of passages is embedded, and you can keep chatting while it runs. When a document is ready its status changes to Indexed.

A few details are worth knowing:

- **Scanned PDFs.** A PDF that contains only images of pages has no text to extract. Run it through OCR first, then upload the result.
- **CSV files.** Rows are grouped into passages and every passage repeats the header row, so each citation still makes sense on its own.
- **Large files.** Very long documents are capped at a fixed number of passages. If that happens the document is marked as truncated, and only the beginning is searchable.
- **Retry.** If indexing fails because of a temporary problem, such as a busy embedding service or a server restart, a Retry button appears. Retry reuses the text that was already extracted, so you do not need to upload the file again.
- **Duplicates.** Uploading the exact same file twice is detected and skipped.

When you ask a question, wuup searches your documents for the most relevant passages. Only passages that are a close match are used, and each one is numbered. The answer cites them inline, like [1] or [2], and the citation list shows the file name for each number. If nothing in your documents is relevant, wuup says so instead of guessing, and answers from your databases or general knowledge where appropriate.

Your documents are private to your account. Searches only ever look at passages you uploaded.

## Research mode

For questions that need more than one lookup, switch on research mode. In research mode wuup plans the question, runs several queries across your connected sources and documents, compares the results and writes a longer report with its reasoning and sources. It is useful for questions such as "Why did repeat orders drop last month?" or "Summarise every customer complaint about delivery in our support exports and check whether the affected orders were refunded".

Research takes longer than a normal answer, and wuup shows each step as it works so you can follow along or stop it early.

## Bring your own key (BYOK)

wuup includes a free allowance of questions so you can try it right away. When you reach the limit, or if you prefer to use your own account with an AI provider, open Settings and add your own API key. wuup supports keys for Google Gemini, Anthropic Claude, OpenAI and OpenRouter.

Keys are encrypted before they are stored and only a short hint, such as the first and last few characters, is ever displayed. You can replace or remove a key at any time. With your own key there is no daily question limit from wuup, and usage is billed by your provider under your account.

## Example questions

Here are some questions to try. Replace the collection and field names with your own.

About your database:

- "How many orders were placed in the last 30 days, broken down by status?"
- "Which ten customers spent the most this year?"
- "Show average delivery time per city as a bar chart."
- "Are there any users who signed up but never placed an order?"

About your spreadsheets:

- "In the Budget sheet, which departments are above plan?"
- "List the open tasks assigned to Priya, sorted by due date."

About your documents:

- "What does our refund policy say about damaged items?"
- "Summarise the onboarding guide in five bullet points."
- "According to this guide, how does redaction work?"

Mixing sources:

- "Compare the churn numbers in the database with the targets in the 2025 plan document."
- "Which product categories from the pricing PDF have no sales in the orders collection?"

## Tips for better answers

- Be specific about time ranges, units and filters. "Revenue in March 2025 in USD" beats "recent revenue".
- Name the source when you know it: "in the orders collection", "in the Hiring sheet", "in the handbook".
- Ask follow-up questions. wuup remembers the conversation, so "now split that by country" works.
- If an answer looks wrong, open the query details or the cited passages to see exactly what wuup used, then refine the question.

## Privacy and safety in short

wuup only reads data. Database and Sheets connections are read-only, connection details are encrypted, redacted fields never leave your database in results, and document search is limited to your own uploads. You stay in control of what is connected and can remove any connection or document at any time.

Welcome to wuup. Start by asking a question about this guide, then connect your own data.
