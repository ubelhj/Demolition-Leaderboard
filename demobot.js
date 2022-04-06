const Discord = require("discord.js");
const client = new Discord.Client({ intents: ['GUILDS', 'GUILD_MESSAGES'] });
//const config = require("./config.json"); // For local Testing only
const config = process.env; // for heroku usage

// hold jsons
let leaderboard;
let highscores;

// holds discord IDs of authorized moderators
//const mods = require("./moderators.json");
const modRoleID = '431269016322048001';

const fetch = require('isomorphic-fetch');
const Dropbox = require('dropbox').Dropbox;
let dbx = new Dropbox({accessToken: config.dropToken, fetch: fetch});
let failedDownload = false;

// On startup downloads files from Dropbox to keep continuity across sessions
client.on("ready", () => {
    download();
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

    // if the previous download failed, tries again
    if (failedDownload) {
        download();
    }

    // if two in a row have failed, gives up and warns user
    // Prevents overwriting of data with old data
    if (failedDownload) {
        await message.reply("Failed to connect to dropbox. Try again in a couple minutes");
        return;
    }

    if (message.content.toLowerCase().indexOf('d: h') == 0 && author === client.application?.owner.id) {
        addHistory(message);
        return;
    }

    // Asks new users to use /update which handles new users
    if (!leaderboard[author]) {
        await message.reply("New accounts must set up their name using /update");
        return;
    }

    const regexVal = /[dD]:\s*(\d+)\s+[eE]:\s*(\d+)/;

    // regex ensures proper command usage
    let matchResults = message.content.match(regexVal);

    if (!matchResults) {
        message.reply("Invalid format, please update your stats with the following format: " +
            "D: # of demos E: # of exterminations\nEx: ```D: 2000 E: 1000```\n" +
            "Or use /update");
        return;
    }

    let demos = parseInt(matchResults[1]);
    let exterms = parseInt(matchResults[2]);

    addScores(demos, exterms, author, message);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    // if the previous download failed, tries again
    if (failedDownload) {
        download();
    }

    // if two in a row have failed, gives up and warns user
    // Prevents overwriting of data with old data
    if (failedDownload) {
        await interaction.reply("Failed to connect to dropbox. Try again in a couple minutes");
        return;
    }

    if (interaction.commandName === 'update') { 
        const demos = interaction.options.get('demolitions').value;
        const exterms = interaction.options.get('exterminations').value;
        let name = interaction.options.get('name')?.value;

        let author = interaction.user.id;

        // if there is a name supplied
        if (name) {
            // If the leaderboard doesn't include the author, adds them
            // otherwise ignores name field
            if (!leaderboard[author]) {
                leaderboard[author] = {
                    "Name": name,
                    "Demolitions": 0,
                    "Exterminations": 0,
                    "LastUpdate": "2015-07-07T00:00:00.000",
                    "Authorized": 0,
                    "History": []
                  };
            }

            leaderboard[author].Name = name;
        } else {
            // if the leaderboard doesn't include this discord ID and no name was given, returns and warns user
            if (!leaderboard[author]) {
                await interaction.reply("New account has no name, try again including a name");
                return;
            }
        }

        addScores(demos, exterms, author, interaction);
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

        // if the leaderboard doesn't include this discord ID, returns and warns user
        if (!leaderboard[user]) {
            await interaction.reply({content:"<@" + user + 
                "> isn't on the leaderboard. Have them use /update", ephemeral: true});
            return;
        }

        authorize(user, level, interaction);
    }

    if (interaction.commandName === 'name') {
        // Allows moderators to rename users
        const user = interaction.options.get('user').value;
        const name = interaction.options.get('name').value;

        if (!interaction.member.roles.cache.has(modRoleID)) {
            await interaction.reply({content: "Only mods can use this command", ephemeral: true});
            return;
        }

        nameUser(name, user, interaction);
    }

    if (interaction.commandName === 'country') {
        const country = interaction.options.get('country').value;
        let author = interaction.user.id;

        // If the user isn't in the leaderboard, warns user
        if (!leaderboard[author]) {
            message.reply("<@" + author + "> isn't in the leaderboard");
            return;
        }

        // Links ID to country
        leaderboard[author].Country = country;

        // Uploads the updated JSON Leaderboard
        uploadJSON(interaction);
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

        if (!leaderboard[user]) {
            interaction.reply("<@" + user + "> isn't in the leaderboard");
            return;
        }

        leaderboard[user].Demolitions = demos;
        leaderboard[user].Exterminations = exterms;
        uploadJSON(interaction);
        interaction.reply("<@" + user + "> has " + demos + " demos and " + exterms + " exterms");
    }

    if (interaction.commandName === 'remove') {
        // Allows moderators to rename users
        const user = interaction.options.get('user').value;

        if (!interaction.member.roles.cache.has(modRoleID)) {
            await interaction.reply({content: "Only mods can use this command", ephemeral: true});
            return;
        }

        if (!leaderboard[user]) {
            interaction.reply("<@" + user + "> isn't in the leaderboard");
            return;
        }

        delete leaderboard[user];
        uploadJSON(interaction);
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

        if (!leaderboard[user]) {
            interaction.reply("<@" + user + "> isn't in the leaderboard");
            return;
        }

        leaderboard[user].Country = country;
        uploadJSON(interaction);
        interaction.reply("Set <@" + user + ">'s country to " + country);
    }
});



