const Discord = require("discord.js");
const client = new Discord.Client({ intents: ['GUILDS', 'GUILD_MESSAGES'] });
const config = require("./config.json"); 

const Database = require("./database");

process.title = "demobot"

// Role id for authorized moderators
const modRoleID = '431269016322048001';

// Adds timestamps to console log
console.logCopy = console.log.bind(console);
console.log = function(data)
{
    var timestamp = '[' + new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) + '] ';
    this.logCopy(timestamp, data);
};

// On startup downloads files from Dropbox to keep continuity across sessions
client.on("ready", () => {
    console.log("Booting");
});

// Logs into Discord
client.login(config.discordToken).catch(function (err) {
    console.log(err);
});

// when the bot sees a message, begins running leaderboard update
client.on("messageCreate", async message => {
    if (!client.application?.owner) await client.application?.fetch();

    // Ignores messages from bots to stop abuse
    if (message.author.bot) return;

    let author = message.author.id;

    if (message.content.toLowerCase() === 'd: deploy' && author === client.application?.owner.id) {
        const update = {
            name: 'update',
            description: 'Updates your score on the leaderboard',
            options: [
                {
                    name: 'demolitions',
                    type: 'INTEGER',
                    description: 'The number of demolitions you have',
                    required: true,
                },
                {
                    name: 'exterminations',
                    type: 'INTEGER',
                    description: 'The number of exterminations you have',
                    required: true,
                },
                {
                    name: 'name',
                    type: 'STRING',
                    description: 'Your name to display on the leaderboard. Optional after the first time used',
                    required: false,
                }
            ],
        };

        const updateCommand = await client.guilds.cache.get('343166009286459402')?.commands.create(update);

        const authorize = {
            name: 'authorize',
            description: '(mod only) Change a user\'s score posting level',
            options: [
                {
                    name: 'user',
                    type: 'USER',
                    description: 'User to authorize',
                    required: true,
                },
                {
                    name: 'level',
                    type: 'INTEGER',
                    description: 'What level of authorization?',
                    required: true,
                    choices: [
                        {
                            name: 'None',
                            value: 0,
                        },
                        {
                            name: '15k+ demolitions and / or 500+ exterminations',
                            value: 1,
                        },
                        {
                            name: 'Top score on leaderboard',
                            value: 2,
                        },
                    ],
                }
            ],
        };

        const authorizeCommand = await client.guilds.cache.get('343166009286459402')?.commands.create(authorize);

        const name = {
            name: 'name',
            description: '(mod only) Change a user\'s leaderboard name',
            options: [
                {
                    name: 'user',
                    type: 'USER',
                    description: 'User to authorize',
                    required: true,
                },
                {
                    name: 'name',
                    type: 'STRING',
                    description: 'New name for user',
                    required: true,
                }
            ],
        };

        const nameCommand = await client.guilds.cache.get('343166009286459402')?.commands.create(name);

        const country = {
            name: 'country',
            description: 'Set your country to be shown on the leaderboard',
            options: [
                {
                    name: 'country',
                    type: 'STRING',
                    description: 'New country to show',
                    required: true,
                }
            ],
        };

        const countryCommand = await client.guilds.cache.get('343166009286459402')?.commands.create(country);

        const override = {
            name: 'override',
            description: '(mod only) Change a user\'s leaderboard score',
            options: [
                {
                    name: 'user',
                    type: 'USER',
                    description: 'User to change',
                    required: true,
                },
                {
                    name: 'demolitions',
                    type: 'INTEGER',
                    description: 'The number of demolitions to change to',
                    required: true,
                },
                {
                    name: 'exterminations',
                    type: 'INTEGER',
                    description: 'The number of exterminations to change to',
                    required: true,
                }
            ],
        };

        const overrideCommand = await client.guilds.cache.get('343166009286459402')?.commands.create(override);

        const remove = {
            name: 'remove',
            description: '(mod only) Removes a user from the leaderboard',
            options: [
                {
                    name: 'user',
                    type: 'USER',
                    description: 'User to remove (Can be Discord ID for banned users)',
                    required: true,
                }
            ],
        };

        const removeCommand = await client.guilds.cache.get('343166009286459402')?.commands.create(remove);

        const setUserCountry = {
            name: 'setusercountry',
            description: '(mod only) Sets a user\'s country',
            options: [
                {
                    name: 'user',
                    type: 'USER',
                    description: 'User to change (Can be Discord ID for banned users)',
                    required: true,
                },
                {
                    name: 'country',
                    type: 'STRING',
                    description: 'New country',
                    required: true,
                }
            ],
        };

        const setUserCountryCommand = await client.guilds.cache.get('343166009286459402')?.commands.create(setUserCountry);

        console.log("Deployed slash commands");
        message.react("✅");
        return;
    }

    // Ensures the message starts with the prefix "D:"
    if (message.content.toUpperCase().indexOf(config.prefix) !== 0) return;

    // Command for me to change a user's history
    // Disabled for the moment as I've changed the format of history
    // if (message.content.toLowerCase().indexOf('d: h') == 0 && author === client.application?.owner.id) {
    //     addHistory(message);
    //     return;
    // }

    let player = await Database.getPlayer(author);

    // Asks new users to use /update which handles new users
    if (!player) {
        await message.reply("New accounts must set up their name using /update");
        return;
    }

    ////////////
    // Now checks scores for legacy D: E: users
    // Probably removing eventually, but not at the moment

    // Checks for demo and exterms formatted as
    // D: # E: #
    const regexVal = /[dD]:\s*(\d+)\s+[eE]:\s*(\d+)/;

    // regex ensures proper command usage
    let matchResults = message.content.match(regexVal);

    if (!matchResults) {
        message.reply("Invalid format, please update your stats with /update");
        return;
    }

    let demos = parseInt(matchResults[1]);
    let exterms = parseInt(matchResults[2]);

    addScores(message, player, demos, exterms);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'update') { 
        const demos = interaction.options.get('demolitions').value;
        const exterms = interaction.options.get('exterminations').value;
        const name = interaction.options.get('name')?.value;

        const author = interaction.user.id;

        var player = await Database.getPlayer(author);

        if (name) {
           
            if (!player) {
                // If the leaderboard doesn't include the author, adds them
                player = new DemobotTypes.Player({
                    DISCORD_ID: author,
                    NAME: name,
                    DEMOLITIONS: 0,
                    EXTERMINATIONS: 0,
                    COUNTRY: null,
                    LAST_UPDATE: null,
                    AUTHORIZED: 0
                });
            
                await Database.insertPlayer(player);
            } else {
                // Leaderboard does include the author, update their name
                // The addScores call will actually update it
                player.NAME = name;
            }
        } else {
            // if the leaderboard doesn't include this discord ID and no name was given, returns and warns user
            if (!player) {
                await interaction.reply("New account has no name, try again including a name");
                return;
            }
        }

        addScores(interaction, player, demos, exterms);
    }

    if (interaction.commandName === 'authorize') {
        // Allows moderators to authorize users to post their scores
        // Unauthorized users cannot upload scores >15000 demos and/or 500 exterms
        const user = interaction.options.get('user').value;
        const level = interaction.options.get('level').value;

        if (!interaction.member.roles.cache.has(modRoleID)) {
            await interaction.reply({content: "Only mods can use this command", ephemeral: true});
            return;
        }

        var player = await Database.getPlayer(user);

        player.AUTHORIZED = level;

        await Database.updatePlayer(player);

        console.log("Authorized " + player.NAME + " at level " + level);
        interaction.reply("Authorized " + player.NAME + " at level " + level);
    }

    if (interaction.commandName === 'name') {
        // Allows moderators to rename users
        const user = interaction.options.get('user').value;
        const name = interaction.options.get('name').value;

        if (!interaction.member.roles.cache.has(modRoleID)) {
            await interaction.reply({content: "Only mods can use this command", ephemeral: true});
            return;
        }

        var player = await Database.getPlayer(user);

        // If the user isn't in the leaderboard, warns user
        if (!player) {
            interaction.reply("<@" + user + "> isn't in the leaderboard");
            return;
        }

        player.NAME = name;

        await Database.updatePlayer(player);

        interaction.reply("Renamed <@" + user + "> to " + name);
    }

    if (interaction.commandName === 'country') {
        const country = interaction.options.get('country').value;
        let author = interaction.user.id;

        var player = await Database.getPlayer(author);

        // If the user isn't in the leaderboard, warns user
        if (!player) {
            message.reply("<@" + author + "> you aren't on the leaderboard! Make sure to /update!");
            return;
        }

        // TODO verify country matches 3 letter country code

        player.COUNTRY = country;

        // Links ID to country
        await Database.updatePlayer(player);

        interaction.reply("Set <@" + author + ">'s country to " + country);
    }

    if (interaction.commandName === 'override') {
        // Allows moderators to rename users
        const user = interaction.options.get('user').value;
        const demos = interaction.options.get('demolitions').value;
        const exterms = interaction.options.get('exterminations').value;

        if (!interaction.member.roles.cache.has(modRoleID)) {
            await interaction.reply({content: "Only mods can use this command", ephemeral: true});
            return;
        }

        var player = await Database.getPlayer(user);

        if (!player) {
            interaction.reply("<@" + user + "> isn't in the leaderboard");
            return;
        }

        player.DEMOLITIONS = demos;
        player.EXTERMINATIONS = exterms;

        await Database.updatePlayer(player);

        interaction.reply("<@" + user + "> has " + demos + " demos and " + exterms + " exterms");
    }

    if (interaction.commandName === 'remove') {
        // Allows moderators to rename users
        const user = interaction.options.get('user').value;

        if (!interaction.member.roles.cache.has(modRoleID)) {
            await interaction.reply({content: "Only mods can use this command", ephemeral: true});
            return;
        }

        var player = await Database.getPlayer(user);

        if (!player) {
            interaction.reply("<@" + user + "> isn't in the leaderboard");
            return;
        }

        // TODO add remove function
        delete leaderboard[user];

        interaction.reply("<@" + user + "> has been removed from the leaderboard");
    }

    if (interaction.commandName === 'setusercountry') {
        // Allows moderators to rename users
        const user = interaction.options.get('user').value;
        const country = interaction.options.get('country').value;

        if (!interaction.member.roles.cache.has(modRoleID)) {
            await interaction.reply({content: "Only mods can use this command", ephemeral: true});
            return;
        }

        var player = await Database.getPlayer(user);

        if (!player) {
            interaction.reply("<@" + user + "> isn't in the leaderboard");
            return;
        }

        player.COUNTRY = country;

        await Database.updatePlayer(player);

        interaction.reply("Set <@" + user + ">'s country to " + country);
    }
});

