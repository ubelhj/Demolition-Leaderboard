const Discord = require("discord.js");
const client = new Discord.Client();
const config = require("./config.json"); // For local Testing only
let leaderboard;
let idmap;
// holds discord IDs of authorized moderators
const mods = require("./moderators.json");
const highscores = require("./highscores.json");
const fs = require('fs');
const fetch = require('isomorphic-fetch');
const Dropbox = require('dropbox').Dropbox;
//let dbx = new Dropbox({accessToken: process.env.dropToken, fetch: fetch}); // for heroku usage
let dbx = new Dropbox({accessToken: config.dropToken, fetch: fetch}); // for local testing
let failedDownload = false;


// On startup downloads files from Dropbox to keep continuity across sessions
client.on("ready", () => {
    download();
});

// when the bot sees a message, begins running leaderboard update
client.on("message", message => {
    // Ignores messages from bots to stop abuse
    if (message.author.bot) return;

    // Ensures the message starts with the prefix "D:"
    //if(message.content.indexOf(process.env.prefix) !== 0) return; // for heroku usage
    if (message.content.indexOf(config.prefix) !== 0) return; // for local testing

    // Defines args
    //const args = message.content.slice(process.env.prefix.length).trim().split(/ +/g); // for heroku usage
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g); // for local testing

    // if the previous download failed, tries again
    if (failedDownload) {
        download();
    }

    // if two in a row have failed, gives up and warns user
    // Prevents overwriting of data with old data
    if (failedDownload) {
        message.channel.send("Failed to connect to dropbox. Try again in a couple minutes");
        return;
    }

    // Uses author Discord id to verify identity
    // Discord gives every user an 18 digit identifier that cannot be duplicated
    let author = message.author.id;

    // Allows creator or moderators to authorize users to post their scores
    // Unauthorized users cannot upload scores >15000 demos and/or 500 exterms
    // Syntax :
    //  D: Authorize DiscordID Name
    if (args[0] === "Authorize") {
        if (mods[author]) {
            authorize(args, message);
            return;
        } else {
            message.channel.send("Only moderators can authorize users");
            return;
        }
    }
    // Allows creator or moderators to set names of users
    if (args[0] === "Name") {
        if (mods[author]) {
            nameUser(args, message);
            return;
        } else {
            message.channel.send("Only moderators can rename users");
            return;
        }
    }

    if (args[0] === "Top") {
        if (mods[author]) {
            topScore(args, message);
            return;
        } else {
            message.channel.send("Only moderators can set top scores");
            return;
        }
    }
    // Ensures proper command syntax
    // Prevents short commands from messing up data
    if (args.length < 3) {
        message.channel.send("Try updating your stats with the following format: " +
            "D: # of demos E: # of exterminations Your Username\nEx: ```D: 2000 E: 1000 Demo Leaderboard```\n" +
            "You must include both demos and exterminations");
        return;
    }

    // Prevents long commands that probably are people talking about other things
    if (args.length > 8) {
        message.channel.send("Try updating your stats with the following format: " +
            "D: # of demos E: # of exterminations Your Username\nEx: ```D: 2000 E: 1000 Demo Leaderboard```\n" +
            "Names over 5 words long are not accepted");
        return;
    }
    // Ensures the Demolition and Exterminator counts are numbers and no commas are used
    if (isNaN(args[0]) || isNaN(args[2])) {
        message.channel.send("Try updating your stats with the following format : " +
            "D: # of demos E: # of exterminations Your Username\nEx: ```D: 2000 E: 1000 Demo Leaderboard```\n" +
            "Ensure there are spaces between each word and there are no commas");
        return;
    }

    // Defines user's name
    let name = args[3];
    // Sets name variable for long names with multiple spaces
    // One word names are left alone
    if (args.length > 4) {
        for (let i = 4; i < args.length; i++) {
            name = name + " " + args[i];
        }
    }

    console.log(leaderboard[name]);

    // if there's a name, sets it, else tells user to include name
    if (name != null) {
        // changed JSON keeps track of if the JSON has been changed
        let changedJSON = false;

        // If the leaderboard doesn't include the name, adds it
        if (!leaderboard[name]) {
            leaderboard[name] = {Authorized: 0, Discord: "", Demos: 0, Exterminations: 0};
            changedJSON = true;
        }

        // If the leaderboard doesn't have a discord ID attached, adds it
        if (!leaderboard[name].Discord) {
            leaderboard[name].Discord = author;
            changedJSON = true;
        }

        if (leaderboard[name].Discord !== author) {
            message.channel.send("That name is already taken, please try another");
            return;
        }

        // If the ID map doesn't have a name attached, adds it
        if (!idmap[author]) {
            idmap[author] = name;
            uploadIdMap(message);
        }

        if (changedJSON) {
            uploadJSON(message);
        }
    } else {
        // if the idmap doesn't include this discord ID and no name was given, returns and warns user
        if (!idmap[author]) {
            message.channel.send("Account isn't mapped to a name, try again including a name");
            return;
        }
    }

    // Backdoor for moderator to upload any data
    // Useful for Reddit users and manual changes
    if (mods[author]) {
        // for null name, updates creator's score
        if (name == null) {
            if (idmap[author]) {
                name = idmap[author];
            }
        }
        leaderboard[name].Demos = args[0];
        leaderboard[name].Exterminations = args[2];
        uploadFiles("\n\"" + name + "\"," + args[0] + "," + args[2], message);
        return;
    }

    // If there is a name mapped to the user's ID, updates that user's stats
    // Otherwise warns user to use a name
    // Should not be reached but ensures quality of data
    if (idmap[author]) {
        name = idmap[author];
    } else {
        message.channel.send("Account isn't mapped to a name, try again including a name");
        return;
    }

    // Ensures user can only change their score
    // Warns user if the account is registered to another player
    // should be unreachable but this is to make sure
    if (leaderboard[name].Discord !== author) {
        message.channel.send("Cannot update leaderboard for other users, " +
            "Please DM JerryTheBee if something is wrong");
        return;
    }

    addScores(leaderboard[name].Authorized, args, name, message);
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

    if (failedDownload) {
        console.log("failed download");
    }
}

