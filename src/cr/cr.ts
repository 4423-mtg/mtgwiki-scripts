/** 項番行の頭から項番をキャプチャする */
export function parseNumberedLine(line: string): {
    crNumber: CRNumber;
    text: string;
} {
    const ptn =
        /^(?<major>[0-9]+)(\.((?<minor>[0-9]+)(\.|(?<patch>[a-z]))?)?)?\s*(?<text>.*)/;
    const match = line.match(ptn);

    if (match === null) {
        return {
            crNumber: { major: undefined, minor: undefined, patch: undefined },
            text: line,
        };
    } else {
        const major = match.groups?.["major"];
        const minor = match.groups?.["minor"];
        const patch = match.groups?.["patch"];
        const text = match.groups?.["text"];
        if (text === undefined) {
            throw new Error();
        }
        return {
            crNumber: {
                major: major,
                minor: minor,
                patch: patch,
            },
            text: text,
        };
    }
}

// =======================================================
/** CR番号 */
export type CRNumber = {
    major: string | undefined;
    minor: string | undefined;
    patch: string | undefined;
};

/** CR番号の階層レベル。\
 * (`undefined`, `undefined`, `undefined`) => `undefined` \
 * (`"1"`, `undefined`, `undefined`) => `1` \
 * (`"101"`, `undefined`, `undefined`) => `2` \
 * (`"101"`, `"2"`, `undefined`) => `3` \
 * (`"101"`, `"2"`, `"a"`) => `4`
 */
export function getLevel(crNumber: CRNumber): number | undefined {
    const major = crNumber.major;
    const minor = crNumber.minor;
    const patch = crNumber.patch;
    if (major === undefined) {
        return undefined;
    } else if (minor === undefined) {
        return major.length === 1 ? 1 : 2;
    } else if (patch === undefined) {
        return 3;
    } else {
        return 4;
    }
}

/** CR番号から文字列に変換する */
export function crNumberToString(crNumber: CRNumber): string {
    let str = "";
    str += crNumber.major ? crNumber.major.toString() : "";
    str += crNumber.minor ? "." + crNumber.minor.toString() : "";
    str += crNumber.patch ? crNumber.patch.toString() : "";
    return str;
}

/** CR番号からセクション番号を取得 */
export function crNumberToSectionNumber(
    crNumber: CRNumber,
): string | undefined {
    return crNumber.major?.at(0);
}

// =======================================================
/** 前書きの項目 */
export type HeaderItem = { part: "header"; text: string };
/** 目次の項目 */
export type TocItem = {
    part: "toc";
    text: string;
    crNumber: string;
    noNumberText: string;
};
/** 本文の項目 */
export type BodyItem = {
    part: "body";
    text: string;
    crNumber: CRNumber;
    noNumberText: string;
};
/** 用語集の項目 */
export type DictItem = {
    part: "dict";
    text: string;
    itemName: string;
    body: string;
};

/** 本文の項目をテキストに変換する */
export function bodyItemToText(item: BodyItem): string {
    if (
        item.crNumber.major !== undefined &&
        parseInt(item.crNumber.major) < 100
    ) {
        // 一番大きいレベル (0, 1, 2, ..., 9)
        // return `<!-- ${item.text} -->`;
        return item.text;
    } else {
        let ret = "";
        const level = getLevel(item.crNumber);
        const headingMark = level !== undefined ? "=".repeat(level - 1) : "";
        if (level === 2) {
            ret += "\n";
        }
        ret += headingMark;
        // ret += '<span style="color:blue;">';
        ret += crNumberToString(item.crNumber);
        // ret += "</span>";
        ret += headingMark;
        ret += "\n";
        ret += item.noNumberText
            // rule 103.2a-e
            .replaceAll(
                /\brule ([0-9]+(\.[0-9]+([a-z](-[a-z])?)?)?)\.?/g,
                (match, p1: string, p2, p3, p4: string | undefined) => {
                    const crNumber = p1;
                    const range = p4;
                    return crNumber.length === 1
                        ? `[[総合ルール/${crNumber}|${match}]]`
                        : range === undefined
                          ? `[[総合ルール/${crNumber[0]}#${crNumber}|${match}]]`
                          : `[[総合ルール/${crNumber[0]}#${crNumber.slice(0, crNumber.length - range.length)}|${match}]]`;
                },
            )
            .replaceAll(/\n/g, "\n\n");
        return ret;
    }
}
/** 項番を各ページの目次に追加 */
export function bodyItemToTocText(item: BodyItem): string | undefined {
    const level = getLevel(item.crNumber);

    switch (level) {
        case 1:
            return "*" + `[[#${crNumberToString(item.crNumber)}|${item.text}]]`;
        case 2:
            return (
                (item.crNumber.major !== undefined &&
                item.crNumber.major.length < 3
                    ? "*"
                    : "**") +
                `[[#${crNumberToString(item.crNumber)}|${item.text}]]`
            );
        case 3:
            if (
                item.crNumber.major === "701" ||
                item.crNumber.major === "702"
            ) {
                return (
                    "***" +
                    (item.crNumber.minor !== "1"
                        ? `[[#${crNumberToString(item.crNumber)}|${item.text}]]`
                        : `[[#${crNumberToString(item.crNumber)}|${crNumberToString(item.crNumber)}]]`)
                );
            }
            break;
        case 4:
            break;
        case undefined:
            break;
        default:
            break;
    }
    return undefined;
}