function authorize(id, level, message) {
    // If the user isn't in the leaderboard, adds them
    if (!leaderboard[id]) {
        console.log("Error updating invalid user " + id);
        return;
    }

    leaderboard[id].Authorized = level;

    // Uploads the updated JSON Leaderboard
    uploadJSON(message);
    message.reply("Authorized " + leaderboard[id].Name + " at level " + level);
    console.log("Authorized " + leaderboard[id].Name + " at level " + level);
}

function nameUser(name, id, message) {
    // If the user isn't in the leaderboard, warns user
    if (!leaderboard[id]) {
        message.reply("<@" + id + "> isn't in the leaderboard");
        return;
    }

    // Links ID to name
    leaderboard[id].Name = name;

    // Uploads the updated JSON Leaderboard
    uploadJSON(message);
    message.reply("Renamed <@" + id + "> to " + name);
}

async function addScores(demos, exterms, id, interaction) {
    let authorized = leaderboard[id].Authorized;

    // Only authorized users can upload scores with >15000 demos and/or >500 exterms
    // Needs permission to do so
    if (authorized === 0) {
        if (demos > 15000) {
            await interaction.reply("Congratulations, you have over 15k Demolitions! " +
                "New submissions with high scores require manual review from an admin. " +
                "Please send a screenshot of your stats to this channel. If you have any " +
                "questions, please ask here");
            return;
        }

        if (exterms > 500) {
            await interaction.reply("Congratulations, you have over 500 Exterminations! " +
                "New submissions with high scores require manual review from an admin. " +
                "Please send a screenshot of your stats to this channel. If you have any " +
                "questions, please ask here");
            return;
        }
    }

    if (authorized === 1) {
        // Checks against the top score
        // Only users authorized to update the top score are allowed to
        // Prevents abuse by authorized users
        if (demos >= highscores.leaderDemos) {
            await interaction.reply("Congrats on the top place for Demos! " +
                "Please send proof to an admin before we can verify your spot.");
            return;
        }
        if (exterms >= highscores.leaderExterm) {
            await interaction.reply("Congrats on the top place for Exterminations! " +
                "Please send proof to an admin before we can verify your spot.");
            // Authorized users can update scores lower than the top spot
            return;
        }
    }

    if (exterms * 7 > demos) {
        await interaction.reply("Make sure your exterms are less than 7 times your demos");
        return;
    }

    if (authorized === 2) {
        highscores.leaderDemos = demos;
        highscores.leaderExterm = exterms;
        uploadHighScores();
    }

    leaderboard[id].Demolitions = demos;
    leaderboard[id].Exterminations = exterms;
    let currTime = new Date();
    let currTimeString = currTime.toISOString();
    leaderboard[id].LastUpdate = currTimeString;
    leaderboard[id].History.push({
        "Demolitions": demos,
        "Exterminations": exterms,
        "Time": currTimeString
    });

    uploadJSON(interaction);
    await interaction.reply("<@" + id + "> has " + demos + " demos and " + exterms + " exterms");
}

// used to upload and override player's history from discord without manual file editing
async function addHistory(message) {
    let attachments = (message.attachments);
    let attachmentURL;
    if (attachments && attachments.at(0)){
        attachmentURL = attachments.at(0).url;
    } else {
        message.reply("Bad attachments!")
        return;
    }

    let playerID;
    if (message.mentions.users && message.mentions.users.at(0)) {
        playerID = message.mentions.users.at(0).id
    } else {
        message.reply("Bad mention!")
        return;
    }

    console.log( attachmentURL );
    console.log( playerID );

    let attachmentRequest = await fetch(attachmentURL);

    let attachmentJSON = await attachmentRequest.json();

    leaderboard[playerID].History = attachmentJSON;

    uploadJSON(message);
    message.reply("Set history for <@" + playerID + "> AKA " + leaderboard[playerID].Name);
}

///////////////////////////////////////////
///////// Dropbox API interactions ////////
///////////////////////////////////////////

// downloads files from Dropbox to ensure continuity over multiple sessions
function download() {
    failedDownload = false;

    // Downloads and saves dropbox files of leaderboards
    // Allows cross-session saving of data and cloud access from other apps
    dbx.filesDownload({path: "/leaderboard.json"})
        .then(function (data) {
            leaderboard = JSON.parse(data.fileBinary);
            console.log("Downloaded leaderboard.json");
        })
        .catch(function (err) {
            failedDownload = true;
            throw err;
        });

    dbx.filesDownload({path: "/highscores.json"})
        .then(function (data) {
            highscores = JSON.parse(data.fileBinary);
            console.log("Downloaded highscores.json");
        })
        .catch(function (err) {
            failedDownload = true;
            throw err;
        });

    if (failedDownload) {
        console.log("failed download");
    }
}

// uploads the JSON file leaderboard to Dropbox
function uploadJSON(message) {
    dbx.filesUpload({path: '/leaderboard.json', contents: JSON.stringify(leaderboard, null, "\t"), mode: "overwrite"})
        .catch(function (error) {
            message.reply("Dropbox error for JSON Leaderboard. Try same command again");
            console.error(error);
        });

    console.log("Uploaded leaderboard JSON");
}

// uploads the JSON file high scores to Dropbox
function uploadHighScores(message) {
    dbx.filesUpload({path: '/highscores.json', contents: JSON.stringify(highscores, null, "\t"), mode: "overwrite"})
        .catch(function (error) {
            message.reply("Dropbox error for highscores. Try same command again");
            console.error(error);
        });

    console.log("Uploaded highscores");
}

process.on('unhandledRejection', function(err) {
    console.log(err);
});