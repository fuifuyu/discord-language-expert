import { SlashCommandBooleanOption, SlashCommandIntegerOption, SlashCommandStringOption, SlashCommandUserOption } from '@discordjs/builders';
import { DiscordGatewayAdapterCreator, EndBehaviorType, getVoiceConnection, joinVoiceChannel } from '@discordjs/voice';
import { CommandInteraction, GuildMember, MessageActionRow, MessageSelectMenu, TextChannel, ThreadChannel} from 'discord.js'
import * as locale from './localization';
import prism from 'prism-media';
import { processVCAudio, VC_SAMPLE_RATE } from './audio';
import { transcriptor } from './transcription';
import axios from 'axios';
import { translate } from './translation';

interface Command{
    desc: string;
    callback: (interaction: CommandInteraction, user: GuildMember, bot: GuildMember)=>void;
    option?: (SlashCommandStringOption|SlashCommandIntegerOption|SlashCommandUserOption|SlashCommandBooleanOption)[];
}

let Commands = new Map<string,Command>([
    ['join', {
        desc: 'Start translation session!',
        callback: join,
        option: [
            locale.languageList.reduce(
                (prev,cur)=> prev.addChoices({name:cur.label,value:cur.val}
            ),
            new SlashCommandStringOption()
                .setName('language')
                .setDescription('What language do you need help with?')),
            locale.languageList.reduce(
                (prev,cur)=> prev.addChoices({name:cur.label,value:cur.val}
            ),
            new SlashCommandStringOption()
                .setName('translation')
                .setDescription('What language are you familiar with?'))
        ]
    }],
    ['leave',{
        desc:'Stop translation session!',
        callback: leave
    }],
    ['change-language',{
        desc: 'Change speaking language',
        callback: changeLang,
        option: [
            locale.languageList.reduce(
                (prev,cur)=> prev.addChoices({name:cur.label,value:cur.val}
            ),
            new SlashCommandStringOption()
                .setName('language')
                .setDescription('What language do you need help with?')),
            locale.languageList.reduce(
                (prev,cur)=> prev.addChoices({name:cur.label,value:cur.val}
            ),
            new SlashCommandStringOption()
                .setName('translation')
                .setDescription('What language are you familiar with?'))
        ]
    }],
    ['ignore', {
        desc: 'Should I ignore any user?',
        callback: ignore,
        option: [
            new SlashCommandUserOption()
                .setName('user')
                .setDescription('Who?')
                .setRequired(true),
            new SlashCommandBooleanOption()
                .setName('ignore')
                .setDescription('ignore?')
        ]
    }],
    ['help', {
        desc: 'Get help',
        callback: printHelp
    }]
]);

let threadMap = new Map<string,ThreadChannel>();
let ignoredUsersMap = new Map<string,Set<string>>();

async function join(interaction: CommandInteraction, user: GuildMember, bot: GuildMember){
    if(!user.voice.channel){ //User is not in channel
        interaction.reply('Please join a voice channel first.');
        return;
    }
    if(bot.voice.channelId){ //Bot is already in channel
        interaction.reply('I am already in a voice channel!');
        return;
    }
    if(!interaction.channel){ //Channel not found
        interaction.reply("Text channel not found.");
        return;
    }
    if(!(interaction.channel instanceof TextChannel)){
        interaction.reply("Please use this command in a text channel!");
        return;
    }
    locale.setSource(locale.countryCodeMap.get(interaction.options.getString('language') ?? locale.english.val)!);
    locale.setTarget(locale.countryCodeMap.get(interaction.options.getString('translation') ?? locale.chinese.val)!);
    const thread = await interaction.channel.threads.create({
        name: 'Translation',
        autoArchiveDuration: 60,
    });
    threadMap.set(user.guild.id,thread);

    const guild = user.guild;
    const vc = user.voice.channel;
    const connection = joinVoiceChannel({
        channelId:vc.id,
        guildId: guild.id,
        adapterCreator: vc.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
        selfDeaf: false,
        selfMute:true
    });
    connection.receiver.speaking.addListener('start',(userid=>{
        if(ignoredUsersMap.get(guild.id)?.has(userid)) return;
        if(thread.archived) thread.setArchived(false);

        const username = vc.members.get(userid)?.displayName;
        let message = thread.send(`${username} ${locale.speaking()}...`);
        //@ts-ignore
        const chunk = [];
        const opusStream = connection.receiver.subscribe(userid,{
            end:{
                behavior: EndBehaviorType.AfterSilence,
                duration: 100
            }
        });
        const opusDecoder = new prism.opus.Decoder({rate:VC_SAMPLE_RATE, channels:2, frameSize:960});
        opusStream.on('error',(e)=>console.log('AudioStream: ' + e));
        opusStream.pipe(opusDecoder).on('data', data=>{
            chunk.push(data);
        })
        opusDecoder.on('end', async()=>{
            //@ts-ignore
            let transcription = transcriptor(processVCAudio(Buffer.concat(chunk)));
            let translation = '';
            const msg = await message;
            if(transcription.length>0){
                if(locale.srcLanguage != locale.tarLanguage){
                    translation = await translate(transcription);
                    msg.edit(locale.response(username,transcription,translation));
                }
                else msg.edit(locale.transcript(username,transcription));
                thread.awaitMessages({filter:(res)=>res.reference?.messageId==msg.id,max:1,time:30000}).then(
                    async (replies)=>{
                        if(replies.size > 0){
                            transcription = replies.first()!.content;
                            if(locale.srcLanguage != locale.tarLanguage){
                                translation = await translate(transcription);
                                msg.edit(locale.response(username,transcription,translation));
                            }
                            else msg.edit(locale.transcript(username,transcription));
                        }
                    }
                )
            }else{
                msg.delete();
            }
            
        });
    }));
    interaction.reply(`Hello!\nI will translate from __${locale.srcLanguage}__ to __${locale.tarLanguage}__`);
}