function authorize(args, message) {
    // defines the user's name
    let name = args[2];
    if (args.length > 3) {
        for (let i = 3; i < args.length; i++) {
            name = name + " " + args[i];
        }
    }
    console.log(name);

    // If the user isn't in the leaderboard, adds them
    if (!leaderboard[name]) {
        leaderboard[name] = {Authorized: 0, Discord: "", Demos: 0, Exterminations: 0};
    }

    // Links ID to score and authorizes
    leaderboard[name].Discord = args[1];
    leaderboard[name].Authorized = 1;

    // Changes ID map to allow name changes of authorized users
    idmap[args[1]] = name;
    uploadIdMap(message);

    // Uploads the updated JSON Leaderboard
    uploadJSON(message);
    message.channel.send("Authorized " + name);
    console.log("Authorized " + name);
}

function nameUser(args, message) {
    // defines the user's name
    let name = args[2];
    if (args.length > 3) {
        for (let i = 3; i < args.length; i++) {
            name = name + " " + args[i];
        }
    }
    console.log(name);

    // If the user isn't in the leaderboard, adds them
    if (!leaderboard[name]) {
        leaderboard[name] = {Authorized: 0, Discord: "", Demos: 0, Exterminations: 0};
    }

    // Links ID to score and doesn't authorize
    leaderboard[name].Discord = args[1];

    // Changes ID mapping of user to give a new name
    idmap[args[1]] = name;
    uploadIdMap(message);

    // Uploads the updated JSON Leaderboard
    uploadJSON(message);
    message.channel.send("Renamed " + name);
    console.log("Renamed " + name);
}

function topScore(args, message) {
    // defines the user's name
    let name = args[2];
    if (args.length > 3) {
        for (let i = 3; i < args.length; i++) {
            name = name + " " + args[i];
        }
    }
    console.log(name);

    // If the user isn't in the leaderboard, adds them
    if (!leaderboard[name]) {
        leaderboard[name] = {Authorized: 0, Discord: "", Demos: 0, Exterminations: 0};
    }

    // Links ID to score and authorizes
    leaderboard[name].Discord = args[1];
    leaderboard[name].Authorized = 2;

    // Changes ID map to allow name changes of authorized users
    if(!idmap[args[1]] === name) {
        idmap[args[1]] = name;
        uploadIdMap(message);
    }

    // Uploads the updated JSON Leaderboard
    uploadJSON(message);
    message.channel.send(name + " can now post top scores");
    console.log("Top score authorized " + name);
}

function addScores(authorized, args, name, message) {
    // Only authorized users can upload scores with >15000 demos and/or >500 exterms
    // Needs permission to do so
    if (authorized === 0) {
        if (parseInt(args[0], 10) > 15000) {
            message.channel.send("Congratulations, you have over 15k Demolitions! " +
                "New submissions with high scores require manual review from an admin. " +
                "Please send a screenshot of your stats to this channel or an admin. If you have any " +
                "questions, please contact an admin or JerryTheBee");
            return;
        }

        if (parseInt(args[2], 10) > 500) {
            message.channel.send("Congratulations, you have over 500 Exterminations! " +
                "New submissions with high scores require manual review from an admin. " +
                "Please send a screenshot of your stats to this channel or an admin. If you have any " +
                "questions, please contact an admin or JerryTheBee");
            return;
        }
    }

    if (authorized === 1) {
        // Checks against the top score
        // Only users authorized to update the top score are allowed to
        // Prevents abuse by authorized users
        if (parseInt(args[0], 10) > parseInt(highscores.leaderDemos, 10)) {
            message.channel.send("Congrats on the top place for Demos! " +
                "Please send verification to an admin before we can verify your spot.");
            return;
        }
        if (parseInt(args[2], 10) > parseInt(highscores.leaderExterm, 10)) {
            message.channel.send("Congrats on the top place for Exterminations! " +
                "Please send verification to an admin before we can verify your spot.");
            // Authorized users can update scores lower than the top spot
            return;
        }
    }

    if (authorized === 2) {
        highscores.leaderDemos = args[0];
        highscores.leaderExterm = args[2];
    }

    leaderboard[name].Demos = args[0];
    leaderboard[name].Exterminations = args[2];
    uploadFiles("\n\"" + name + "\"," + args[0] + "," + args[2], message);
}

// Writes and uploads CSV leaderboard file to Dropbox
function uploadCSV(message, content) {
    writeCSV(message, content)
        .then(result => {
            console.log(result);
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

// Logs into Discord
//client.login(process.env.token); // for heroku use

client.login(config.discordToken);  // for local testing
