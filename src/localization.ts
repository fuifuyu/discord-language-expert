var pinyin = require("chinese-to-pinyin")

export class Language{
    code: string;
    label: string;
    static readonly chinese = new Language('zh','Chinese');
    static readonly english = new Language('en','English');

    private constructor(val:string,label:string){
        this.code= val;
        this.label = label;
    }
    public toString(){
        return this.label;
    }
}

export const chinese = Language.chinese;
export const english = Language.english;
export let srcLanguage = english;
export let tarLanguage = chinese;

export const countryCodeMap = new Map<string,Language>([
    [english.code,english],
    [chinese.code,chinese]
]);
export const languageList = Array.from(countryCodeMap.values());

export function setSource(lang:Language){
    srcLanguage = lang;
}

export function setTarget(lang:Language){
    tarLanguage = lang;
}

export function romaji(text: string, lang: Language){
    if(lang === chinese){
        return pinyin(text);
    }
    return '\u200b';
}