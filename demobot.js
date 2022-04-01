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

const fs = require('fs');
const fetch = require('isomorphic-fetch');
const Dropbox = require('dropbox').Dropbox;
let dbx = new Dropbox({accessToken: config.dropToken, fetch: fetch});
let failedDownload = false;


// On startup downloads files from Dropbox to keep continuity across sessions
client.on("ready", () => {
    download();
});

// when the bot sees a message, begins running leaderboard update
client.on("messageCreate", async message => {
    if (!client.application?.owner) await client.application?.fetch();

    // Ignores messages from bots to stop abuse
    if (message.author.bot) return;

    if (message.content.toLowerCase() === 'd: deploy' && message.author.id === client.application?.owner.id) {
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

    let author = message.author.id;

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

    let demos = matchResults[1];
    let exterms = matchResults[2];

    let name = leaderboard[author].Name;

    addScores(leaderboard[author].Authorized, demos, exterms, name, author, message);
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

            // TODO temporarily disabled until reasonable solution is made for overrides
            // if (interaction.member.roles.cache.has(modRoleID)) {
            //     leaderboard[author].Demos = demos;
            //     leaderboard[author].Exterminations = exterms;
            //     leaderboard[author].name = name;
            //     await interaction.reply("Overriden the score of user " + name);
            //     return;
            // }
    
            // TODO: also solve duplicate names
            // if (leaderboard[name].Discord !== author) {
            //     await interaction.reply("That name is already taken, please try another");
            //     return;
            // }

        } else {
            // if the leaderboard doesn't include this discord ID and no name was given, returns and warns user
            if (!leaderboard[author]) {
                await interaction.reply("New account has no name, try again including a name");
                return;
            }
        }

        name = leaderboard[author].Name

        addScores(leaderboard[author].Authorized, demos, exterms, name, author, interaction);
    }

    if (interaction.commandName === 'authorize') {
        // Allows moderators to authorize users to post their scores
        // Unauthorized users cannot upload scores >15000 demos and/or 500 exterms
        const user = interaction.options.get('user').value;
        const level = interaction.options.get('level').value;

        let author = interaction.user.id;

        if (!interaction.member.roles.cache.has(modRoleID)) {
            await interaction.reply({content: "Only mods can use this command", ephemeral: true});
            return;
        }

        // if the leaderboard doesn't include this discord ID, returns and warns user
        if (!leaderboard[user]) {
            await interaction.reply({content:"User <@" + user + 
                "> isn't on the leaderboard. Have them use /update", ephemeral: true});
            return;
        }

        authorize(user, level, interaction);
    }

    if (interaction.commandName === 'name') {
        // Allows moderators to rename users
        const user = interaction.options.get('user').value;
        const name = interaction.options.get('name').value;

        let author = interaction.user.id;

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
            message.reply("User <@" + author + "> isn't in the leaderboard");
            return;
        }

        // Links ID to country
        leaderboard[author].Country = country;

        // Uploads the updated JSON Leaderboard
        uploadJSON(interaction);
        interaction.reply("Set <@" + author + ">'s country to " + country);
    }
});

function uploadFiles(updatedLeaderboard, message) {
    // If the leaderboard scores have been updated, uploads it
    if (updatedLeaderboard) {
        // Adds to running CSV, which works better with R Shiny site
        // Has format: name, demolitions, exterminations
        uploadCSV(message, updatedLeaderboard);
    }
    // the JSON Leaderboard has been updated, uploads that file
    uploadJSON(message);
}

// downloads files from Dropbox to ensure continuity over multiple sessions
function download() {
    failedDownload = false;

    // Downloads and saves dropbox files of leaderboards
    // Allows cross-session saving of data and cloud access from other apps
    // Stores data as json mapped to username
    dbx.filesDownload({path: "/leaderboard.json"})
        .then(function (data) {
            fs.writeFile("./leaderboard.json", data.fileBinary, 'binary', function (err) {
                if (err) {
                    failedDownload = true;
                    throw err;
                }
                leaderboard = require("./leaderboard.json");
                console.log('File: ' + data.name + ' saved.');
            });
        })
        .catch(function (err) {
            failedDownload = true;
            throw err;
        });
    // Stores data as easy to manipulate CSV
    dbx.filesDownload({path: "/leaderboard.csv"})
        .then(function (data) {
            fs.writeFile("./leaderboard.csv", data.fileBinary, 'binary', function (err) {
                if (err) {
                    failedDownload = true;
                    throw err;
                }
                console.log('File: ' + data.name + ' saved.');
            });
        })
        .catch(function (err) {
            failedDownload = true;
            throw err;
        });

    dbx.filesDownload({path: "/highscores.json"})
        .then(function (data) {
            fs.writeFile("./highscores.json", data.fileBinary, 'binary', function (err) {
                if (err) {
                    failedDownload = true;
                    throw err;
                }
                console.log('File: ' + data.name + ' saved.');
                highscores = require("./highscores.json");
            });
        })
        .catch(function (err) {
            failedDownload = true;
            throw err;
        });

    if (failedDownload) {
        console.log("failed download");
    }
}

