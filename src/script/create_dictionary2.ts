// // ScryfallからDLしたオラクルカードデータをもとに、

// import * as fs from "node:fs";
// import { setTimeout } from "timers/promises";
// import { type ScryfallCard, type ScryfallCardFace } from "@scryfall/api-types";
// import * as mtgwiki from "../lib/mtgwiki.js";
// import * as scryfall from "../old/scryfall.js";
// import { HTTPError, type DictEntry } from "../types/dict.js";
// import { time } from "node:console";
// import assert, { ok } from "node:assert";
// import { isPlaneCard, isPlaytestCard } from "../lib/scryfall.js";

// const file_oraclecards = "./data/oracle-cards-20250823211001.json";

// main();

// /** オラクルカードデータをベースにmtgwikiから日本語名を取得して日本語名辞書を作る。
//  * 日本語名キャッシュ(2025/09/20)も使う。
//  */
// async function main() {
//     // カードデータのロード
//     const cards = load_oraclecards();
//     // 日本語名の取得済みキャッシュをロード
//     const jpnames_cache: { [key: string]: string } = JSON.parse(
//         fs.readFileSync("./data/jpname_20250920.json", "utf-8"),
//     );
//     const jpnames: DictEntry[] = [];

//     let count = 0;
//     // 有効なカードについて走査
//     // for (const card of cards.filter((c) => scryfall.isValidCard(c))) {
//     for (const card of cards) {
//         // console.log(`> "${card.name}"`);
//         // カード名(複数の場合あり)を取得
//         const names = get_cardnames(card);

//         // 日本語名キャッシュから日本語名を取得
//         const caches = names.map((n) =>
//             jpnames_cache[n] !== undefined && jpnames_cache[n] !== "undefined"
//                 ? ({
//                       name: n,
//                       jpname: jpnames_cache[n],
//                       info: undefined, // 日本語名に関する追加情報。主にundefinedの理由を入れる
//                   } satisfies DictEntry as DictEntry)
//                 : undefined,
//         );
//         // 日本語名があるか、またはそもそも存在しない場合
//         if (
//             caches.every((c) => c !== undefined) &&
//             caches.every(
//                 (c) => c.jpname !== "undefined" || c.info === "nojpname",
//             )
//         ) {
//             // 日本語名キャッシュを使う
//             caches.forEach((c) => jpnames.push(c));
//             ++count;
//             // すべて保存
//             fs.writeFileSync("./data/jpname.json", stringify_entries(jpnames));
//         } else {
//             // キャッシュがなければ取得する
//             if (false && count !== 0) {
//                 console.log(`${count} cards are cached`);
//                 count = 0;
//             }
//             let entries: DictEntry[] = [];
//             try {
//                 // mtgwikiから日本語名を取得する
//                 entries = await get_dict_entries(card, {
//                     playtest: isPlaytestCard(card),
//                     plane: isPlaneCard(card),
//                 });
//                 // 追加
//                 jpnames.push(
//                     ...entries.map((e) => ({
//                         name: e.name,
//                         jpname: e.jpname ?? "undefined",
//                         info: e.info,
//                     })),
//                 );
//                 // ログ
//                 entries.forEach((e, i) =>
//                     console.log(
//                         `>> "${card.name}": [${i}]: ${JSON.stringify(e)}`,
//                     ),
//                 );
//                 // すべて保存
//                 fs.writeFileSync(
//                     "./data/jpname.json",
//                     stringify_entries(jpnames),
//                 );
//             } catch (e) {
//                 // エラー処理
//                 console.error(`>> "${card.name}": ${e}`);
//                 entries = [
//                     {
//                         name: get_primal_name(card) ?? "undefined",
//                         jpname: "undefined",
//                         info: "error",
//                     },
//                 ];
//                 // 追加
//                 jpnames.push(
//                     ...entries.map((e) => ({
//                         name: e.name,
//                         jpname: e.jpname ?? "undefined",
//                         info: e.info,
//                     })),
//                 );
//                 // ログ
//                 entries.forEach((e, i) =>
//                     console.log(
//                         `>> "${card.name}": [${i}]: ${JSON.stringify(e)}`,
//                     ),
//                 );
//                 // すべて保存
//                 fs.writeFileSync(
//                     "./data/jpname.json",
//                     stringify_entries(jpnames),
//                 );

