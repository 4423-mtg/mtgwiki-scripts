export type { Face, SimpleCard, SimpleFace, Layout, LayoutCategory };
export { layout, layoutCategory, layoutCategoryMap };

type Face = {
    artist: string;
    artist_id: string;
    colors: string[];
    flavor_text: string;
    illustration_id: string;
    image_uris: object;
    mana_cost: string;
    name: string;
    object: string;
    oracle_text: string;
    power?: string;
    toughness?: string;
    type_line: string;
};
type SimpleCard = {
    card_faces?: Face[];
    cmc: number;
    color_identity: string[];
    colors: string[];
    id: string;
    layout: Layout;
    mana_cost: string;
    name: string;
    object: string;
    oracle_text: string;
    power?: string;
    rarity: string;
    set: string;
    set_name: string;
    toughness?: string;
    type_line: string;
};
type SimpleFace = {
    name: string;
    type_line: string;
    oracle_text: string;
    set: string;
};
const layout = [
    "normal", // 31129
    "split", // 134*
    "flip", // 26*
    "transform", // 388*
    "modal_dfc", // 93*
    "meld", // 21 (card_facesは持たない)
    "leveler", // 26
    "class", // 30
    "case", // 15
    "saga", // 154
    "adventure", // 153*
    "mutate", // 34
    "prototype", // 21
    "battle", // 0
    "planar", // 207
    "scheme", // 102
    "vanguard", // 107
    "token", // 873
    "double_faced_token", // 80*
    "emblem", // 85
    "augment", // 14
    "host", // 20
    "art_series", // 1912*
    "reversible_card", // 0
] as const;
type Layout = (typeof layout)[number];
const layoutCategory = [
    "singleface",
    "doubleface",
    "multicharacteristic",
    "deprecated",
] as const;
type LayoutCategory = (typeof layoutCategory)[number];
const layoutCategoryMap: { [key in Layout]: LayoutCategory } = {
    normal: "singleface",
    split: "doubleface",
    flip: "doubleface",
    transform: "doubleface",
    modal_dfc: "doubleface",
    meld: "doubleface",
    leveler: "singleface",
    class: "singleface",
    case: "singleface",
    saga: "singleface",
    adventure: "doubleface",
    mutate: "singleface",
    prototype: "singleface",
    battle: "singleface",
    planar: "singleface",
    scheme: "singleface",
    vanguard: "singleface",
    token: "singleface",
    double_faced_token: "doubleface",
    emblem: "singleface",
    augment: "singleface",
    host: "singleface",
    art_series: "singleface",
    reversible_card: "doubleface",
};
