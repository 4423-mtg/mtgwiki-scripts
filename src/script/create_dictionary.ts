import { readFileSync } from "node:fs";
import * as mtgwiki from "../mtgwiki.js";

const path = String.raw`.\data\oracle-cards-20250823211001.json`;
console.log("Reading...");
const oracles: any[] = JSON.parse(readFileSync(path, "utf-8"));
console.log("length=" + oracles.length);

type Card = {
    name: string;
    layout?: string;
    card_faces?: Array<{ name: string }>;
};

// filter into valid cards
const cards: Array<Card> = oracles
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

function convert_to_query(card: Card): string[] {
    if (card?.card_faces === undefined) {
        return [card.name];
    } else if (card.layout !== "split") {
        return card.card_faces.flatMap((f) => convert_to_query(f));
    } else {
        const names = card.card_faces.map((f) => f.name);
        return [names.join("+")];
    }
}

const queries = cards
    .filter((c) => c?.card_faces !== undefined)
    .map((c) => [c?.layout, c.name].concat(convert_to_query(c)));

console.log("");
