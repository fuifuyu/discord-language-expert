import * as deepl from 'deepl-node'
import { SourceLanguageCode, TargetLanguageCode } from 'deepl-node';
import * as locale from './localization';

const translator = new deepl.Translator(process.env.DEEPL_TOKEN!);
export async function translate(text:string){
    try{
        let src = locale.srcLanguage.code;
        let tar = locale.tarLanguage.code;
        if(locale.tarLanguage.code==='en'){
            tar = 'en-us';
        }
        const result = await translator.translateText(
            text,
            src as SourceLanguageCode,
            tar as TargetLanguageCode
        );
        return result.text;
    } catch(e){
        console.error(e);
        return '';
    }
}