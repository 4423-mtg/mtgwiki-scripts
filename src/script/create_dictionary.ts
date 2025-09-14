import { readFileSync } from "node:fs";
import * as mtgwiki from "../mtgwiki.js";
import { setTimeout } from "node:timers/promises";

type Card = {
    name: string;
    layout: string;
    card_faces?: Array<{ name: string }>;
    type_line: string;
    set_name: string;
};

const path = String.raw`.\data\oracle-cards-20250823211001.json`;
console.log("Reading...");
const oracles: Card[] = JSON.parse(readFileSync(path, "utf-8"));
console.log("length=" + oracles.length);

// filter into valid cards
const cards = oracles
    .filter(
        (c) =>
            ![
                "art_series",
                "double_faced_token",
                "emblem",
                "reversible_card",
                "token",
            ].includes(c.layout)
    )
    .filter((c) => c.type_line !== "Card")
    .filter((c) => c.set_name !== "Unknown Event");

// 代表名前
function primal_name(card: {
    name: string;
    layout?: string;
    card_faces?: Array<{ name: string }>;
}): string | undefined {
    if (card?.card_faces === undefined) {
        return card.name;
    } else if (card?.layout == "split") {
        return card.card_faces.map((f) => primal_name(f)).join("+");
    } else {
        return card.card_faces[0]?.name;
    }
}
// extract query name
function convert_to_query(card: Card | { name: string }): string[] {
    if (!("card_faces" in card)) {
        return [card.name];
    } else if ("layout" in card && card?.layout === "split") {
        // 分割カード
        return [
            primal_name(card),
            ...card.card_faces.flatMap((f) => convert_to_query(f)),
        ].filter((n) => n !== undefined);
    } else {
        // 分割カード以外（反転・両面・出来事）
        return card.card_faces.flatMap((f) => convert_to_query(f));
    }
}

const queries: string[] = cards.flatMap((c) => convert_to_query(c));

const jpnames: Array<string> = [];
// get jpname
for (let i = 0; i < 10 && i < queries.length; i++) {
    const jpn = await mtgwiki.get_jpname(queries[i] as string);
    if (jpn !== undefined) {
        jpnames.push(jpn);
    }
    console.log("> " + queries[i] + " => " + jpn);
    await setTimeout(1000);
}

console.log("end");