function authorize(id, level, message) {
    // If the user isn't in the leaderboard, adds them
    if (!leaderboard[id]) {
        console.log("Error updating invalid user " + id);
        return;
    }

    leaderboard[id].Authorized = level;

    // Uploads the updated JSON Leaderboard
    uploadJSON(message);
    message.reply("Authorized " + leaderboard[id].Name);
    console.log("Authorized " + leaderboard[id].Name + " at level " + level);
}

function nameUser(name, id, message) {
    // If the user isn't in the leaderboard, warns user
    if (!leaderboard[id]) {
        message.reply("User <@" + id + "> isn't in the leaderboard");
        return;
    }

    // Links ID to name
    leaderboard[id].Name = name;

    // Uploads the updated JSON Leaderboard
    uploadJSON(message);
    message.reply("Renamed <@" + id + " to " + name);
}

async function addScores(authorized, demos, exterms, name, id, interaction) {
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
        if (demos, 10 > parseInt(highscores.leaderDemos, 10)) {
            await interaction.reply("Congrats on the top place for Demos! " +
                "Please send proof to an admin before we can verify your spot.");
            return;
        }
        if (exterms > parseInt(highscores.leaderExterm, 10)) {
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
    uploadFiles("\n\"" + name + "\"," + demos + "," + exterms, interaction);
    await interaction.reply("<@" + id + "> has " + demos + " demos and " + exterms + " exterms");
}

// Writes and uploads CSV leaderboard file to Dropbox
function uploadCSV(message, content) {
    writeCSV(message, content)
        .then(result => {
            //console.log(result);
            fs.readFile("leaderboard.csv", function (err, data) {
                if (err) {
                    message.channel.send("Failed to read and upload CSV leaderboard. Try again later");
                    throw err;
                }
                // console.log(data.toString());
                dbx.filesUpload({path: '/leaderboard.csv', contents: data, mode: "overwrite"})
                    .catch(function (error) {
                        message.channel.send("Dropbox error for CSV. Try same command again");
                        console.error(error);
                    })
            });
        });

    console.log("Uploaded CSV");
    message.channel.send("Uploaded Leaderboard. You can find the live stats here: https://demolition-leaderboard.netlify.app/");
}

// writes the CSV file leaderboard
// is async to ensure file is written before uploading
async function writeCSV(message, content) {
    fs.appendFileSync("leaderboard.csv", content, (err) => {
        if (err) {
            message.channel.send("Failed to write to leaderboard CSV. Try again later");
            throw err;
        }
        console.log('Appended CSV');
    });
}

// uploads the JSON file leaderboard to Dropbox
function uploadJSON(message) {
    dbx.filesUpload({path: '/leaderboard.json', contents: JSON.stringify(leaderboard, null, "\t"), mode: "overwrite"})
        .catch(function (error) {
            message.channel.send("Dropbox error for JSON Leaderboard. Try same command again");
            console.error(error);
        });

    console.log("Uploaded leaderboard JSON");
}

// uploads the JSON file high scores to Dropbox
function uploadHighScores(message) {
    dbx.filesUpload({path: '/highscores.json', contents: JSON.stringify(highscores, null, "\t"), mode: "overwrite"})
        .catch(function (error) {
            message.channel.send("Dropbox error for highscores. Try same command again");
            console.error(error);
        });

    console.log("Uploaded highscores");
}

process.on('unhandledRejection', function(err) {
    console.log(err);
});

// Logs into Discord
client.login(config.discordToken).catch(function (err) {
    console.log(err);
});
