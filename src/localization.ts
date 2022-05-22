var pinyin = require("chinese-to-pinyin")

export class Language{
    val: string;
    label: string;
    static readonly chinese = new Language('zh','Chinese');
    static readonly english = new Language('en-us','English');

    private constructor(val:string,label:string){
        this.val= val;
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
    [english.val,english],
    [chinese.val,chinese]
]);
export const languageList = Array.from(countryCodeMap.values());

export function setSource(lang:Language){
    srcLanguage = lang;
}
export function setTarget(lang:Language){
    tarLanguage = lang;
}

export function speaking(){
    switch(srcLanguage){
        case chinese:
            return '正在説話中';
        case english:
            return 'is speaking';
    }
}

export function transcript(username:string|undefined, transcript: string){
    if(srcLanguage === chinese){
        transcript += `> \n__${username}__: ${pinyin(transcript)}`
    }
    return `> __${username}__: ${transcript}`; 
}

export function response(username:string|undefined, tscript:string, translation:string){
    if(tarLanguage===chinese){
        translation += `\n__${username}__: ${pinyin(translation)}`
    }
    return transcript(username,tscript)+`\n__${username}__: ${translation}`;
}