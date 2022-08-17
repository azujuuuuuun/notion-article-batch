import { Client } from "@notionhq/client";
import { performance } from "perf_hooks";
import { setTimeout } from "timers/promises";
import dayjs from "dayjs";

const notion = new Client({ auth: process.env.NOTION_KEY });

const databaseId = process.env.NOTION_DATABASE_ID;
const dryRun = process.env.DRY_RUN;

const fetchReadPages = async (startCursor) => {
  try {
    return await notion.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          {
            property: "Read Status",
            select: {
              equals: "Read",
            },
          },
          {
            property: "Read Date",
            date: {
              is_empty: true,
            },
          },
        ],
      },
      sorts: [
        {
          property: "Updated time",
          direction: "descending",
        },
      ],
      start_cursor: startCursor,
      page_size: 100,
    });
  } catch (error) {
    console.error(error.body);
  }
};

const fetchReadPagesRecursively = async (startCursor) => {
  const response = await fetchReadPages(startCursor);

  if (response.has_more) {
    const pages = await fetchReadPagesRecursively(response.next_cursor);
    return response.results.concat(pages);
  } else {
    return response.results;
  }
};

const setLastEditedTimeAsReadDate = async (page) => {
  try {
    await notion.pages.update({
      page_id: page.id,
      properties: {
        "Read Date": {
          date: {
            start: dayjs(page.last_edited_time).format("YYYY-MM-DD"),
          },
        },
      },
    });
  } catch (error) {
    console.error(error.body);
  }
};

(async () => {
  const t0 = performance.now();
  console.log(`${new Date()} Update started.`);

  const pages = await fetchReadPagesRecursively();

  for (let i = 0; i < pages.length; i++) {
    if (dryRun) {
      console.log(pages[i].id);
      continue;
    }

    console.log(`Update page ${i}.`);
    await setLastEditedTimeAsReadDate(pages[i]);
    if (i !== pages.length - 1) {
      await setTimeout(150);
    }
  }

  const t1 = performance.now();
  console.log(
    `${new Date()} ${pages.length} pages updated. Update took ${t1 - t0}ms.`
  );
})();