/**
 * Processes any messages to send about milestones, and checks for authorization, then uploads scores
 * 
 * @param {Discord.Interaction} interaction 
 * @param {DemobotTypes.Player} player
 * @param {Number} demos 
 * @param {Number} exterms 
 */
async function addScores(interaction, player, demos, exterms) {
    let authorized = player.AUTHORIZED;

    // TODO function get high scores
    let highscores = {
        leaderDemos: 1000000,
        leaderExterm: 10000,
    }

    // Only authorized users can upload scores with >15000 demos and/or >500 exterms
    // Needs permission to do so
    if (authorized === 0) {
        if (demos > 15000) {
            await interaction.reply("Congratulations, you have over 15k Demolitions! " +
                "New submissions with high scores require manual review. " +
                "Please send a screenshot of your stats to this channel. " +
                "Mods usually notice and approve updates within a few hours, " +
                "but occasionally it takes a few days. Please be patient");
            return;
        }

        if (exterms > 500) {
            await interaction.reply("Congratulations, you have over 500 Exterminations! " +
                "New submissions with high scores require manual review. " +
                "Please send a screenshot of your stats to this channel. " +
                "Mods usually notice and approve updates within a few hours, " +
                "but occasionally it takes a few days. Please be patient");
            return;
        }
    }

    if (authorized === 1) {
        // Checks against the top score
        // Only users authorized level 2 can update the top score
        // Prevents abuse by authorized 1 users
        if (demos >= highscores.leaderDemos) {
            await interaction.reply("Congrats on the top place for Demos! " +
                "Please send proof of stats here before we can verify your spot.");
            return;
        }
        if (exterms >= highscores.leaderExterm) {
            await interaction.reply("Congrats on the top place for Exterminations! " +
                "Please send proof of stats here before we can verify your spot.");
            return;
        }
    }

    if (exterms * 7 > demos) {
        await interaction.reply("Make sure your exterms are less than 7 times your demos");
        return;
    }

    // If user is authorized 2 (highest level), checks if the top score should be updated
    if (authorized === 2) {
        let newScore = false; 
        if (demos > highscores.leaderDemos) {
            newScore = true;
            // TODO function to update high scores
            highscores.leaderDemos = demos;
        }

        if (exterms > highscores.leaderExterm) {
            newScore = true;
            highscores.leaderExterm = demos;
        }
    }

    // Checks for server role and nickname milestones
    checkMilestones(interaction, player, demos, exterms);

    let currTime = new Date();
    let currTimeString = currTime.toISOString();

    player.DEMOLITIONS = demos;
    player.EXTERMINATIONS = exterms;
    player.LAST_UPDATE = currTimeString;

    // Adds score
    await Database.updatePlayer(player);

    // TODO Insert function for history
    // leaderboard[id].History.push({
    //     "Demolitions": demos,
    //     "Exterminations": exterms,
    //     "Time": currTimeString
    // });

    await interaction.reply("<@" + player.DISCORD_ID + "> has " + demos + " demos and " + exterms + " exterms\n" +
        "Check the leaderboard at https://demolition-leaderboard.netlify.app/");
}

