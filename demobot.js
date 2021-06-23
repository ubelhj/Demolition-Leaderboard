const Discord = require("discord.js");
const client = new Discord.Client({ intents: ['GUILDS', 'GUILD_MESSAGES'] });
const config = require("./config.json"); // For local Testing only
//const config = process.env; // for heroku usage

// hold jsons
let leaderboard;
let idmap;
let highscores;

// holds discord IDs of authorized moderators
const mods = require("./moderators.json");

const fs = require('fs');
const fetch = require('isomorphic-fetch');
const Dropbox = require('dropbox').Dropbox;
const Jimp = require("jimp");
let dbx = new Dropbox({accessToken: config.dropToken, fetch: fetch});
let failedDownload = false;


// On startup downloads files from Dropbox to keep continuity across sessions
client.on("ready", () => {
    download();
});

// when the bot sees a message, begins running leaderboard update
client.on("message", async message => {
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

        console.log("Deployed slash commands");
    }
});

client.on('interaction', async interaction => {
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
            // changed JSON keeps track of if the JSON has been changed
            let changedJSON = false;
    
            // If the leaderboard doesn't include the name, adds it
            if (!leaderboard[name]) {
                leaderboard[name] = {Authorized: 0, Discord: "", Demos: 0, Exterminations: 0};
                changedJSON = true;
            }

            if (mods[author]) {
                leaderboard[name].Demos = demos;
                leaderboard[name].Exterminations = exterms;
                uploadFiles("\n\"" + name + "\"," + demos + "," + exterms, interaction);
                await interaction.reply("Overriden the score of user " + name);
                return;
            }
    
            // If the leaderboard doesn't have a discord ID attached, adds it
            if (!leaderboard[name].Discord) {
                leaderboard[name].Discord = author;
                changedJSON = true;
            }
    
            if (leaderboard[name].Discord !== author) {
                await interaction.reply("That name is already taken, please try another");
                return;
            }
    
            // If the ID map doesn't have a name attached, adds it
            if (!idmap[author]) {
                idmap[author] = name;
                uploadIdMap(interaction);
            }
    
            if (changedJSON) {
                uploadJSON(interaction);
            }
        } else {
            // if the idmap doesn't include this discord ID and no name was given, returns and warns user
            if (!idmap[author]) {
                await interaction.reply("Account isn't mapped to a name, try again including a name");
                return;
            }
        }

        // If there is a name mapped to the user's ID, updates that user's stats
        // Otherwise warns user to use a name
        // Should not be reached but ensures quality of data
        if (idmap[author]) {
            name = idmap[author];
        } else {
            await interaction.reply("Account isn't mapped to a name, try again including a name");
            return;
        }

        // Ensures user can only change their score
        // Warns user if the account is registered to another player
        // should be unreachable but this is to make sure
        if (leaderboard[name].Discord !== author) {
            interaction.channel.send("Cannot update leaderboard for other users, " +
                "Please DM JerryTheBee if something is wrong");
            return;
        }

        addScores(leaderboard[name].Authorized, demos, exterms, name, interaction);

        //console.log(interaction.user.id);
    }

    if (interaction.commandName === 'authorize') {
        // Allows moderators to authorize users to post their scores
        // Unauthorized users cannot upload scores >15000 demos and/or 500 exterms
        const user = interaction.options.get('user').value;
        const level = interaction.options.get('level').value;

        let author = interaction.user.id;

        if (!mods[author]) {
            await interaction.reply({content: "Only mods can use this command", ephemeral: true});
            return;
        }

        // if the idmap doesn't include this discord ID and no name was given, returns and warns user
        if (!idmap[user]) {
            await interaction.reply({content:"User isn't mapped to a name", ephemeral: true});
            return;
        } 

        //interaction.channel.send("mod " + author + " is authorizing user " + user + " aka " + name);

        authorize(idmap[user], user, level, interaction);
    }

    if (interaction.commandName === 'name') {
        // Allows moderators to rename users
        const user = interaction.options.get('user').value;
        const name = interaction.options.get('name').value;

        let author = interaction.user.id;

        if (!mods[author]) {
            await interaction.reply({content: "Only mods can use this command", ephemeral: true});
            return;
        }

        nameUser(name, user, interaction);
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
    // Maps Discord IDs to names to prevent duplicates
    dbx.filesDownload({path: "/idmap.json"})
        .then(function (data) {
            fs.writeFile("./idmap.json", data.fileBinary, 'binary', function (err) {
                if (err) {
                    failedDownload = true;
                    throw err;
                }
                console.log('File: ' + data.name + ' saved.');
                idmap = require("./idmap");
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

function authorize(name, id, level, message) {
    // If the user isn't in the leaderboard, adds them
    if (!leaderboard[name]) {
        leaderboard[name] = {Authorized: 0, Discord: "", Demos: 0, Exterminations: 0};
    }

    // Links ID to score and authorizes
    leaderboard[name].Discord = id;
    leaderboard[name].Authorized = level;

    // Changes ID map to allow name changes of authorized users
    idmap[id] = name;
    uploadIdMap(message);

    // Uploads the updated JSON Leaderboard
    uploadJSON(message);
    message.reply("Authorized " + name);
    console.log("Authorized " + name + " at level " + level);
}

function nameUser(name, id, message) {
    //console.log(name);

    let oldAuth = 0;
    if (idmap[id] && leaderboard[idmap[id]]) {
        oldAuth = leaderboard[idmap[id]].Authorized;
    }

    // If the user isn't in the leaderboard, adds them
    if (!leaderboard[name]) {
        leaderboard[name] = {Authorized: 0, Discord: "", Demos: 0, Exterminations: 0};
    }

    // Links ID to score and doesn't authorize
    leaderboard[name].Discord = id;
    leaderboard[name].Authorized = oldAuth;

    // Changes ID mapping of user to give a new name
    idmap[id] = name;
    uploadIdMap(message);

    // Uploads the updated JSON Leaderboard
    uploadJSON(message);
    message.reply("Renamed " + name);
    //console.log("Renamed " + name);
    //console.log(leaderboard[name]);
}

async function addScores(authorized, demos, exterms, name, interaction) {
    // Only authorized users can upload scores with >15000 demos and/or >500 exterms
    // Needs permission to do so
    if (authorized === 0) {
        if (demos > 15000) {
            await interaction.reply("Congratulations, you have over 15k Demolitions! " +
                "New submissions with high scores require manual review from an admin. " +
                "Please send a screenshot of your stats to this channel. If you have any " +
                "questions, please contact an admin or JerryTheBee");
            return;
        }

        if (exterms > 500) {
            await interaction.reply("Congratulations, you have over 500 Exterminations! " +
                "New submissions with high scores require manual review from an admin. " +
                "Please send a screenshot of your stats to this channel. If you have any " +
                "questions, please contact an admin or JerryTheBee");
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

    if (authorized === 2) {
        highscores.leaderDemos = demos;
        highscores.leaderExterm = exterms;
        uploadHighScores();
    }

    if (Math.floor(leaderboard[name].Demos / 10000) < Math.floor(demos / 10000)) {
        interaction.channel.send("Congratulations on a " + Math.floor(demos / 10000) + "0,000 demolition milestone!");
    }

    if (Math.floor(leaderboard[name].Exterminations / 1000) < Math.floor(exterms / 1000)) {
        interaction.channel.send("Congratulations on a " + Math.floor(exterms / 1000) + ",000 extermination milestone!");
    }

    leaderboard[name].Demos = demos;
    leaderboard[name].Exterminations = exterms;
    uploadFiles("\n\"" + name + "\"," + demos + "," + exterms, interaction);
    await interaction.reply("<@" + interaction.user.id + "> has " + demos + " demos and " + exterms + " exterms");
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
    message.channel.send("Uploaded Leaderboard. You can find the live stats here: https://ubelhj.shinyapps.io/demobotR/");
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

// uploads the ID mapping JSON file to Dropbox
function uploadIdMap(message) {
    dbx.filesUpload({path: '/idmap.json', contents: JSON.stringify(idmap), mode: "overwrite"})
        .catch(function (error) {
            message.channel.send("Dropbox error for id map. Try same command again");
            console.error(error);
        });

    message.channel.send("Updated ID Map");
    console.log("Uploaded idmap JSON");
}

// uploads the JSON file leaderboard to Dropbox
function uploadJSON(message) {
    dbx.filesUpload({path: '/leaderboard.json', contents: JSON.stringify(leaderboard), mode: "overwrite"})
        .catch(function (error) {
            message.channel.send("Dropbox error for JSON Leaderboard. Try same command again");
            console.error(error);
        });

    console.log("Uploaded leaderboard JSON");
}

// uploads the JSON file leaderboard to Dropbox
function uploadHighScores(message) {
    dbx.filesUpload({path: '/highscores.json', contents: JSON.stringify(highscores), mode: "overwrite"})
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
