const oracledb = require('oracledb');
const config = require("./config.json"); 

class Database {
    /**
     * Gets a single player's row in the Players table
     * @param {string} discord_id The id of player to search for
     * @returns {DemobotTypes.Player|false} Json object of row in PLAYERS table in db
     */
    static async getPlayer(discord_id) {
        return this.dbSelect(
            `SELECT *
            FROM players
            WHERE discord_id = :discord_id`,
            [discord_id]
        );
    }

    /**
     * Update a single player's row in the Players table
     * @param {DemobotTypes.Player} player Object mapping to update with pairings from KEYNAME: value
     * @returns {DemobotTypes.Player|false} Json object of row in PLAYERS table in db
     */
    static async updatePlayer(player) {
        console.log("updating player");
        console.log(player);

        return this.dbUpdate(
            `UPDATE PLAYERS
            SET DISCORD_ID = :discord_id1, NAME = :name, DEMOLITIONS = :demolitions, EXTERMINATIONS = :exterminations,
                COUNTRY = :country, LAST_UPDATE = :last_update, AUTHORIZED = :authorized
            WHERE discord_id = :discord_id2`,
            [player.DISCORD_ID, player.NAME, player.DEMOLITIONS, player.EXTERMINATIONS, player.COUNTRY, player.LAST_UPDATE, player.AUTHORIZED, player.DISCORD_ID]
        );
    }


    /**
     * Runs any select query on the database
     * @param {String} query SQL query to run
     * @param {any[]} values Variables to bind to the sql query
     * @returns {Object} A single row from the database
     */
    static async dbSelect(query, values) {
        let connection;
        let retval;

        try {
            connection = await oracledb.getConnection( {
            user          : "ADMIN",
            password      : config.oraclePassword,
            connectString : config.connectString,
            });

            const result = await connection.execute(
                query,
                values,
                {
                    'outFormat': oracledb.OBJECT,
                }
            );

            // console.log(result.rows);

            if (result.rows && result.rows.length > 0) {
                retval = result.rows[0];
            } else {
                retval = false;
            }

            // console.log(retval);
        } catch (err) {
            console.error(err);
        } finally {
            if (connection) {
                try {
                    await connection.close();

                    return retval;
                } catch (err) {
                    console.error(err);
                }
            }
        }
    }

    /**
     * Runs any update query on the database
     * @param {String} query SQL query to run
     * @param {any[]} values Variables to bind to the sql query
     * @returns {Boolean} whether the update succeeded
     */
    static async dbUpdate(query, values) {
        let connection;

        try {
            connection = await oracledb.getConnection( {
            user          : "ADMIN",
            password      : config.oraclePassword,
            connectString : config.connectString,
            });

            // console.log("Executing query");
            // console.log(query);
            // console.log(values);

            const result = await connection.execute(
                query,
                values
            );

            // Commits update to DB
            await connection.commit();

            // console.log(result);
        } catch (err) {
            console.error(err);
        } finally {
            if (connection) {
                try {
                    await connection.close();
                    return true;
                } catch (err) {
                    console.error(err);

                    return false;
                }
            }

            return false;
        }
    }
}

module.exports = Database;