function leave(interaction: CommandInteraction, user: GuildMember, bot: GuildMember){
    if(!bot.voice.channelId){
        interaction.reply('I am not in a voice channel right now.');
        return;
    }
    if(user.voice.channelId != bot.voice.channelId){
        interaction.reply('We are not in the same voice channel.');
        return;
    }
    const connection = getVoiceConnection(user.guild.id);
    connection?.disconnect();
    threadMap.get(user.guild.id)?.delete();
    threadMap.delete(user.guild.id);
    ignoredUsersMap.get(user.guild.id)?.clear();
    //@ts-ignore
    interaction.reply({content:'Goodbye! Please rate how great my work is!', fetchReply:true}).then((message:Discord.Message) =>{
        message.react('1️⃣');
        message.react('2️⃣');
        message.react('3️⃣');
        message.react('4️⃣');
        message.react('5️⃣');
    });
}

function changeLang(interaction: CommandInteraction, user: GuildMember, bot: GuildMember){
    const cc = interaction.options.getString('language');
    const tcc = interaction.options.getString('translation');
    if(cc) {
        locale.setSource(locale.countryCodeMap.get(cc)!);
    }
    if(tcc){
        locale.setTarget(locale.countryCodeMap.get(tcc)!);
    }
    const rows:MessageActionRow[] = [
        new MessageActionRow().addComponents(
            new MessageSelectMenu()
            .setCustomId('srclang')
            .setPlaceholder('What language do you need help with?')
            .addOptions(locale.languageList.map(
                (lang)=>{
                    return {value:lang.val,label:lang.label};
                })
            )
        ),
        new MessageActionRow().addComponents(
            new MessageSelectMenu()
            .setCustomId('tarlang')
            .setPlaceholder('What language are you familiar with?')
            .addOptions(locale.languageList.map(
                (lang)=>{
                    return {value:lang.val,label:lang.label};
                })
            )
        )
    ];
            interaction.reply({content:`I am translating from __${locale.srcLanguage}__ to __${locale.tarLanguage}__!`,components:rows});
}

function ignore(interaction: CommandInteraction,user: GuildMember, bot:GuildMember){
    if(!bot.voice.channelId){
        interaction.reply('I am not in a voice channel right now.');
        return;
    }
    if(user.voice.channelId != bot.voice.channelId){
        interaction.reply('We are not in the same voice channel.');
        return;
    }
    const target = interaction.options.getUser('user',true);
    let ignore = interaction.options.getBoolean('ignore');
    if(ignore == null) ignore = true;
    if(ignore){
        if(!ignoredUsersMap.get(user.guild.id)?.add(target.id)){
            ignoredUsersMap.set(user.guild.id,new Set([target.id]));
        }
        interaction.reply("Ignored successfully.");
    }
    else{
        ignoredUsersMap.get(user.guild.id)?.delete(target.id);
        interaction.reply("Un-ignored successfully.");
    }

}

function printHelp(interaction:CommandInteraction, user: GuildMember, bot: GuildMember){
    interaction.reply({content:"foo",ephemeral:true});
}

export {Commands};