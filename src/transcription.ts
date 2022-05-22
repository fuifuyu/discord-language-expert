import { VC_SAMPLE_RATE } from "./audio";
import * as locale from "./localization";
const vosk = require('vosk');
import fs from "fs";

const VOSK_ROOT_PATH = "./models/vosk"

interface LanguageModel{
    voskRecognizer?: any;
}

//Check if all vosk model is downloaded
locale.languageList.forEach((lang)=>{
    if(!fs.existsSync(`${VOSK_ROOT_PATH}/${lang.val}`)){
        console.error(`Please download the model from https://alphacephei.com/vosk/models 
        and unpack it as ${VOSK_ROOT_PATH}/${lang.val}`);
        process.exit();
    }
})

const modelMap = new Map<locale.Language,LanguageModel>();

export async function loadModels(){
    await Promise.all(locale.languageList.map(
        async val => {
            modelMap.set(val,{voskRecognizer:new vosk.Recognizer({
            model: new vosk.Model(`${VOSK_ROOT_PATH}/${val.val}`), sampleRate: VC_SAMPLE_RATE
        })})}
    ))
}

export function transcriptor(buffer:Buffer){
    const recognizer = modelMap.get(locale.srcLanguage)!.voskRecognizer;
    recognizer.acceptWaveform(buffer);
    return recognizer.finalResult().text;
}