import { Client } from "@notionhq/client";
import { performance } from "perf_hooks";
import { setTimeout } from "timers/promises";

const notion = new Client({ auth: process.env.NOTION_KEY });

const databaseId = process.env.NOTION_DATABASE_ID;
const dryRun = process.env.DRY_RUN;

// @see https://developers.notion.com/reference/post-database-query
const fetchPages = async (databaseId, filter, sorts, startCursor, pageSize) => {
  try {
    return await notion.databases.query({
      database_id: databaseId,
      filter,
      sorts,
      start_cursor: startCursor,
      page_size: pageSize,
    });
  } catch (error) {
    console.error(error.body);
  }
};

const fetchNotReadPages = async (startCursor) => {
  const filter = {
    property: "Read Status",
    select: {
      is_empty: true,
    },
  };
  const sorts = [
    {
      property: "Created",
      direction: "ascending",
    },
  ];
  const pageSize = 100;

  return fetchPages(databaseId, filter, sorts, startCursor, pageSize);
};

// @see https://developers.notion.com/reference/patch-page
const updatePage = async (pageId, properties) => {
  try {
    await notion.pages.update({
      page_id: pageId,
      properties,
    });
  } catch (error) {
    console.error(error.body);
  }
};

const changePageReadStatusToTrash = async (pageId) => {
  const properties = {
    "Read Status": {
      select: {
        name: "Trash",
      },
    },
  };

  await updatePage(pageId, properties);
};

const main = async () => {
  const t0 = performance.now();
  console.log(`${new Date()} Update started.`);

  const pages = [];
  let nextCursor;

  while (true) {
    const response = await fetchNotReadPages(nextCursor);

    pages.push(...response.results);

    if (!response.has_more) {
      break;
    }

    nextCursor = response.next_cursor;
  }

  for (let i = 0; i < pages.length; i++) {
    if (dryRun) {
      console.log(pages[i].id);
      continue;
    }

    await changePageReadStatusToTrash(pages[i].id);
    if (i !== pages.length - 1) {
      // Sleep for Rate Limits
      // @see https://developers.notion.com/reference/request-limits
      await setTimeout(300);
    }
  }

  const t1 = performance.now();
  console.log(
    `${new Date()} ${pages.length} pages updated. Update took ${t1 - t0}ms.`
  );
};

main();
