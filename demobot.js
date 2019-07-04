const Discord = require("discord.js");
const client = new Discord.Client();
// const config = require("./config.json");
const leaderboard = require("./leaderboard.json");
const highscores = require("./highscores.json");
const fs = require('fs');
const fetch = require('isomorphic-fetch');
const Dropbox = require('dropbox').Dropbox;
let dbx = new Dropbox({accessToken: process.env.dropToken, fetch: fetch});



client.on("ready", () => {
    dbx.filesDownload({path: "/leaderboard.json"})
        .then(function (data) {
            fs.writeFile("./leaderboard.json", data.fileBinary, 'binary', function (err) {
                if (err) { throw err; }
                console.log('File: ' + data.name + ' saved.');
            });
        })
        .catch(function (err) {
            throw err;
        });
    console.log("I am ready!");
});

client.on("message", message => {
    if (message.channel.equals("431088274636013579")) console.log("wrong channel error");
    if (message.author.bot) return;
    if(message.content.indexOf(process.env.prefix) !== 0) return;
    // This is the best way to define args. Trust me.
    const args = message.content.slice(process.env.prefix.length).trim().split(/ +/g);
    console.log(args);
    if (args.length < 4 || args.length > 8) {
        message.channel.send("Try updating your stats with the following format: D: # of demos " +
            "E: # of exterminations Your Username\n Ex: D: 200 E: 10 Demo Leaderboard");
    } else if (isNaN(args[0]) || isNaN(args[2])) {
        message.channel.send("Try updating your stats with the following format: D: # of demos " +
            "E: # of exterminations Your Username\n Ex: D: 200 E: 10 Demo Leaderboard");
    } else {
        // Sets name variable for long names
        let name = "";
        if (args.length > 4) {
            for (let i = 3; i < args.length; i++) {
                name = name + " " + args[i];
            }
        } else {
            name = args[3];
        }

        console.log(leaderboard.hasOwnProperty(name));
        console.log(leaderboard[name]);

        let author = message.author.id;

        if (!leaderboard[name]) {
            leaderboard[name] = {Authorized: 0, Discord: "", Demos: 0, Exterminations: 0};
        }
        if (!leaderboard[name].Discord) {
            leaderboard[name].Discord = author;
        }
        if (leaderboard[name].Discord == author) {
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
                }
            }
            if (author != leaderboard.toothboto.Discord) {
                if (parseInt(args[0], 10) > parseInt(highscores.leaderDemos, 10)) {
                    message.channel.send("Congrats on the top place for Demos! " +
                        "Please send verification to an admin before we can verify your spot.");
                }  else if (parseInt(args[2], 10) > parseInt(highscores.leaderExterm, 10))  {
                    message.channel.send("Congrats on the top place for Exterminations! " +
                        "Please send verification to an admin before we can verify your spot.");
                }
            }

            leaderboard[name].Demos = args[0];
            leaderboard[name].Exterminations = args[2];
        } else {
            message.channel.send("Cannot update leaderboard for other users, " +
                "Please DM JerryTheBee if something is wrong");
        }

        fs.writeFile("leaderboard.json", JSON.stringify(leaderboard));

        let content = "\n" + name + "," + args[0] + "," + args[2];

        fs.appendFile("leaderboard.csv", content);

        dbx.filesUpload({path: '/leaderboard.json', contents: JSON.stringify(leaderboard), mode: "overwrite"})
            .catch(function(error) {
                console.error(error);
            });
    }
});

client.login(process.env.token);