import dotenv from 'dotenv'
dotenv.config();

import { SlashCommandBooleanOption, SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandStringOption, SlashCommandUserOption } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { Commands } from '../src/interactions';

const testing = process.argv[1] === 'testing';

// @ts-ignore
const commands = [];
Commands.forEach((cmd,key)=>{
	console.log(key);
	const c = new SlashCommandBuilder().setName(key).setDescription(cmd.desc);
	cmd.option?.forEach(option=>{
		if(option instanceof SlashCommandStringOption) c.addStringOption(option)
		if(option instanceof SlashCommandIntegerOption) c.addIntegerOption(option)
		if(option instanceof SlashCommandUserOption) c.addUserOption(option)
		if(option instanceof SlashCommandBooleanOption) c.addBooleanOption(option)
	});
	commands.push(c.toJSON());
});
// @ts-ignore
const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN);

if(testing){
	// @ts-ignore
	rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.DEV_GUILD_ID), { body: commands })
		.then(() => console.log('Successfully registered application commands.'))
		.catch(console.error);
}
else{
	// @ts-ignore
	rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);
}