//                 // 通信エラー時
//                 if (e instanceof HTTPError) {
//                     const minute = 5;
//                     console.info(`(Suspended ${minute} minutes...)`);
//                     await setTimeout(1000 * 60 * minute); // 403は5分待ち
//                 }
//             }
//         }
//     }
// }

// /** ScryfallのBulk Dataから取得した oracle-cards-YYYYMMDDxxxxxx.json を読み込んでカードデータを返す */
// function load_oraclecards(): ScryfallCard.Any[] {
//     const text = fs.readFileSync(file_oraclecards, "utf-8");
//     const oracles: ScryfallCard.Any[] = JSON.parse(text);
//     return oracles;
// }

// /** JSON化 */
// function stringify_entries(entries: DictEntry[]): string {
//     let ret = "[\n";
//     entries.forEach(
//         (e, i) =>
//             (ret +=
//                 "  " +
//                 JSON.stringify(e) +
//                 (i < entries.length - 1 ? "," : "") +
//                 "\n"),
//     );
//     ret += "]\n";
//     return ret;
// }

// /** 分割カードの日本語名を取るのにまず各半分の英語名が必要。 */
// function get_primal_name(
//     card: ScryfallCard.Any | ScryfallCardFace.Any,
// ): string | undefined {
//     return get_cardnames(card)[0];
// }

// /** そのカードの中にある、日本語名を取りたいカード名。 */
// export function get_cardnames(
//     card: ScryfallCard.Any | ScryfallCardFace.Any,
// ): string[] {
//     if ("card_faces" in card) {
//         const faces: string[] = card.card_faces.map((f) => f.name);
//         if (card.layout === "split") {
//             return [mtgwiki.get_splitcard_name(faces)].concat(faces);
//         } else {
//             return faces;
//         }
//     } else {
//         return [card.name];
//     }
// }

// /** mtgwikiから日本語名を取得する */
// async function get_dict_entries(
//     card: ScryfallCard.Any | ScryfallCardFace.Any,
//     option?: { playtest?: boolean; plane?: boolean },
// ): Promise<DictEntry[]> {
//     const interval = 5000;

//     if ("card_faces" in card) {
//         // multiface
//         if (card.layout == "split") {
//             // split
//             // 全体としてのentry
//             const name = mtgwiki.get_splitcard_name(
//                 card.card_faces
//                     .map((f) => get_primal_name(f))
//                     .filter((n) => n !== undefined),
//             );
//             await setTimeout(interval);
//             const entry_all = await mtgwiki.get_jpname2(name, {
//                 playtest: isPlaytestCard(card),
//                 plane: isPlaneCard(card),
//             });
//             // 各半分のentries
//             let entries_of_each_half: DictEntry[][] = [];
//             if (entry_all.jpname === undefined) {
//                 for (const f of card.card_faces) {
//                     entries_of_each_half.push(await get_dict_entries(f));
//                 }
//             } else {
//                 const a = mtgwiki.get_splitcard_name_inverse(entry_all.jpname);
//                 if (a.length == card.card_faces.length) {
//                     for (let i = 0; i < card.card_faces.length; i++) {
//                         const f = card.card_faces[i];
//                         assert(f !== undefined);
//                         const f_primalname = get_primal_name(f);
//                         let entries: DictEntry[] = [];

//                         if (f_primalname !== undefined) {
//                             entries.push({
//                                 name: f_primalname,
//                                 jpname: a[i],
//                                 info: entry_all.info,
//                             });
//                         }
//                         entries.push(
//                             ...(await get_dict_entries(f)).filter(
//                                 (e) => e.name !== f_primalname,
//                             ),
//                         );
//                         entries_of_each_half[i] = entries;
//                     }
//                 } else {
//                     throw Error(
//                         "分割カードの日本語名の数が英語名の数と一致していません。",
//                     );
//                 }
//             }

//             return [entry_all].concat(...entries_of_each_half);
//         } else {
//             // other multiface card
//             const entries_of_each_face: DictEntry[][] = [];
//             for (const face of card.card_faces) {
//                 await setTimeout(interval);
//                 entries_of_each_face.push(await get_dict_entries(face, option));
//             }
//             return entries_of_each_face.flat();
//         }
//     } else {
//         // singleface & Face
//         await setTimeout(interval);
//         return [await mtgwiki.get_jpname2(card.name, option)];
//     }
// }
