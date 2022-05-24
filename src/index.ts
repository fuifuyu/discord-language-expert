import dotenv from 'dotenv'
dotenv.config();

import Discord from 'discord.js'
import { cleanUp, Commands } from './interactions';
import * as locale from './localization';
import { loadModels } from './transcription';

if(process.argv[1] != 'testing'){
	require('../script/deploy-command');
}

const client = new Discord.Client({
	intents: [
		Discord.Intents.FLAGS.GUILDS,
		Discord.Intents.FLAGS.GUILD_MESSAGES,
		Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		Discord.Intents.FLAGS.GUILD_VOICE_STATES,
	]
});

loadModels().then(()=>
	client.login(process.env.BOT_TOKEN).then(()=>{
		client.user!.setPresence({
			status:'online',
			afk: false,
			activities:[{
				name: "Hello!",
				type: 'PLAYING',
			}]
		})
	})
);

client.once('ready',()=>{
	console.log("Logged in!");
});

client.on('interactionCreate',interaction =>{
	if(interaction.isCommand()){
		const user = interaction.guild?.members.cache.get(interaction.user.id);
		if(!user || interaction.guild!.me==null){
			throw 'User not found';
		}
		const cmd = Commands.get(interaction.commandName);
		if(cmd){
			cmd.callback(interaction, user, interaction.guild!.me);
		}
	}
	if(interaction.isSelectMenu()){
		if(interaction.customId === 'srclang'){
			const lang = locale.countryCodeMap.get(interaction.values[0])!;
			locale.setSource(lang);
			interaction.update(`I am translating from __${locale.srcLanguage}__ to __${locale.tarLanguage}__!`);
		}
		else if(interaction.customId === 'tarlang'){
			const lang = locale.countryCodeMap.get(interaction.values[0])!;
			locale.setTarget(lang);
			interaction.update(`I am translating from __${locale.srcLanguage}__ to __${locale.tarLanguage}__!`);
		}
	}
});

['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
    'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
].forEach(function (sig) {
    process.on(sig, async ()=>{
        console.log(`Terminated by signal ${sig}`);
		await cleanUpAll();
    });
});
process.on('uncaughtException', async (e)=>{
	console.error(e);
	await cleanUpAll();
});

process.on('beforeExit',async()=>{
	await cleanUpAll();
});

async function cleanUpAll(){
	let promises: Promise<any>[] = [];
	client.guilds.cache.forEach((_,id)=> {
		promises.push(cleanUp(id));
	});
	await Promise.all(promises);
	process.exit();
}