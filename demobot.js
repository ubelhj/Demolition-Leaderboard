const Discord = require("discord.js");
const client = new Discord.Client();
const config = require("./config.json");
const highscores = require("./highscores.json");
const fs = require('fs');

client.on("ready", () => {
    console.log("I am ready!");
});

client.on("message", message => {
    if (message.channel.equals("596091609955958785")) console.log("wrong channel error");
    if (message.author.bot) return;
    if(message.content.indexOf(config.prefix) !== 0) return;
    // This is the best way to define args. Trust me.
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    console.log(args);
    if (args.length < 5 || args.length > 8) {
        message.author.DMchannel.send("Try updating your stats with the following format: D: # of demos " +
            "E: # of exterminations U: Your Username");
    } else {
        if (isNaN(args[0]) || isNaN(args[2])) {
            message.author.DMchannel.send("Try updating your stats with the following format: D: # of demos " +
                "E: # of exterminations U: Your Username");
            console.log("failed");
            return;
        }
        if (args[0] > highscores.manualDemoLimit) {
            message.author.DMchannel.send("Your Demos are too high, and must be verified. Please DM JerryTheBee");
            return;
        }
        if (args[2] > highscores.manualExtermLimit) {
            message.author.DMchannel.send("Your Exterminations are too high, " +
                "and must be verified. Please DM JerryTheBee");
            return;
        }

        var name = "";

        if (args.length > 5) {
            for (int i = 4; i < args.length; i++) {
                name = name + args[i];
            }
        } else {
            name = args[4];
        }

        var content = "\n" + name + "," + args[0] + "," + args[2];

        fs.appendFile("leaderboard.csv", content);
        message.author.DMchannel.send("Logged Leaderboard Data");
    }
});

client.login(config.token);