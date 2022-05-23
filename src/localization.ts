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

export function speaking(){
    switch(srcLanguage){
        case chinese:
            return '正在説話中';
        case english:
            return 'is speaking';
    }
}

export function transcript(username:string|undefined, transcription: string){
    if(srcLanguage === chinese){
        transcription += `\n> __${username}__: ${pinyin(transcription)}`
    }
    return `> __${username}__: ${transcription}`; 
}

export function translate(username:string|undefined, translation: string){
    if(tarLanguage === chinese){
        translation += `\n__${username}__: ${pinyin(translation)}`
    }
    return `__${username}__: ${translation}`;
}

export function response(username:string|undefined, transcription:string, translation:string){
    if(srcLanguage === tarLanguage){
        return transcript(username, transcription);
    }
    return transcript(username,transcription)+'\n'+translate(username,translation);
}