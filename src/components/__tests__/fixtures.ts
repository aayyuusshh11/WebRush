import {
  assembleArchive,
  at,
  makeMeta,
  music,
  purchase,
  ledger,
} from "../../engine/__tests__/fixtures";
import type { Archive } from "../../data/dataset";
import type { LifeReceipt } from "../../engine/types";

/**
 * A small hand-built archive with every connection type represented:
 * a listening session, a track echo, same-day money, a repeating merchant
 * and city/category context. June 2023.
 */
export function threadArchive(): Archive {
  const base = at(2023, 6, 10, 22);
  return assembleArchive(
    [
      music({ id: "m-0", ts: base, title: "Echo Track", subtitle: "The Repeat Artist" }),
      music({ id: "m-1", ts: base + 10 * 60, title: "Other Track", subtitle: "The Repeat Artist" }),
      music({ id: "m-2", ts: base + 20 * 60, title: "Third Track", subtitle: "Someone Else" }),
      music({ id: "m-3", ts: base + 5 * 86400, title: "Echo Track", subtitle: "The Repeat Artist" }),
      purchase({
        id: "c-0", ts: base + 30 * 60, title: "Swiggy", category: "food_dining",
        city: "Mumbai", state: "Maharashtra", amount: 340,
      }),
      purchase({
        id: "c-1", ts: base + 12 * 86400, title: "Swiggy", category: "food_dining",
        city: "Mumbai", state: "Maharashtra", amount: 280,
      }),
      purchase({
        id: "c-2", ts: base + 2 * 86400, title: "Big Bazaar", category: "groceries",
        city: "Mumbai", state: "Maharashtra", amount: 1200,
      }),
      ledger({ id: "l-0", ts: base + 60 * 60, title: "Auto fare", subcategory: "auto", amount: 60 }),
    ],
    makeMeta(),
  );
}

/** 70 receipts across 70 days — enough to exercise pagination. */
export function bigArchive(): Archive {
  const base = at(2023, 1, 1, 12);
  const receipts: LifeReceipt[] = [];
  for (let i = 0; i < 70; i++) {
    receipts.push(
      music({ id: `m-b${i}`, ts: base + i * 86400, title: `Day Song ${i}`, subtitle: "Artist" }),
    );
  }
  return assembleArchive(receipts, makeMeta());
}

export { at, makeMeta, music, purchase, ledger, assembleArchive };