/**
 * Checks if the player's passed a milestone for review.
 * As this is informal, still lets the score go through
 * 
 * @param {Discord.Interaction} interaction 
 * @param {DemobotTypes.Player} player 
 * @param {Number} demos 
 * @param {Number} exterms 
 */
function checkMilestones(interaction, player, demos, exterms) {
    let currentBombs = Math.floor(player.DEMOLITIONS / 10000);
    let newBombs = Math.floor(demos / 10000);
    if (currentBombs < newBombs) {
        interaction.channel.send("Congrats on a " + newBombs + " bomb milestone <@" + player.DISCORD_ID + 
            ">! Please provide a screenshot of your stats. Rewards are explained here <#642467858248499212>");
        // Returns early as it's already asking for a screenshot. Doesn't need request for exterms
        return;
    }

    let reachedMilestone = false;
    // all current milestones available. Descending order to congratulate on 
    let milestones = [10000, 5000, 1000, 100];
    for (let i in milestones) {
        let milestone = milestones[i];
        reachedMilestone = checkExtermMilestone(interaction, player, exterms, milestone);
        // only ask user for highest new milestone
        if (reachedMilestone) {
            break;
        }
    }
}

/**
 * Checks if a player just reached a new milestone for exterminations.
 * @param {Discord.Interaction} interaction 
 * @param {DemobotTypes.Player} player 
 * @param {Number} newExterms 
 * @param {Number} milestone 
 * @returns {Boolean} Whether a milestone was reached
 */
