import { readFileSync } from "node:fs";
// import { type ScryfallCard } from "@scryfall/api-types";
import { type Face, type SimpleFace, layout } from "./types/card.js";

const path = String.raw`.\data\oracle-cards-20250823211001.json`;

// カード一覧
console.log("Reading...");
const oracles: any[] = JSON.parse(readFileSync(path, "utf-8"));
console.log("length=" + oracles.length);

// check
const check1: { [key in string]: any } = Object.fromEntries(
    layout.map((l) => [
        l,
        {
            multipleFaces: oracles
                .filter((c) => c.layout == l && "card_faces" in c)
                .map((c) => ({
                    name: c.name,
                    set: c.set_name,
                    type_line: c.type_line,
                })),
        },
    ])
);

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

// convert to faces
const faces: SimpleFace[] = [];
cards.forEach((c) => {
    // meldはcard_facesはなく、合体後が別で登録されている。
    // 合体前と合体後を区別する方法はない気がする。
    if (c?.card_faces === undefined || c.layout == "split") {
        faces.push({
            name: c.name,
            type_line: c.type_line,
            oracle_text: c.oracle_text,
            set: c.set_name,
        });
    } else {
        c.card_faces.forEach((f: Face) => {
            faces.push({
                name: f.name,
                type_line: f.type_line,
                oracle_text: f.oracle_text,
                set: c.set_name,
            });
        });
    }
});

// sort
function countAlphanumeric(str: string): number {
    const matches = str.match(/[A-Za-z0-9]/g);
    return matches ? matches.length : 0;
}
const face_sorted = faces
    .map((f) => ({
        name: f.name,
        value: countAlphanumeric(f.name),
        set: f.set,
        obj: f,
    }))
    .sort((a, b) => a.value - b.value);

const face_sorted_head = face_sorted.slice(0, 50);
const face_sorted_tail = face_sorted.slice(-50).toReversed();

console.log("ok");
