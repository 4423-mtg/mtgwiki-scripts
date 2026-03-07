import * as cheerio from "cheerio";
import { writeFileSync } from "node:fs";

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
    getLevel,
} from "./cr.js";

const outdir = "./cr";
function saveFile(filename: string, text: string): void {
    const path = outdir + `/${filename}`;
    if (text.length > 0 && text.at(-1) !== "\n") {
        writeFileSync(path, text + "\n");
    } else {
        writeFileSync(path, text);
    }
    console.log(`> ${path}`);
}

// (1) 日本公式の総合ルールページをfetch
const content = await fetch("https://mtg-jp.com/gameplay/rules/docs/0006836/");
const $ = cheerio.load(await content.text());

// (2) メイン部分のDOMを切り出す
const main = $(
    "body > div#wrap > main > article > div#contents > div.inner > div.reading-main > section > div.detail",
);

// (3) 本文テキスト。1つの段落に\nなどで複数の項番が含まれているのでまず行で分割する
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
saveFile("lines.txt", lines.join("\n"));

// (4) 各行の内容を見て前書き・目次・ルール本文・用語集を判定しつつ段落ごとにまとめる
const items: (HeaderItem | TocItem | BodyItem | DictItem)[] = [];
let mode: "header" | "toc" | "body" | "dict" | "credit" | undefined = "header";

lines.forEach((l) => {
    // 前書き
    if (mode === "header") {
        parseHeader(l);
    }
    // 目次
    if (mode === "toc") {
        parseToc(l);
    }
    // 本文
    if (mode === "body") {
        parseBody(l);
    }
    // 用語集
    if (mode === "dict") {
        parseDict(l);
    }
});

function parseHeader(line: string) {
    if (line === "もくじ") {
        mode = "toc";
        return;
    }
    items.push({ part: "header", text: line });
}
function parseToc(line: string) {
    if (line === "マジック：ザ・ギャザリング　総合ルール") {
        mode = "body";
        return;
    }
    if (line === "もくじ") {
        return;
    }
    items.push({
        part: "toc",
        text: line,
        crNumber: line.match(/^([0-9]+)\.? *(.*)/)?.[1] ?? "",
        noNumberText: line.match(/^([0-9]+)\.? *(.*)/)?.[2] ?? "",
    });
}
function parseBody(line: string) {
    if (line === "用語集") {
        mode = "dict";
        return;
    }
    if (line === "マジック：ザ・ギャザリング　総合ルール") {
        return;
    }
    // 項番付きの行
    if (isNumberedLine(line)) {
        items.push({
            part: "body",
            text: line,
            crNumber: parseCRNumber(line),
            noNumberText: parseTextBody(line),
        });
    } else {
        // 項番のない行は、直前のアイテムがbodyならそれに追加する
        const prevItem = items[items.length - 1];
        if (prevItem !== undefined && prevItem.part === "body") {
            const body = line.replace(/^\s+/, "");
            items[items.length - 1] = {
                part: "body",
                text:
                    prevItem.text.length === 0
                        ? body
                        : prevItem.text.match(/例[:：]\s*$/) !== null
                          ? prevItem.text + body
                          : prevItem.text + "\n" + body,
                crNumber: prevItem.crNumber,
                noNumberText:
                    prevItem.noNumberText.length === 0
                        ? body
                        : prevItem.noNumberText.match(/例[:：]\s*$/) !== null
                          ? prevItem.noNumberText + body
                          : prevItem.noNumberText + "\n" + body,
            };
        } else {
            throw new Error();
        }
    }
}
function parseDict(line: string) {
    if (line === "クレジット") {
        mode = "credit";
        return;
    }
    if (line === "用語集") {
        return;
    }
    // 辞書項目名 末尾がスラッシュ＋英数字なら項目名と判定する
    if (line.match(/／[\x20-\x7E]+$/)) {
        items.push({
            part: "dict",
            text: line,
            itemName: line,
            body: "",
        });
    } else {
        // 説明文の場合は前の行に追加
        const prevItem = items[items.length - 1];
        if (prevItem !== undefined && prevItem.part === "dict") {
            const body = line.replace(/^\s+/, "");
            items[items.length - 1] = {
                part: "dict",
                text:
                    prevItem.text.length > 0
                        ? prevItem.text + "\n" + body
                        : body,
                itemName: prevItem.itemName,
                body:
                    prevItem.body.length > 0
                        ? prevItem.body + "\n" + body
                        : body,
            };
        } else {
            throw new Error();
        }
    }
}

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
                if (itemText !== undefined) {
                    text.push(itemText);
                }
                let tocText = bodyItemToTocText(item);
                if (tocText !== undefined) {
                    toc.push(tocText);
                }
            } else {
                const prevSection = crNumberToSectionNumber(prevItem.crNumber);
                const currentSection = crNumberToSectionNumber(item.crNumber);
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

console.log("hello");

// ==================================================================
