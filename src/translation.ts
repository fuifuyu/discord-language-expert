import * as deepl from 'deepl-node'
import { SourceLanguageCode, TargetLanguageCode } from 'deepl-node';
import * as locale from './localization';

const translator = new deepl.Translator(process.env.DEEPL_TOKEN!);
export async function translate(text:string){
    try{
        const result = await translator.translateText(
            text,
            locale.srcLanguage.val as SourceLanguageCode,
            locale.tarLanguage.val as TargetLanguageCode
        );
        return result.text;
    } catch(e){
        console.error(e);
        return '';
    }
}