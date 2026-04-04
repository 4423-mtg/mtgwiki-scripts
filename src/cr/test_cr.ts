import * as cheerio from "cheerio";
import { mkdirSync, writeFileSync } from "node:fs";

import {
    BodyItem,
    bodyItemToText,
    crNumberToSectionNumber,
    DictItem,
    HeaderItem,
    isNumberedLine,
    parseCRNumber,
    parseTextBody,
    bodyItemToTocText,
    TocItem,
} from "./cr.js";

// console.log(`process.argv=[${process.argv.join(", ")}]`);
const argv2 = process.argv[2];
const outdir = argv2 === undefined || argv2 === "" ? "./data/cr" : argv2;
console.log(`ourdir=${outdir}`);

function saveFile(filename: string, text: string): void {
    const path = outdir + `/${filename}`;
    mkdirSync(outdir, { recursive: true });
    if (text.length > 0 && text.at(-1) !== "\n") {
        writeFileSync(path, text + "\n");
    } else {
        writeFileSync(path, text);
    }
    console.log(`=> ${path}`);
}
type Mode = "header" | "toc" | "body" | "dict" | "credit" | undefined;

// MARK: main
async function main() {
    // (1) 日本公式の総合ルールページをfetch
    const url = "https://mtg-jp.com/gameplay/rules/docs/0006836/";
    console.log(`Fetching from ${url}`);

    const content = await fetch(url);
    const $ = cheerio.load(await content.text());

    // (2) メイン部分のDOMを切り出す
    console.info("Processing DOM...");
    const main = $(
        "body > div#wrap > main > article > div#contents > div.inner > div.reading-main > section > div.detail",
    );

    // (3) 本文テキスト。1つの段落に\nなどで複数の項番が含まれているのでまず行で分割する
    console.info("Parsing into lines...");
    const lines: string[] = [];
    main.children().each((i, e) => {
        if (e.type !== "style") {
            lines.push(
                ...$(e)
                    .text()
                    .split(/\n/g)
                    .filter((p) => p !== "")
                    .filter((p) => p.match(/^\s+$/) === null),
            );
        }
    });
    console.info(`  => ${lines.length} lines`);
    saveFile("lines.txt", lines.join("\n"));

    // MARK: main/parse
    // (4) 各行の内容を見て前書き・目次・ルール本文・用語集を判定しつつ段落ごとにまとめる
    const items: (HeaderItem | TocItem | BodyItem | DictItem)[] = [];
    let mode: Mode = "header";

    lines.forEach((l) => {
        // モード切替
        if (l === "もくじ") {
            mode = "toc";
        }
        if (l === "マジック：ザ・ギャザリング　総合ルール") {
            mode = "body";
        }
        if (l === "用語集") {
            mode = "dict";
        }
        if (l === "クレジット") {
            mode = "credit";
        }
        // 前書き
        if (mode === "header") {
            items.push(parseAsHeader(l));
        }
        // 目次
        if (mode === "toc") {
            const parsed = parseAsToc(l);
            if (parsed !== undefined) {
                items.push(parsed);
            } else {
                throw new Error(`Parse error: ${l}`);
            }
        }
        // 本文
        if (mode === "body") {
            const parsed = parseAsBody(l);
            // 項番がある行
            if (typeof parsed === "object") {
                items.push(parsed);
            }
            // 項番がない行
            else if (typeof parsed === "string") {
                const prevItem = items.at(-1);
                // 前の行が BodyItem ならそれに追加する
                if (prevItem !== undefined && prevItem.part === "body") {
                    if (prevItem.text.length === 0) {
                        prevItem.text = parsed;
                        prevItem.noNumberText = parsed;
                    }
                    // 前の行が "例：" で終わる場合は改行なしで追加する
                    else if (prevItem.text.match(/例[:：]\s*$/) !== null) {
                        prevItem.text += parsed;
                        prevItem.noNumberText += parsed;
                    }
                    // 改行付きで追加する
                    else {
                        prevItem.text += "\n" + parsed;
                        prevItem.noNumberText += "\n" + parsed;
                    }
                }
                // 前の行が BodyItem でないならエラー
                else {
                    throw new Error();
                }
            } else {
                throw new Error(`Parse error: ${l}`);
            }
        }
        // 用語集
        if (mode === "dict") {
            const parsed = parseAsDict(l);
            // 用語名の行
            if (typeof parsed === "object") {
                items.push(parsed);
            }
            // 説明の行
            else if (typeof parsed === "string") {
                const prev = items.at(-1);
                // 前の行が DictItem ならそれに追加する
                if (prev !== undefined && prev.part === "dict") {
                    prev.text = (prev.text.length > 0 ? "\n" : "") + parsed;
                    prev.body = (prev.body.length > 0 ? "\n" : "") + parsed;
                } else {
                    throw new Error();
                }
            } else {
                throw new Error(`Parse error: ${l}`);
            }
        }
    });

    // MARK: main/toText
    // (5) テキスト化
    let text: string[] = [];
    let toc: string[] = [];
    const notice = [
        "このページの内容は、[https://mtg-jp.com/gameplay/rules マジック日本公式サイト]に掲載されているマジック総合ルール（和訳 20260116.0 版）を転記したものです。最新の総合ルールは公式サイトを参照してください。",
        "----",
    ].join("\n");

    items.forEach((item, i) => {
        const prevItem = items[i - 1];
        switch (item.part) {
            case "header":
                text.push(item.text);
                break;
            case "toc":
                if (items[i - 1]?.part === "header") {
                    // header.txt
                    saveFile(
                        "header.txt",
                        [notice, "", ...text, "", "__NOTOC__"].join("\n"),
                    );
                    text = [];
                }
                text.push(item.text);
                break;
            case "body":
                // toc.txt
                if (items[i - 1]?.part === "toc") {
                    saveFile(
                        "toc.txt",
                        [notice, "", ...text, "", "__NOTOC__"].join("\n"),
                    );
                    text = [];
                }
                // body
                if (prevItem?.part !== "body") {
                    // bodyの最初の行 (0. はじめに)
                    let itemText = bodyItemToText(item);
                    text.push(itemText);
                    let tocText = bodyItemToTocText(item);
                    if (tocText !== undefined) {
                        toc.push(tocText);
                    }
                } else {
                    const prevSection = crNumberToSectionNumber(
                        prevItem.crNumber,
                    );
                    const currentSection = crNumberToSectionNumber(
                        item.crNumber,
                    );
                    if (
                        prevSection !== undefined &&
                        currentSection !== undefined &&
                        prevSection !== currentSection
                    ) {
                        // 新しいセクション (bodyはセクションごとにファイルを切り分ける)
                        // FIXME: セクションを辞書にして一括で出力する
                        // ${major[0]}.txt
                        saveFile(
                            `${prevSection}.txt`,
                            [
                                notice,
                                "",
                                ...toc,
                                "",
                                "----",
                                "",
                                ...text,
                                "",
                                "__NOTOC__",
                            ].join("\n"),
                        );
                        text = [];
                        toc = [];
                    }
                    let itemText = bodyItemToText(item);
                    if (itemText !== undefined) {
                        text.push(itemText);
                    }
                    let tocText = bodyItemToTocText(item);
                    if (tocText !== undefined) {
                        toc.push(tocText);
                    }
                }
                break;
            case "dict":
                // toc.txt
                if (prevItem !== undefined && prevItem.part === "body") {
                    const prevSection = prevItem.crNumber.major?.at(0);
                    if (prevSection === undefined) {
                        throw new Error();
                    }
                    saveFile(
                        `${prevSection}.txt`,
                        [notice, "", ...toc, "", ...text, "", "__NOTOC__"].join(
                            "\n",
                        ),
                    );
                    text = [];
                }
                text.push("=" + item.itemName + "=");
                text.push(item.body + "\n");
                break;
            default:
                break;
        }
    });
    saveFile("dict.txt", [notice, "", ...text, "", "__NOTOC__"].join("\n"));

    console.log("ok");
}