function checkExtermMilestone(interaction, player, newExterms, milestone) {
    // ignore milestone if the player's already reached it
    if (player.EXTERMINATIONS >= milestone) {
        return false;
    }

    // New milestone reached!
    if (newExterms >= milestone) {
        interaction.channel.send("Congrats on a " + milestone + "+ extermination milestone <@" + player.DISCORD_ID + 
            ">! Please provide a screenshot of your stats. Rewards are explained here <#642467858248499212>");
        return true;
    }

    return false;
}

// used to upload and override player's history from discord without manual file editing
// async function addHistory(message) {
//     let attachments = (message.attachments);
//     let attachmentURL;
//     if (attachments && attachments.at(0)){
//         attachmentURL = attachments.at(0).url;
//     } else {
//         message.reply("Bad attachments!")
//         return;
//     }

//     let playerID;
//     if (message.mentions.users && message.mentions.users.at(0)) {
//         playerID = message.mentions.users.at(0).id
//     } else {
//         message.reply("Bad mention!")
//         return;
//     }

//     console.log( attachmentURL );
//     console.log( playerID );

//     let attachmentRequest = await fetch(attachmentURL);

//     let attachmentJSON = await attachmentRequest.json();

//     leaderboard[playerID].History = attachmentJSON;

//     uploadJSON(message);
//     message.reply("Set history for <@" + playerID + "> AKA " + leaderboard[playerID].Name);
// }

process.on('unhandledRejection', function(err) {
    console.log(err);
});