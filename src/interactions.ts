import { SlashCommandBooleanOption, SlashCommandIntegerOption, SlashCommandStringOption, SlashCommandUserOption } from '@discordjs/builders';
import { DiscordGatewayAdapterCreator, EndBehaviorType, getVoiceConnection, joinVoiceChannel } from '@discordjs/voice';
import { CommandInteraction, GuildMember, MessageActionRow, MessageSelectMenu, TextChannel, ThreadChannel, Message, MessageEmbed} from 'discord.js'
import * as locale from './localization';
import prism from 'prism-media';
import { processVCAudio, VC_SAMPLE_RATE } from './audio';
import { transcriptor } from './transcription';
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
                (prev,cur)=> prev.addChoices({name:cur.label,value:cur.code}
            ),
            new SlashCommandStringOption()
                .setName('from')
                .setDescription('What language do you need help with?')),
            locale.languageList.reduce(
                (prev,cur)=> prev.addChoices({name:cur.label,value:cur.code}
            ),
            new SlashCommandStringOption()
                .setName('to')
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
                (prev,cur)=> prev.addChoices({name:cur.label,value:cur.code}
            ),
            new SlashCommandStringOption()
                .setName('from')
                .setDescription('What language do you need help with?')),
            locale.languageList.reduce(
                (prev,cur)=> prev.addChoices({name:cur.label,value:cur.code}
            ),
            new SlashCommandStringOption()
                .setName('to')
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
let messageDeleteMap = new Map<string, Map<string,NodeJS.Timeout>>();

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
    locale.setSource(locale.countryCodeMap.get(interaction.options.getString('from') ?? locale.english.code)!);
    locale.setTarget(locale.countryCodeMap.get(interaction.options.getString('to') ?? locale.chinese.code)!);
    const thread = await interaction.channel.threads.create({
        name: 'Translation',
        autoArchiveDuration: 60,
    });
    threadMap.set(user.guild.id,thread);
    let messageDeletePool = new Map<string,NodeJS.Timeout>();
    messageDeleteMap.set(user.guild.id, messageDeletePool);
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
        thread.sendTyping().catch(()=>undefined);
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
            let srcText = transcriptor(processVCAudio(Buffer.concat(chunk)));
            if(srcText.length > 0){
                let tarText = '';
                if(locale.srcLanguage !== locale.tarLanguage){
                    tarText = await translate(srcText);
                }
                let message = await thread.send({embeds:[createEmbed(srcText,tarText,user)]});
                thread.awaitMessages({filter:(res)=>res.reference?.messageId==message.id,max:1,time:30000}).then(
                    async (replies)=>{
                        if(replies.size > 0){
                            srcText = replies.first()!.content;
                            if(locale.srcLanguage !== locale.tarLanguage){
                                tarText = await translate(srcText);
                            }
                            createEmbed(srcText,tarText,user)
                            message.edit({embeds:[createEmbed(srcText,tarText,user)]});
                            replies.first()?.delete().catch((e)=>console.error(e));
                        }
                    }
                )
                messageDeletePool.set(message.id,setTimeout(()=>{
                    message.delete();
                    messageDeletePool.delete(message.id);
                }, 60000));
            }
        });
    }));
    interaction.reply(`Hello!\nI will translate from __${locale.srcLanguage}__ to __${locale.tarLanguage}__`);
}

function createEmbed(srcText:string, tarText:string,user: GuildMember){
    let srcRomaji = locale.romaji(srcText,locale.srcLanguage);
    let tarRomaji = locale.romaji(tarText,locale.tarLanguage);
    
    let embed = new MessageEmbed()
        .setColor(user.displayHexColor)
        .setThumbnail(user.displayAvatarURL())
        .setAuthor({name: user.displayName, iconURL: user.displayAvatarURL()})
        .setTitle(srcText)
        .setDescription(srcRomaji);
    if(tarText.length > 0){
        embed.addField(tarText,tarRomaji);
    }
    return embed;
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
    if(interaction.channel!.isThread()){
        interaction.reply('Thank you!');
        interaction.channel!.parent!.send({content:'Goodbye! Please rate how great my work is!'}).then((message:Message<boolean>) =>{
            message.react('1️⃣');
            message.react('2️⃣');
            message.react('3️⃣');
            message.react('4️⃣');
            message.react('5️⃣');
        })
    }
    else{
        interaction.reply({content:'Goodbye! Please rate how great my work is!'}).then((message:any) =>{
            if(message instanceof Message){
                message.react('1️⃣');
                message.react('2️⃣');
                message.react('3️⃣');
                message.react('4️⃣');
            }
        });
    }
    cleanUp(user.guild.id);
}

async function cleanUp(guildID: string){
    const connection = getVoiceConnection(guildID);
    connection?.disconnect();
    await threadMap.get(guildID)?.delete();
    threadMap.delete(guildID);
    ignoredUsersMap.get(guildID)?.clear();
    messageDeleteMap.get(guildID)?.forEach((val)=>clearTimeout(val));
    messageDeleteMap.delete(guildID);
}

function changeLang(interaction: CommandInteraction, user: GuildMember, bot: GuildMember){
    const cc = interaction.options.getString('from');
    const tcc = interaction.options.getString('to');
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
                    return {value:lang.code,label:lang.label};
                })
            )
        ),
        new MessageActionRow().addComponents(
            new MessageSelectMenu()
            .setCustomId('tarlang')
            .setPlaceholder('What language are you familiar with?')
            .addOptions(locale.languageList.map(
                (lang)=>{
                    return {value:lang.code,label:lang.label};
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

export {Commands, cleanUp};