import * as fs from "node:fs";
import * as mtgwiki from "../mtgwiki.js";
import { setTimeout } from "node:timers/promises";
import { type ScryfallCard } from "@scryfall/api-types";

type Card = {
    name: string;
    layout: string;
    card_faces?: Array<{ name: string }>;
    type_line: string;
    set_name: string;
};

// カードデータ
const path = String.raw`.\data\oracle-cards-20250823211001.json`;
console.log("Reading...");
const oracles: ScryfallCard.Any[] = JSON.parse(fs.readFileSync(path, "utf-8"));
console.log("length=" + oracles.length);

// 対象外のカードを除外
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
fs.writeFileSync("./data/query.json", JSON.stringify(queries, null, 2));

// jpname.jsonを読み込む。なければ作る
const path_jpname = "./data/jpname.json";
let jpnames: {
    [k: string]: string | undefined;
};
if (!fs.existsSync(path_jpname)) {
    jpnames = Object.fromEntries(queries.map((q) => [q, ""]));
    fs.writeFileSync(path_jpname, JSON.stringify(jpnames, null, 2));
}
jpnames = JSON.parse(fs.readFileSync(path_jpname, "utf-8"));

// get jpname
for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    if (
        q !== undefined &&
        (!(q in jpnames) || jpnames[q] === "" || jpnames[q] === "undefined")
    ) {
        let jpn;
        try {
            jpn = await mtgwiki.get_jpname(q);
        } catch (error) {
            console.log(
                "> [" +
                    new Date().toLocaleString() +
                    "] " +
                    queries[i] +
                    ": fetch error"
            );
            continue;
        }
        jpnames[q] = jpn !== undefined ? jpn : "undefined";
        console.log(
            "> [" +
                new Date().toLocaleString() +
                "] " +
                queries[i] +
                " => " +
                jpn
        );
        fs.writeFileSync(
            "./data/jpname.json",
            JSON.stringify(jpnames, null, 2)
        );
        await setTimeout(3000);
    }
}

console.log("end");
