const Discord = require("discord.js");
const client = new Discord.Client();
// const config = require("./config.json"); // For local Testing only
let leaderboard;
let idmap;
const highscores = require("./highscores.json");
const fs = require('fs');
const fetch = require('isomorphic-fetch');
const Dropbox = require('dropbox').Dropbox;
let dbx = new Dropbox({accessToken: process.env.dropToken, fetch: fetch}); // for heroku usage
// let dbx = new Dropbox({accessToken: config.dropToken, fetch: fetch}); // for local testing
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
    if(message.content.indexOf(process.env.prefix) !== 0) return; // for heroku usage
    // if(message.content.indexOf(config.prefix) !== 0) return; // for local testing

    // Defines args
    const args = message.content.slice(process.env.prefix.length).trim().split(/ +/g); // for heroku usage
    // const args = message.content.slice(config.prefix.length).trim().split(/ +/g); // for local testing

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

    // Allows creator to authorize top 20 users to post their scores
    // Unauthorized users cannot upload scores
    // Syntax :
    //  D: Authorize DiscordID Name
    if (author == leaderboard.Car.Discord && args[0] == "Authorize") {

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

        // If the ID to name map doesn't include the current ID, adds them to the map
        if (!idmap[args[1]]) {
            idmap[args[1]] = name;
            uploadIdMap(message);
        }

        // Uploads the updated JSON Leaderboard
        uploadJSON(message);
        message.channel.send("Authorized " + name);
        console.log("Authorized " + name);

    // Ensures proper command syntax
    // Prevents short or long commands from messing up data
    } else if (args.length < 3 || args.length > 8) {
        message.channel.send("Try updating your stats with the following format: D: # of demos " +
            "E: # of exterminations Your Username\n Ex: D: 200 E: 10 Demo Leaderboard");

    // Ensures the Demolition and Exterminator counts are numbers
    } else if (isNaN(parseInt(args[0])) || isNaN(parseInt(args[2]))) {
        message.channel.send("Try updating your stats with the following format: D: # of demos " +
            "E: # of exterminations Your Username\n Ex: D: 200 E: 10 Demo Leaderboard");

    // Updates leaderboard if the command is correct
    } else {
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

        // Keeps track to ensure the leaderboard has to be updated in dropbox

        // changed JSON keeps track of if the JSON has been changed
        let changedJSON = false;
        // updatedLeaderboard keeps track of if a new valid score has been uploaded
        //      if so it also assumes the JSON needs to be uploaded as well
        let updatedLeaderboard = false;

        if (name != null) {
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

            // If the ID map doesn't have a name attached, adds it
            if (!idmap[author]) {
                idmap[author] = name;
                uploadIdMap(message);
            }
        } else {
            // if the idmap doesn't include this discord ID and no name was given, returns and warns user
            if (!idmap[author]) {
                message.channel.send("Account isn't mapped to a name, try again including a name");
                return;
            }
        }

        // Backdoor for creator to upload any data
        // Useful for Reddit users and manual changes
        if (author == leaderboard.Car.Discord) {
            // for null name, updates creator's score
            if (name == null) {
                if (idmap[author]) {
                    name = idmap[author];
                }
            }
            leaderboard[name].Demos = args[0];
            leaderboard[name].Exterminations = args[2];
            updatedLeaderboard = true;

        // Updates leaderboard
        } else {
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
            if (leaderboard[name].Discord == author) {
                // Only authorized users can upload top 20 scores
                // Needs permission to do so
                if (leaderboard[name].Authorized == 0) {
                    if (parseInt(args[0], 10) > parseInt(highscores.manualDemoLimit, 10)) {
                        message.channel.send("Congratulations, your stats qualify for a top 20 position! " +
                            "(A top 20 submission requires manual review from an admin and consequently may take " +
                            "longer to be accepted). A screenshot may be requested if your submission is suspect or " +
                            "results in a significant change in position. If you have any questions, " +
                            "please contact an admin or JerryTheBee");
                    } else if (parseInt(args[2], 10) > parseInt(highscores.manualExtermLimit, 10)) {
                        message.channel.send("Congratulations, your stats qualify for a top 20 position! " +
                            "(A top 20 submission requires manual review from an admin and consequently may take " +
                            "longer to be accepted). A screenshot may be requested if your submission is suspect or " +
                            "results in a significant change in position. If you have any questions, " +
                            "please contact an admin or JerryTheBee");
                    // Non top 20 scores from unauthorized users are allowed
                    // Allows new members to add themselves
                    } else {
                        leaderboard[name].Demos = args[0];
                        leaderboard[name].Exterminations = args[2];
                        updatedLeaderboard = true;
                    }
                // Checks against the top score
                // Only user authorized to update the top score is the record holder toothboto
                // Prevents abuse by authorized top 20 users
                } else if (author != leaderboard.toothboto.Discord) {
                    if (parseInt(args[0], 10) > parseInt(highscores.leaderDemos, 10)) {
                        message.channel.send("Congrats on the top place for Demos! " +
                            "Please send verification to an admin before we can verify your spot.");
                    } else if (parseInt(args[2], 10) > parseInt(highscores.leaderExterm, 10)) {
                        message.channel.send("Congrats on the top place for Exterminations! " +
                            "Please send verification to an admin before we can verify your spot.");
                        // Authorized users can update scores lower than the top spot
                    } else {
                        leaderboard[name].Demos = args[0];
                        leaderboard[name].Exterminations = args[2];
                        updatedLeaderboard = true;
                    }
                // Toothboto is allowed to upload top score
                } else {
                    leaderboard[name].Demos = args[0];
                    leaderboard[name].Exterminations = args[2];
                    updatedLeaderboard = true;
                }
            // Warns user if the account is registered to another player
            } else {
                message.channel.send("Cannot update leaderboard for other users, " +
                    "Please DM JerryTheBee if something is wrong");
            }
        }

        // First two saves only for local testing

        // Saves the leaderboard in a JSON, accessible by player name
        // fs.writeFile("leaderboard.json", JSON.stringify(leaderboard), (err) => {
        //     if (err) throw err;
        //     console.log('Wrote Json');
        // });

        // Saves the map of Discord IDs to player names
        // fs.writeFile("idmap.json", JSON.stringify(idmap), (err) => {
        //     if (err) throw err;
        //     console.log('Wrote Map');
        // });

        // If the leaderboard scores have been updated, uploads it
        if (updatedLeaderboard) {
            // Adds to running CSV, which works better with R Shiny site
            // Has format: name, demolitions, exterminations
            uploadCSV(message, " \n\"" + name + "\"," + args[0] + "," + args[2]);
            uploadJSON(message);
        // if only the JSON Leaderboard has been updated, just uploads that file
        } else if (changedJSON) {
            uploadJSON(message);
        }
    }
});

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
                        message.channel.send("Failed to upload CSV leaderboard. Try again later");
                        console.error(error);
                    })
            });
        });

    console.log("Uploaded CSV");
    message.channel.send("Uploaded Leaderboard");
}

// writes the CSV file leaderboard
// is async to ensure file is written before uploading
async function writeCSV(message, content) {
    fs.appendFile("leaderboard.csv", content, (err) => {
        if (err) {
            message.channel.send("Failed to write to leaderboard CSV. Try again later");
            throw err;
        }
        console.log('Appended CSV');
    });

    return 1;
}

// uploads the ID mapping JSON file to Dropbox
function uploadIdMap(message) {
    dbx.filesUpload({path: '/idmap.json', contents: JSON.stringify(idmap), mode: "overwrite"})
        .catch(function (error) {
            message.channel.send("Failed to upload ID mapping. Try again later");
            console.error(error);
        });

    message.channel.send("Updated ID Map");
    console.log("Uploaded idmap JSON");
}

// uploads the JSON file leaderboard to Dropbox
function uploadJSON(message) {
    dbx.filesUpload({path: '/leaderboard.json', contents: JSON.stringify(leaderboard), mode: "overwrite"})
        .catch(function (error) {
            message.channel.send("Failed to upload JSON leaderboard. Try again later");
            console.error(error);
        });

    console.log("Uploaded leaderboard JSON");
}

// Logs into Discord
client.login(process.env.token); // for heroku use

// client.login(config.discordToken);  // for local testing