// MARK: parseAsHeader
/** まえがき */
function parseAsHeader(line: string): HeaderItem {
    return { part: "header", text: line };
}

// MARK: parseAsToc
/** 目次 */
function parseAsToc(line: string): TocItem | undefined {
    if (line === "もくじ") {
        return undefined;
    }
    return {
        part: "toc",
        text: line,
        crNumber: line.match(/^([0-9]+)\.? *(.*)/)?.[1] ?? "",
        noNumberText: line.match(/^([0-9]+)\.? *(.*)/)?.[2] ?? "",
    };
}

// MARK: parseAsBody
/** 項番行をパース */
function parseAsBody(line: string): BodyItem | string | undefined {
    if (line === "マジック：ザ・ギャザリング　総合ルール") {
        return undefined;
    }
    // 項番付きの行
    if (isNumberedLine(line)) {
        return {
            part: "body",
            text: line,
            crNumber: parseCRNumber(line),
            noNumberText: parseTextBody(line),
        } as const;
    } else {
        // 項番のない行
        const body = line.replace(/^\s+/, "");
        return body;
    }
}

// MARK: parseAsDict
/** 辞書行をパース */
function parseAsDict(line: string): DictItem | string | undefined {
    if (line === "用語集") {
        return undefined;
    }
    // 辞書項目名 末尾がスラッシュ＋英数字なら項目名と判定する
    if (line.match(/／[\x20-\x7E]+$/)) {
        return {
            part: "dict",
            text: line,
            itemName: line,
            body: "",
        };
    } else {
        // 説明文の場合は前の行に追加
        const body = line.replace(/^\s+/, "");
        return body;
    }
}

// ==================================================================
main();
