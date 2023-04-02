declare module DemobotTypes {
    class Player {
        DISCORD_ID: string;
        NAME: string;
        DEMOLITIONS: int;
        EXTERMINATIONS: int;
        COUNTRY: string|null;
        LAST_UPDATE: string;
        AUTHORIZED: AuthorizationLevel;
        DELETED_AT: string|null;
    }

    class HistoryEntry {
        DISCORD_ID: string;
        DEMOLITIONS: int;
        EXTERMINATIONS: int;
        TIMESTAMP: string;
    }

    /**
     * Levels of allowed scores
     * LEVEL_NONE allows less than 15k demos and 500 exterms
     * LEVEL_OVER_15K allows any score less than the highest score
     * LEVEL_TOP allows any score
     */
    enum AuthorizationLevel {
        LEVEL_NONE = 0,
        LEVEL_OVER_15K = 1,
        LEVEL_TOP = 2,
    }
}