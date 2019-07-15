const Discord = require("discord.js");
const client = new Discord.Client();
// const config = require("./config.json"); // For local Testing only
let leaderboard;
let idmap;
const highscores = require("./highscores.json");
const fs = require('fs');
const fetch = require('isomorphic-fetch');
const Dropbox = require('dropbox').Dropbox;
const http = require('http');
let dbx = new Dropbox({accessToken: process.env.dropToken, fetch: fetch});
let failedDownload = false;



client.on("ready", () => {
    // downloads updated files from dropbox
    download();

    // No longer necessary for worker dyno

    // // connects to server to please heroku
    // http.createServer().listen(process.env.PORT, function () {
    //     console.log('Express server listening on' + process.env.PORT);
    // });
    // console.log("I am ready!");
    // // keeps awake
    // setInterval(function() {
    //     http.get("http://demo-leaderboard.herokuapp.com/");
    // }, 300000);
});

// when the bot sees a message
client.on("message", message => {
    // Ignores messages from bots to stop abuse
    if (message.author.bot) return;
    // Ensures the message starts with the prefix "D:"
    if(message.content.indexOf(process.env.prefix) !== 0) return;
    // Defines args
    const args = message.content.slice(process.env.prefix.length).trim().split(/ +/g);
    if (failedDownload) {
        download();
    }
    if (failedDownload) {
        message.channel.send("Failed to connect to dropbox. Try again in a couple minutes");
        return;
    }
    // Saves author id to verify identity
    let author = message.author.id;
    // Allows creator to authorize top 20 users to post their scores
    // Syntax :
    //  D: Authorize DiscordID Name
    if (author == leaderboard.Car.Discord && args[0] == "Authorize") {
        let name = "";
        if (args.length > 3) {
            name = args[2];
            for (let i = 3; i < args.length; i++) {
                name = name + " " + args[i];
            }
        } else {
            name = args[2];
        }
        console.log(name);
        leaderboard[name].Discord = args[1];
        leaderboard[name].Authorized = 1;
        idmap[args[1]] = name;
        upload(message);
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

        let name = args[3];
        // Sets name variable for long names with multiple spaces
        // One word names are left alone
        if (args.length > 4) {
            for (let i = 4; i < args.length; i++) {
                name = name + " " + args[i];
            }
        }

        // console.log(leaderboard.hasOwnProperty(name));
        console.log(leaderboard[name]);

        // Keeps track to ensure the leaderboard has to be updated in dropbox
        let changed = false;
        let updatedLeaderboard = false;

        if (name != null) {
            // If the leaderboard doesn't include the name, adds it
            if (!leaderboard[name]) {
                leaderboard[name] = {Authorized: 0, Discord: "", Demos: 0, Exterminations: 0};
                changed = true;
            }

            // If the leaderboard doesn't have a discord ID attached, adds it
            if (!leaderboard[name].Discord) {
                leaderboard[name].Discord = author;
                changed = true;
            }

            // If the ID map doesn't have a name attached, adds it
            if (!idmap[author]) {
                idmap[author] = name;
                changed = true;
            }
        } else {
            // if the idmap doesn't include this discord ID and no name was given, returns
            if (!idmap[author]) {
                message.channel.send("Account isn't mapped to a name, try again including a name");
                return;
            }
        }

        // Backdoor for creator to upload any data
        // Useful for Reddit users and manual changes
        if (author == leaderboard.Car.Discord) {
            if (name == null) {
                if (idmap[author]) {
                    name = idmap[author];
                }
            }
            leaderboard[name].Demos = args[0];
            leaderboard[name].Exterminations = args[2];
            updatedLeaderboard = true;
            changed = true;

        // Ensures only the Discord ID associated with a score can change their data
        } else {
            if (idmap[author]) {
                name = idmap[author];
            } else {
                message.channel.send("Account isn't mapped to a name, try again including a name");
                return;
            }
            if (leaderboard[name].Discord == author) {
                // Only authorized users can upload top 20 scores
                // Needs creator permission to do so
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
                        changed = true;
                    }
                // Checks against the top score
                // Only user authorized to update the top score is the record holder toothboto
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
                        changed = true;
                    }
                // Toothboto gets to upload top score
                } else {
                    leaderboard[name].Demos = args[0];
                    leaderboard[name].Exterminations = args[2];
                    updatedLeaderboard = true;
                    changed = true;
                }
            // Messages if the account is registered to another player
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

        // If changed, uploads changes
        if (changed) {
            if (updatedLeaderboard) {
                let content = "\n" + name + "," + args[0] + "," + args[2];

                // Adds to running CSV, which works better with R Shiny site
                fs.appendFile("leaderboard.csv", content, (err) => {
                    if (err) {
                        message.channel.send("Failed to write to leaderboard CSV. Try again later");
                        throw err;
                    }
                    console.log('Appended CSV');
                });
            }

            upload(message);
        }
    }
});

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


// Uploads updated files to Dropbox
function upload(message) {
    if (failedDownload) {
        download()
    }

    if (failedDownload) {
        message.channel.send("Failed to sync with dropbox. Try again later \n@JerryTheBee");
    } else {
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
                });
        });

        console.log("Uploaded CSV");

        dbx.filesUpload({path: '/leaderboard.json', contents: JSON.stringify(leaderboard), mode: "overwrite"})
            .catch(function (error) {
                message.channel.send("Failed to upload JSON leaderboard. Try again later");
                console.error(error);
            });

        console.log("Uploaded leaderboard JSON");

        dbx.filesUpload({path: '/idmap.json', contents: JSON.stringify(idmap), mode: "overwrite"})
            .catch(function (error) {
                message.channel.send("Failed to upload ID mapping. Try again later");
                console.error(error);
            });

        console.log("Uploaded idmap JSON");

        message.channel.send("Updated Leaderboard!");
    }
}

// Logs into Discord
client.login(process.env.token);