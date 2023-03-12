const oracledb = require('oracledb');
const config = require("./config.json"); 

class Database {
    /**
     * Gets a single player's row in the Players table
     * @param {string} discord_id The id of player to search for
     * @returns {DemobotTypes.Player|false} Json object of row in PLAYERS table in db
     */
    static async getPlayer(discord_id) {
        return dbSelect(
            `SELECT *
            FROM players
            WHERE discord_id = :discord_id`,
            [discord_id]
        );
    }

    /**
     * Update a single player's row in the Players table
     * @param {String} discord_id The id of player to update
     * @param {Object} values Object mapping to update with pairings from KEYNAME: value
     * @returns {DemobotTypes.Player|false} Json object of row in PLAYERS table in db
     */
    static async updatePlayer(discord_id, values) {
        // Create the colname = value for update
        var setVals = Object.keys(values).map((value_key) => {
            return value_key + ' = ' + values[value_key];
        })

        const set = setVals.join(',');

        return dbUpdate(
            `UPDATE PLAYERS
            SET :set
            WHERE discord_id = :discord_id`,
            [set, discord_id]
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

            console.log(result.rows);

            if (result.rows && result.rows.length > 0) {
                retval = result.rows[0];
            } else {
                retval = false;
            }

            console.log(retval);
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

            await connection.execute(
                query,
                values
            );

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